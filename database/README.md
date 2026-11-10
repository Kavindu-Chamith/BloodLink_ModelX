# Database

BloodLink uses PostgreSQL. The current schema stores latitude and longitude as numeric values; outreach distance filtering uses SQL distance calculations. PostGIS is not required by the current application.

## Initialize or upgrade

For a new empty database, run from `backend`:

```powershell
npm.cmd run db:init
```

For an existing development database, first confirm `DATABASE_URL` points to the intended database and take a backup, then run:

```powershell
npm.cmd run migrate
```

The migration runner serializes concurrent migrations, applies pending files transactionally, and tracks applied checksums in `schema_migrations`. Keep all numbered migration files and do not edit migrations already applied to shared databases. `schema.sql` is the manual fresh-install alternative; do not run it over an existing schema.

## Local accounts and synthetic data

Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the ignored `backend/.env`, then run `npm.cmd run seed` from `backend` to create a local admin. Keep `.env` and all passwords out of Git. Demo fixture inserts are disabled by default; `SEED_DEMO_DATA=true` is for local development only. All checked-in records are synthetic and marked `SYNTHETIC_TEST_DATA_NOT_REAL`.

## Database roles and deployment

Use a restricted runtime database role rather than a PostgreSQL superuser. Keep migration-owner credentials separate from runtime credentials. Backups, TLS, document storage controls, retention policies and monitoring must be configured for each deployment; they are not provided by this schema alone.
