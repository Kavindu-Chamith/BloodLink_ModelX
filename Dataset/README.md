# BloodLink — Synthetic Supplementary Fixtures

**All output is fictional and nonclinical.** `SYNTHETIC_TEST_DATA_NOT_REAL`. This package supplements, but never overwrites, the original donor population and original CSVs.

**Local integration completed on 3 November 2026:** the supplemental records are
now imported and migration 009 is applied. The generator's original reports below
describe file-generation scope; current database/API status and demo instructions
are in [docs/TODAY_DEMO.md](../docs/TODAY_DEMO.md).

## Inputs and reproducibility

- Original dataset directory: `bloodlink_synthetic_dataset/` with seven original CSVs and `manifest.json`.
- Original snapshot remains **2026-11-03T00:00:00Z**. Original event timestamps are unchanged. Generation timestamp is separate in `supplement_manifest.json`.
- Generator seed: **20261104**; Python **3.10+**, no third-party libraries for generation or validation.
- Commands (run from a project root with the source folder present):

```bash
python Dataset/generate_supplemental.py --source Dataset --out Dataset --min-units 1 --max-units 6
python Dataset/validate_supplemental.py --source Dataset --out Dataset --reminder-days 90
```

The generator uses a deterministic per-source-ID SHA-256 seed to make CSV rows reproducible independently of generation time. Generator reruns update the **metadata creation timestamp** but not CSV contents. No source file is written to.

## Files and schemas

### `request_details.csv` (333 rows)

| Field | Meaning |
|---|---|
| `request_id` | Existing source `blood_requests.request_id`, **not** an application integer key |
| `required_units` | Independent synthetic positive integer, uniformly 1–6 by default; number of blood units requested |
| `reason` | Generic fictional outreach scenario; not clinical information |
| `department` | Generic fictional coordination office |
| `generation_method` | Seeded generation policy and configured units range |
| `data_provenance` | `SYNTHETIC_TEST_DATA_NOT_REAL` |
| `is_simulated` | `true` |

**Important:** `outreach_target` (volunteers an officer hopes to contact) remains in the original source request. It is NOT equal in meaning to blood units. Random numerical equality in some rows is coincidental. Preserve the original request group, timestamps, institution ID, expiry, source status, and outreach target.

### `request_import_decisions.csv` (333 rows)

Contains `request_id`, original `source_status`, `source_urgency`, `app_urgency_demo_convention`, original `source_created_at` and `source_expires_at`, `operational_status_guidance`, `preserve_source_status`, and standard simulation fields.

**Urgency mapping — demo convention, never a clinical triage rule:** `routine → Normal`, `priority → Urgent`, `urgent → Emergency`.

**Lifecycle:** Source `expired` is not fulfilled and must not be treated as active. Source `closed` has unknown closure reason and should be **held for review** unless a schema supports a neutral archived/closed state; do **not** assume fulfilled. For source `active`, always compare `expires_at` to actual import time before assigning operational status; if already expired, do not import as active. Store original lifecycle as separate provenance fields. Never rewrite source timestamps. Application status `Fulfilled` requires independent collection proof; accepting outreach is not collection proof.

### `donation_institution_links.csv` (71,097 rows)

| Field | Meaning |
|---|---|
| `donation_event_id` | Existing source historical event ID |
| `donor_id` | Existing source donor ID; resolve through `bloodlink_dataset.donor_map` |
| `institution_id` | Existing source institution ID; resolve through `bloodlink_dataset.institution_map` |
| `assignment_method` | Seeded weighted selection among the three nearest **current simulated** institution points |
| `assignment_distance_km` | Haversine distance between current simulated donor point and selected institution, 3 decimal km |
| `data_provenance` | `SYNTHETIC_TEST_DATA_NOT_REAL` |
| `is_simulated` | `true` |

Nearest-three weights are **65%, 25%, 10%**. Ties break deterministically using institution ID. Current simulated address is *not* evidence of historical residence, institution of past donation, or travel history. Keep source `donation_date` and `reported_units` unchanged, and DO NOT adjust stock snapshots or connect historical donations to unrelated blood requests. Historical interval screening (default **56 days**) is a configurable **demo reminder flag only**, not medical clearance or donor eligibility.

### `institution_staff.csv` (48 proposed primary accounts)

| Field | Meaning |
|---|---|
| `source_staff_id` | Stable synthetic candidate ID `STAFF-INS###` |
| `institution_id` | Existing source institution ID |
| `fictional_full_name` | Fictional demo display name |
| `email` | Unique `@example.invalid` non-deliverable test address |
| `role` | `bloodbank_staff` for mock blood banks; `hospital_staff` for mock hospitals |
| `is_bank_account` | `true` for mock blood banks, `false` for mock hospitals; verify against real schema |
| `must_change_password` | `true`; only a candidate instruction, not an existing DB flag |
| `data_provenance` | `SYNTHETIC_TEST_DATA_NOT_REAL` |
| `is_simulated` | `true` |

**These 48 rows are candidates, not 48 guaranteed new DB users.** Import only where no mapped primary account already exists. No passwords, password hashes, or reset operations are included. Any temporary passwords must be generated at import by the **existing application password service**, stored only in an ignored local secret file if strictly necessary, and never logged, committed, included in export CSVs, or sent by email. Ensure external notification dispatch is disabled in fixtures mode.

### `supplement_manifest.json`

Records original snapshot, supplemental seed and generation time, source SHA-256 values, generated CSV SHA-256 values, source immutability, config, and counts.

### `validation_report.json`

Reports actual per-row file-level checks, failing checks, original-source anomalies requiring import policy, examples and the DB/API checks *not executed*.

## Missing optional fields and verification fixtures

- **Birth date:** No invented birth dates: cannot confirm database requirements or configured age rules without repository.
- **NIC and phone:** Remain NULL: `TEST-LK-*` source strings are not real phone numbers; do not invent plausible NICs or real-looking telephone numbers.
- **Verification document PDFs:** Not fabricated because no repository or requirement confirms that the workflow needs document attachments. Existing unverified or unknown states must not be promoted to approved. If required later, create a small clearly marked set bearing `SYNTHETIC DEMO DOCUMENT — NOT MEDICAL EVIDENCE.` with fictional IDs only and links; do not imitate official forms or certificates.
- **Existing institution staff:** Cannot tell which organizations already have a primary staff user without DB access. Treat all rows as candidates and skip existing mappings.

## Scope of validation

File-level validation checks counts, exact source ID coverage, uniqueness, simulated provenance, roles, distances, timestamps, original-file immutability, linkage, and reminders. It separately flags questionable original-source events instead of silently repairing them. **No DB, application/API, real geographic polygon, clinical or notification integration validation has occurred.** See `IMPORT_PATCH_PLAN.md` and `MISSING_DATA_REPORT.md`.
