# BloodLink — Missing Data and Unresolved Integration Questions

**Local follow-up, 3 November 2026:** the repository and database were subsequently
checked, the supplementation was imported, and the integration issues below were
resolved or explicitly retained as historical-data limitations. See
[the current handoff](../docs/TODAY_DEMO.md). This file preserves the generator's
original assessment; its “unavailable” statements describe that earlier environment.

Generated supplement is complete for **existing source IDs**, but **not yet imported** into PostgreSQL.

## Not supplied / unable to verify

1. `Dataset/IMPORT_REPORT.md` and original import batch identifier, existing imported record map contents, schema and repository: unavailable here.
2. Which, if any, of 48 mapped organizations already has a primary demo staff account: unknown. `institution_staff.csv` contains **48 candidates**, not a command to create duplicates.
3. Database role and `is_bank_account` constraints, password hashing service and whether the schema requires DOB/NIC/phone: unknown. No DOB/NIC/phone or credentials fabricated.
4. Real notification/response table schema and one-active-mission enforcement: unknown. No notifications were dispatched.
5. Actual configured donation reminder interval: unknown. Validation uses **56 days as a changeable screening example**; not a clinical rule.
6. Source `closed` request closure reasons and documented fulfilled collections: unavailable. **47 closed rows require policy/review**; they are not automatically fulfilled.
7. Verification document workflow and authorization policy: unknown. No synthetic PDFs or document links generated. No verification statuses upgraded.
8. Original location data are approximate simulated coordinates, not independent district polygon validation.
9. DB write behavior and stock-update triggers: unknown. Stock files are unchanged; donation imports **must not increase stock**.
10. Application code and test database: unavailable; no migration, importer, API changes, idempotency test, transaction rollback test or dry run executed.

## Existing-source flags requiring import treatment

See `validation_report.json` for timestamped counts and source examples; active-expiry flags depend on the time the validation is executed. Source requests marked `active` must be checked against actual import time. Source accepted responses with overlapping request windows must be reconciled under the app's one-active-mission constraint without deleting raw events. `simulated_delivered` is not a real transport receipt. Separate historical donation history from requests and current stocks.

## Suggested next integration action

Provide **repository snapshot** and `Dataset/IMPORT_REPORT.md` or connect the application repo. Run a preflight on a designated non-production database with existing source-to-app maps and known import batch. Only then prepare a schema-specific migration, an idempotent transactional importer, and meaningful tests.
