# BloodLink — Repository-dependent schema and supplemental importer plan

**Local implementation completed, 3 November 2026:** migration 009,
`backend/src/importSupplementalDataset.ts`, shared matching checks, the coverage
dashboard and regression tests implement the relevant plan below. The database
was imported and verified. See [current status](../docs/TODAY_DEMO.md). The design
notes below preserve the generator's original repository-independent assessment.

**STATUS: Design only, not applied or tested.** `Dataset/IMPORT_REPORT.md`, schema/migrations and application source code were not available in the provided files. Do not apply SQL guesses directly to production; inspect actual column names, enum/check constraints, indexes, migration history, and import behavior first.

## Files to inspect before implementation

- `Dataset/IMPORT_REPORT.md`
- `database/schema.sql` and **already applied migration history**
- `backend/src/importDataset.ts`, `backend/src/services/coordination.service.ts`
- Request creation, matching, coverage count, notification delivery, donor acceptance and donor profile APIs
- Existing `bloodlink_dataset.donor_map(batch_id,donor_id,user_id)` and `bloodlink_dataset.institution_map(batch_id,institution_id,organization_id)`; existing PK types and event/notification tables
- `public.donations` organization FK, existing staff role constraints and `is_bank_account` constraints
- Current donor age/reminder policy, consent semantics, verification review model and existing account uniqueness constraints

## Proposed **new** migration (do not rewrite applied migration)

1. Add **nullable** provenance and source state fields where absent: `source_request_id`, `dataset_batch_id`, `source_status`, `source_urgency`, `expires_at`, `outreach_target`, `data_provenance`, `is_simulated`, and import source timestamps. Add source batch/id uniqueness via mapping tables, *not* an assumption that `REQ00001` is an integer PK.
2. Add or preserve consent status/time, `availability_updated_at`, city, province, and detailed blood-group verification to donor profiles (or separate history tables). NULL = unknown, not consent/approval. Do not replace existing verification audit history.
3. Introduce source event-map tables keyed `(batch_id, source_request_id)`, `(batch_id, source_response_id)`, `(batch_id, source_donation_event_id)`, `(batch_id, source_staff_id)` mapped to actual operational PKs with FK and unique constraints. These also allow safe reruns and auditability.
4. If application request status lacks `Expired` or `ClosedUnknown`, preserve source lifecycle in separate columns; import operational `Cancelled` for expired requests according to a documented expiry mapping. **Hold source `closed` pending policy**, never force `Fulfilled` without verified collection. Implement an explicit archived/lifecycle status only if supported by API and UI.
5. Store `required_units` separate from `outreach_target`, `accepted_count`, `confirmed_donations`, and stock units. Do not backfill or compute one from another.
6. Prefer a **separate nullable synthetic staff provenance field** or a demo-user mapping rather than assuming the app table permits `must_change_password` or arbitrary role strings.
7. Add safety indexes for requests by `(organization_id, status, expires_at)`, donor freshness/consent and source mappings only after checking existing indexes.

## Supplement importer: transaction and dry-run requirements

- Standalone new command e.g. `backend/src/importSupplementalDataset.ts`, NEVER rerun primary importer, never disable primary duplicate-email protection. Explicit `--batch-id`, `--dry-run` (read-only), and `--apply`; no default write mode.
- Abort before connecting/committing unless explicit **non-production** environment, allowlisted DB name/host, `NODE_ENV` guard and a local acknowledgement flag. Disable queue workers, SMTP, FCM and outbound notification hooks before import. Rely on DB transaction, not implicit UI suppression.
- Preflight source/supplement manifest hashes and counts, lock batch, check source stage tables, source-to-app maps, schema column capability, existing staff primaries, and foreign-key readiness. Any ambiguous mapping or unknown lifecycle is **reported as unresolved**, not guessed.
- Resolve `REQ*.institution_id -> institution_map.organization_id` and `BLD*.donor_id -> donor_map.user_id`, **scoped by the original batch_id**. Build request map rows before touching responses. Never coerce source strings to numeric IDs.
- Request import: join request source and `request_details` on `request_id`; get `required_units` and `outreach_target` from their respective fields; calculate expiry at **actual import time**; preserve original status and timestamp; use demo urgency map. Hold `closed` without fulfillment evidence. Persist idempotency map.
- Response import: join source request map and donor map, save source response ID and simulated delivery field separately. `no_response` -> `pending` with NULL `responded_at`; preserve `notification_sent_at` as simulated historic timestamp; `simulated_delivered` is **never** an FCM/provider receipt. Do not dispatch any message. Detect overlapping accepted donor missions; log conflict and hold/resolve with explicit policy instead of silently deleting responses. Do not treat acceptance as actual completed donation.
- Historical donation import: join donation events to `donation_institution_links`, then to donor and organization maps. Store original date and reported units and assigned-site provenance. Set no stock increment triggers; if unavoidable, stage historical events in separate nonstock table until reviewed. Do not associate historical donation with arbitrary source request.
- Staff import: load candidates only when the organization lacks an already mapped primary account. Use safe unique `@example.invalid` addresses; ensure `hospital_staff` does not receive bank-account-only flag. Generate secrets **only if required**, in the existing password service; no plaintext persisted in DB staging, CSV, logs or git. Never change donor/admin passwords.
- Wrap each apply operation in an explicit DB transaction and advisory lock (or equivalent). Use map unique constraints and `ON CONFLICT` only where conflict semantics have been verified; rollback everything on any unexpected exception. Report `inserted`, `skipped_existing`, `conflicting`, `unresolved`, `failed`, by table and source ID. No implicit stock changes. Keep run audit with batch and manifest hashes.
- Dry run should perform reads/checks, simulate intended actions, and produce counts but **never** call INSERT/UPDATE/DELETE or send external notifications. Do not reuse the production DB for fixture testing.

## Candidate eligibility and consistency

All four paths — matching, radius-band coverage counting, notification targeting and request acceptance — must enforce one shared candidate predicate: request institution verified, request active and `now < expires_at`, donor opt-in affirmative with recorded consent, donor availability current and within configured freshness window, blood group verified (if your chosen demo rule requires it), geography/blood group/reminder policy appropriate to the demo, no overlapping active mission, and reasonable uncertainty labeling. Missing/unknown consent or verification must never be treated as `true`. Match blood-group **same label only** for nonclinical demonstration, never assert transfusion compatibility. Coverage counts are prospective **volunteers**, not units of blood or clinically eligible donors. Notification provider failure and `no_response` remain separate.

## Tests needed on the actual repository

1. Existing donors, institutions, stocks, identities and passwords unchanged after import; original SHA-256 source remains unchanged.
2. Apply twice: second apply produces 0 extra source-mapped records; report skips.
3. Inject failure midway: full rollback including map rows and staff accounts.
4. `--dry-run` contains zero write transactions; production guard refuses prod URL and doesn't send messages.
5. Mapping resolves all original IDs without assuming integer keys and respects batch scope.
6. Acceptance conflicts preserve original events and one-active-mission invariant.
7. `closed` requests never automatically fulfilled; `active` but expired becomes non-active; source dates preserved.
8. `no_response` creates pending/null response timestamp; simulated delivery never asserted as provider delivery.
9. Consent, freshness, verification and expiration filters consistent across matching, coverage, notification and acceptance.
10. Historical donation imports have no effect on stock; supporting history cannot claim clinical donation eligibility.

No migration or importer is marked implemented or passed; actual repository needed first.
