# Database (PostgreSQL + PostGIS)

The current schema uses PostgreSQL tables and numeric coordinates; the PostGIS matching
engine and its spatial indexes are not yet implemented.

For a new empty database, run `npm run db:init` from `backend`. For an existing database,
back it up and run `npm run migrate`. The runner serializes migrations with an advisory
lock, applies all pending SQL files in one transaction, and records file checksums in
`schema_migrations`. Re-running applied migrations does not repeat their side effects.

For manual setup in DataGrip, create an empty database and select it and its `public`
schema as the execution target for `database/schema.sql`. Execute the entire file
and commit if using manual transactions. The script creates all current application
tables, constraints and indexes without inserting accounts or institution/request data.
Set `backend/.env`'s `DATABASE_URL` to the same server, port, database and credentials,
then start the backend with `npm run dev`. The local setup defaults to port 5433;
use the port of your manually managed PostgreSQL server instead. Do not run `db:init`
after creating the tables manually. To create the admin account, configure
`ADMIN_EMAIL` and `ADMIN_PASSWORD` and run `npm run seed` from `backend`.
The migration runner can subsequently register/apply migrations with `npm run migrate`;
do that before using the database to establish migration tracking. Demo rows are
disabled by default.

The current runner skips migration 006's optional demo inserts by default and
always skips them in production, recording `schema_migrations.skipped = true`.
Its historical SQL/checksum stays unchanged for databases that already applied it.
Use `SEED_DEMO_DATA=true` explicitly for development demo data only.

Migration 007 completes private document storage, donor profile district, unique
missions/responses, donation/request linkage, read states, coordinator messages,
push devices/jobs, single-use download tickets and shared rate-limit counters.
`schema.sql` includes the same structures for manual fresh installations.
See [the current backend contract and security handoff](../docs/BACKEND_COMPLETION.md).

Root-level `npm start` and `npm stop` also support a manually managed PostgreSQL
database configured in `backend/.env`. They manage the private PostgreSQL instance
only when the connection points to that instance; a separate PostgreSQL service
must already be running and is left running when the apps stop.

Keep all numbered migration SQL files: the migration runner and integration tests
read them to apply and verify upgrades. `schema.sql` remains the fresh-install
entry point, and this README documents both setup paths.

`migration_001_auth_tables.sql` adds auth tables/columns to older installations.
`migration_002_security_hardening.sql` adds secure proof hashes, session versions,
a durable reset-email queue, normalized identity indexes, a single pending donor review
per donor, coordinate/counter constraints, and timezone-aware timestamps.

`migration_003_admin_network.sql` adds institution district, contact email and an
`is_active` access switch for network administration. Existing institutions keep
access enabled; contact/location metadata is optional. Suspending an approved
institution is separate from rejecting its registration and revokes staff sessions.

`migration_004_bank_onboarding.sql` adds main-bank/branch relationships and a unique
primary account per blood bank or branch. New admin-provisioned bank accounts must
replace their temporary password. Existing accounts retain their passwords and do
not receive a forced reset. The migration runner accepts equivalent LF/CRLF SQL
checkouts while continuing to reject substantive changes to applied migrations.

The upgrade intentionally logs out pre-upgrade sessions, invalidates old registration
codes and insecure reset grants, and normalizes emails, NICs, and Sri Lankan phone formats.
It preserves users, password hashes, profiles, verification documents, and audit history.
Legacy naive timestamps are interpreted as UTC; installations that historically stored
another timezone must adapt that conversion before running the migration.

Duplicate normalized emails/NICs/phone numbers or duplicate pending donor reviews cause
the transaction to fail, preserving the existing database. Resolve those conflicts
explicitly; the migration does not guess which account/document to delete.

Donor blood groups remain unverified until an administrator approves an actual document.
Approval updates `blood_group` and `blood_group_verified` in the same transaction.
Future matching queries must require this flag alongside availability and eligibility.

Run the API with a limited database role, not a PostgreSQL superuser. Use a separate
migration owner and a separate CREATEDB-capable test account. Production backups, database
TLS, document access control, retention policies, and monitoring require deployment setup.

`migration_005_account_first_onboarding.sql` allows primary bank accounts to exist before a bank record is created. Unassigned accounts remain unable to authenticate. Registering a bank assigns one pre-created account atomically; the unique primary-account index continues to prevent duplicate bank links. Existing assignments and credentials are preserved.
