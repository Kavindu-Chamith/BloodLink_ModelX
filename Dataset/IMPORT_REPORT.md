# Database import — 3 November 2026 (Sri Lanka)

**Follow-up:** the supplemental import and migration 009 are now complete. The
333 requests, 71,097 donation events, 275 responses and 48 staff accounts have
been added. See [the current demo handoff](../docs/TODAY_DEMO.md). The sections
below preserve the earlier initial-import report and its then-missing fields.

Imported into the configured local development database, `bloodlink_modelx`.
All supplied records are synthetic. Existing records were preserved; a hash comparison
of every pre-existing row in every public table passed after import.

## Application tables

| CSV | Application table | Added | Mapping |
| --- | --- | ---: | --- |
| donors.csv | public.users | 10,000 | Reserved test email, donor role, generated unusable-to-the-user secret hash; no credentials exported |
| donors.csv | public.donor_profiles | 10,000 | Fictional name with DEMO prefix, district, coordinates, blood group, simulated verification flag, last donation date, timestamps |
| institutions.csv | public.organizations | 48 | Mock bank/hospital type, name with DEMO prefix, city/district, coordinates and simulated approved state |
| blood_stocks.csv | public.blood_stocks | 384 | Mapped organization ID, blood group, supplied units/status and snapshot timestamp |

Database totals immediately after import: 10,005 users, 10,001 donor profiles,
55 organizations, 408 stock rows. Existing 8 requests, 3 donations and 6 notifications
were preserved. No new operational requests, donations or notifications were fabricated.

Of the imported profiles, 6,721 have the CSV's **simulated** verified state.
These flags are demo states, not documentary reviews. There are no new verification
documents or reviewer records.

2,875 imported profiles had application availability enabled at import time:
source availability must be Yes, consent must be granted, and the update must fall
within the preceding 30 days, with future updates excluded. Blood-group verification,
distance and donation-interval checks remain separate matching filters. The exact
original availability and consent values are retained in the source schema.
This filter runs during import; ongoing freshness/consent enforcement requires
separate application changes. The source snapshot is 2026-11-03T00:00:00Z;
it was not shifted to manufacture current activity.

## Complete source data retained in PostgreSQL

Every original CSV column is stored as text in a separate `bloodlink_dataset` schema.
This preserves blanks, original IDs, simulated provenance and statuses without
forcing incompatible meanings into application columns. Source tables have primary
keys and donor/institution/request foreign keys. Use the migration/owner connection
in your database client to inspect this schema; it is not exposed through the API.

| Source table | Rows |
| --- | ---: |
| bloodlink_dataset.donors | 10,000 |
| bloodlink_dataset.institutions | 48 |
| bloodlink_dataset.blood_stocks | 384 |
| bloodlink_dataset.blood_requests | 333 |
| bloodlink_dataset.donor_responses | 275 |
| bloodlink_dataset.donation_history | 71,097 |
| bloodlink_dataset.locations_reference | 48 |

`bloodlink_dataset.donor_map` maps each source donor ID to `public.users.id`.
`bloodlink_dataset.institution_map` maps institution IDs to `public.organizations.id`.
`bloodlink_dataset.batches` records the manifest, content fingerprint and import report.

## Missing data and application schema gaps

| Data/table | Missing information or limitation | Result / next step |
| --- | --- | --- |
| public.blood_requests | `required_units` is mandatory but absent from the CSV. `outreach_target` is a number of volunteers to contact, not blood units. | All 333 requests remain in source tables. Add independently generated `required_units` if these should become app requests. |
| Request coverage and expiry | The application has no `outreach_target` or `expires_at` columns. Its status/urgency vocabulary also differs from the CSV. | Implement explicit coverage/expiry fields and lifecycle mappings before operational import; do not reactivate expired fixtures. |
| public.donations | Every donation needs an `organization_id`; donation_history.csv has no institution identifier. | All 71,097 events remain in source tables. Supply an `institution_id` on each event, or an explicitly documented simulated assignment rule. |
| public.notifications | Response rows refer to source requests that could not become application requests. | All 275 responses remain in source tables. Map requests first; preserve accepted/declined/no-response semantics and the one-active-mission constraint. |
| Push delivery | `simulated_delivered` is a fixture label, not an actual provider receipt. Device tokens and delivery receipts are absent. | No push jobs, devices or real delivery events created. |
| public.donor_verifications / verification_documents | Supporting files, reviewer identities and review events are absent. | No fabricated documents or review rows. Only the supplied simulated boolean profile state was mapped. |
| Institution registration and staff | Registration evidence, staff identities, account emails and passwords are absent. | Imported mock organizations have no newly created staff accounts. Staff sign-in requires separate account setup. |
| Donor contact / identity | Realistic test phone numbers, NICs and dates of birth are absent. `TEST-LK-*` is an identifier, not a phone number. | phone, nic and date_of_birth remain NULL. Fake contact identifiers stay in source tables. |
| Donor consent, freshness and location details | Application profiles lack dedicated consent status/time, availability-update time, city, province, provenance and detailed verification status columns. | Preserved in source tables. Their ongoing use requires explicit schema/API changes. `updated_at` initially receives the source availability-update time. |
| Donation totals | The app calculates history from institution-linked donation rows, not source summary totals. | Last donation date is copied; imported totals will not appear as confirmed history until missing institution links are supplied. next_eligible_date stays NULL. |
| public.health_alerts / coordinator_messages | No alert/message text, sender IDs or corresponding events supplied. | Existing tables preserved; no messages invented. |
| Authentication and runtime tables | No legitimate OTPs, refresh/reset tokens, download tickets or live device registrations supplied. | These records should be created by real app activity, not seeded from donor CSVs. |

The stock CSV's fixture thresholds are preserved (`<7` Critical, `<18` Low,
otherwise Normal); they differ from some existing preview fixtures. No clinical
meaning or actual supply is implied.

## Repeatable import

From `backend`:

```powershell
npm.cmd run dataset:import             # Read-only database preflight
npm.cmd run dataset:import -- --apply  # Apply transactionally
npm.cmd run test:dataset-import        # Uses and removes a disposable local database
```

The importer uses the existing `MIGRATION_DATABASE_URL` owner connection when
configured, verifies that it targets the same local development database as
`DATABASE_URL`, and refuses production/nonlocal CLI imports. It sends no messages.
Repeating the identical dataset is a no-op. A changed dataset that collides with
existing donor emails is rejected instead of overwriting accounts.

To inspect a donor and its source metadata:

```sql
SELECT m.donor_id, m.user_id, d.full_name, d.is_available,
       s.city, s.province, s.consent_status, s.availability_updated_at
FROM bloodlink_dataset.donor_map m
JOIN public.donor_profiles d ON d.user_id = m.user_id
JOIN bloodlink_dataset.donors s USING (batch_id, donor_id)
ORDER BY m.donor_id
LIMIT 20;
```

Validation: the supplied independent validator passed 297,599 assertions against
a temporary copy of the CSVs. Backend type checking and importer tests passed,
including a forced late failure proving transaction rollback, preservation of
existing accounts, consent/freshness filtering, duplicate-import prevention and
rejection of conflicting source versions. The actual database was also checked
for source/application counts, unchanged pre-existing rows and a no-op repeat.

Detailed local execution reports are in ignored `.qa-private/dataset-import/`.
