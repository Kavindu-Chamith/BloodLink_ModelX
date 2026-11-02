# Backend implementation and security handoff

**1 November 2026 update:** institution dashboards, super admin request approval and private donor health messages are implemented. Request creation now submits for review and dispatches only on approval. See [institution dashboard handoff](INSTITUTION_DASHBOARD.md) for current contracts and migration 008 upgrade behavior; it supersedes the immediate-dispatch behavior described below.

Updated 31 October 2026. This describes the implemented API; the original project
proposal also describes features and architecture that preceded this implementation.

## Running the project

The existing local database is `bloodlink_modelx` at `127.0.0.1:5432`.
`backend/.env` holds a dedicated runtime login, a separate migration connection,
and a connection for disposable integration tests. Credentials are ignored by Git.
The original PostgreSQL login used by DataGrip has not been changed.

From the repository root, `npm.cmd start` starts the API, dashboard, and mobile
preview using the configured PostgreSQL service. `npm.cmd stop` stops these apps
without stopping a separately managed PostgreSQL service. The API alone can be
started with `npm.cmd run dev` from `backend`.

For an existing database, run `npm.cmd run migrate` from `backend`. For an empty
database, use `npm.cmd run db:init` instead. DataGrip can also execute the complete
`database/schema.sql` against an empty database. Follow manual schema creation
with `npm.cmd run migrate` to register migration history. Do not run `db:init`
against existing tables.

The migration CLI uses `MIGRATION_DATABASE_URL` when set. Application queries use
`DATABASE_URL`. `npm.cmd run db:runtime` provisions the restricted login described
below, and is useful when deploying to a new database. Run migrations first.

The legacy migration 006 contains sample institution and blood request inserts.
For fresh installations it is skipped unless `SEED_DEMO_DATA=true`, and is always
skipped in production. The checksum and explicit `schema_migrations.skipped` flag
retain an honest history without editing an already applied migration. Existing
applied migrations are not replayed. Demo seed data is an explicit development
option; HTTP reads never create sample data.

In this workspace, five old sample requests were cancelled and four unused seeded
institutions were returned to pending review. None had staff, donor responses or
donations. No accounts, requests or institutions were deleted. A private PostgreSQL
backup was created under `.qa-private/backups` before the database update.

## API contracts

All paths below start with `/api`. Protected routes require an `Authorization:
Bearer <accessToken>` header. Read and mutation authorization use current database
roles, account status, institution access, token version, and active session state.
Temporary staff passwords must be changed before accessing operational endpoints.

Existing authentication, account recovery, organization/staff review, network
administration and bank onboarding endpoints remain available; see
[backend README](../backend/README.md). JSON failures use `{ "error": "..." }`.
Invalid inputs return 400, missing/revoked sessions 401, wrong roles 403, absent or
another institution's resources 404, state conflicts 409, throttling 429, and
unavailable dependencies 503. Document size violations return 413.

### Donor APIs

| Method | Path | Result / body |
| --- | --- | --- |
| GET | `/donors/me` | Owner's profile, verification state and donation interval; no precise coordinates |
| PATCH | `/donors/me` | Partial `fullName`, `phone`, `district`, or paired numeric `latitude`/`longitude`; paired nulls clear location |
| PATCH | `/donors/me/availability` | `{ "isAvailable": true }` |
| GET | `/donors/home` | Current donor dashboard with matched requests |
| GET | `/requests/me` | Alerts and current mission; `/donors/requests/me` is an alias |
| GET | `/donors/requests` | Matched request cards |
| POST | `/requests/:id/respond` | `status`: `accepted`, `en_route` or `declined`; `/donors/requests/:id/respond` is an alias |
| POST | `/requests/mission/:id/notify` | `reason`, 1–2000 characters; requires that donor's active accepted mission |
| POST | `/requests/mission/:id/cancel` | Cancels only that donor's active accepted mission |
| GET | `/donors/me/donations` | Owner's donation history, newest first, at most 1000 records |
| POST | `/donors/me/verification-documents` | Multipart `document`; optional `claimedBloodGroup`, otherwise current profile group |
| GET | `/documents/:uuid` | Attachment download for document owner or platform admin |
| GET | `/donors/me/donation-record` | Relative PDF download URL with a single-use, two-minute ticket |
| GET | `/donation-records/:ticket` | Consumes ticket and returns PDF; checks current account, credential version and session |
| GET | `/notifications` | Notification array; optional `limit` (1–100), `before` notification ID |
| PATCH | `/notifications/:id/read` | Owner-scoped read state; does not alter response status |
| PATCH | `/notifications/read-all` | Marks the owner's notifications read |
| POST | `/notifications/devices` | Registers `{ "token": "<native FCM token>" }`, returns device ID; requires FCM configuration |
| DELETE | `/notifications/devices/:uuid` | Unregisters the owner's device |

The public `/donors/banks` directory returns approved, active institution locations
and stock only. An optional valid donor session adds distances without exposing
donor coordinates. Supplying an invalid token does not fall back to anonymous mode.

Profile editing cannot change roles, blood group, verification flags, NIC, donation
history or eligibility dates. Verification requires an uploaded, privately stored
document. `/donors/submit` can reference a previously uploaded document owned by the
same donor. New medical verification submissions do not accept arbitrary external
URLs or fabricated upload paths. Existing external evidence remains available to
administrators reviewing legacy records.

The mobile profile provides explicit update/remove controls for matching location.
It requests foreground permission only when the donor chooses to update, rounds
the position to roughly 100 m, and sends it through the authenticated API. The API
returns `hasMatchingLocation` rather than the stored coordinates. The app does not
request background tracking. Browser location requires localhost or HTTPS, and
native builds must include the configured Expo location module and permissions.

### Hospital / blood bank staff APIs

Every query and mutation is scoped to the institution in the authenticated account.
Body fields cannot select a different institution. Admins use the administration
API; a platform admin token does not bypass operational staff roles.

| Method | Path | Result / body |
| --- | --- | --- |
| GET | `/institution/overview` | Institution summary, active requests, stock and donations |
| GET | `/stocks` | All eight blood groups, units, derived stock status, update timestamp |
| PUT | `/stocks/:bloodGroup` | `availableUnits`: integer 0–100000; existing rows also require current `expectedUpdatedAt` |
| GET | `/requests` | Own requests, newest first, at most 100; optional `status` filter |
| POST | `/requests` | `bloodGroup`, `requiredUnits` (1–1000), optional `priority` (`Normal`, `Urgent`, `Emergency`) and `radiusKm` (>0, ≤500) |
| GET | `/requests/:id` | Own request, response states, accepted-donor contact details and coordinator messages |
| POST | `/requests/:id/dispatch` | Notify newly matched donors; repeated dispatch does not duplicate alerts |
| PATCH | `/requests/:id/status` | Close as `Cancelled`; `Fulfilled` requires confirmed requested units; closed requests cannot reopen |
| POST | `/requests/:id/donations` | `donorId`; optional `unitsDonated` must be 1; records the server's current date |
| GET | `/institution/staff` | Own institution's safe staff directory |
| POST | `/institution/staff` | Primary blood bank login only: `email`, strong temporary `password`; creates a teammate at that same bank |
| PATCH | `/institution/staff/:id/status` | Primary blood bank login only: `active` / `suspended`; cannot affect another bank or the primary account |

URL-encode the blood group when constructing paths (`O%2B`, `O-`, etc.). Stock
status is derived as Critical for 0–2 units, Low for 3–9, and Normal for 10 or more.
Stock edits serialize on institution/group and reject stale timestamps, including
concurrent initial creation. Donor coordinates, NICs and credentials are never
included in staff request responses. Contact name/phone is shown for accepted
donors so the institution can coordinate attendance.

Donation confirmation requires an accepted mission, active donor, verified matching
blood group and elapsed donation interval. A transaction locks request and donor,
records history, increments stock, updates next donation date and closes the
mission. The request is fulfilled automatically when its required units are recorded.
Repeated confirmation of the same donor/request returns the same donation without
incrementing stock again. Clinical screening is performed by qualified staff;
the configurable software interval is a coordination rule, not medical clearance.

### Matching and notifications

Matching uses exact verified blood groups, active accounts, availability, recorded
donation intervals and server-side geographic distance within the institution's
request radius. It does not infer a blood group or substitute a default location.
The portable PostgreSQL implementation uses a clamped spherical distance formula;
PostGIS is not required. Cross-group clinical substitution is not automated.
Only one accepted open mission is allowed per donor, enforced by database uniqueness
and transaction locks. Cancelled/fulfilled requests cannot acquire new responses.

Request creation and explicit redispatch persist in-app alerts. Verification review,
donation confirmation and donation interval reminders also create real notifications.
Reminder deduplication persists across process restarts and multiple instances.
Coordinator messages are stored and returned to institution staff; an audit entry
alone is not treated as notification delivery.

FCM delivery uses HTTP v1 and Google Application Default Credentials. Set
`PUSH_TRANSPORT=fcm`, `FCM_PROJECT_ID`, and, outside an environment supplying workload
credentials, `GOOGLE_APPLICATION_CREDENTIALS` pointing to a private service-account
file. The backend accepts native FCM tokens, not Expo push service tokens. Native
device permission/token acquisition and Firebase platform configuration must be
provided by the mobile deployment. In-app notifications work without Firebase.

Push jobs have leases, crash recovery, bounded retries, exponential backoff,
invalid-device removal and session checks. At-least-once delivery can repeat a push
after a crash; clients can deduplicate by notification ID. Push text on lock screens
contains no health, identity or location details. Password-reset email retains its
separate durable queue. Admins can inspect queue counts with `GET
/admin/delivery-status`; this endpoint does not return device tokens or credentials.

## Security and deployment configuration

- Production rate limits use shared atomic PostgreSQL counters. Development uses
  memory unless `RATE_LIMIT_STORE=postgres`. Counter keys are HMACs; raw IPs are not
  stored in that table. Database failures fail closed. Database login lockout,
  OTP attempts/cooldowns, session rotation and single-use proofs remain enforced.
- API responses containing personal data use `Cache-Control: no-store` and
  `Referrer-Policy: no-referrer`. JWTs are not placed in download URLs. PDF tickets
  are random, hashed in storage, expiring and single-use; revocation also blocks
  outstanding tickets. Error logs use route patterns instead of token-bearing paths.
- Medical uploads are authenticated, limited to 5 MB PDF/JPEG/PNG, checked against
  extension, declared MIME type and file signature, and stored as private database
  bytes. Each donor can retain at most 20 documents and one pending review. Downloads
  are attachments with a sandbox CSP. Set `CLAMAV_HOST` and optional `CLAMAV_PORT`
  (default 3310) for clamd INSTREAM scanning. Production refuses an upload when the
  scanner is missing, unavailable or reports infection. Development can run without
  ClamAV. Scanner protocol behavior was tested with a controlled local test server;
  a live ClamAV installation was not available here.
- Operational mutations and administrative approvals/status changes write audit
  records in their database transaction; audit failure rolls back the mutation.
  Login/registration telemetry remains best effort and logs no credentials.
- `DATABASE_URL` should use a dedicated `<database>_api` login. `db:runtime` grants
  table DML and sequence usage without superuser, role creation, database creation,
  schema creation or migration-history mutation. `MIGRATION_DATABASE_URL` retains
  owner privileges for migrations, and `TEST_DATABASE_URL` supplies CREATEDB only
  to disposable tests. Use a random 32–128 character URL-safe runtime password.
  Owner credentials should be supplied only to migration/test jobs in deployment.
- Browser previews now keep bearer tokens in memory instead of localStorage;
  reloading requires sign-in. Native mobile uses SecureStore. Mobile profile,
  history and notification services share the authenticated refresh-aware client.
  Mobile login accepts donor accounts only; admin/staff credentials receive portal
  guidance and the unused session is revoked. Existing non-donor sessions are
  rejected during restoration. Dashboard failures show retry/sign-in controls
  rather than fabricated blood group or eligibility information.
- Configure production HTTPS at the reverse proxy, explicit `CORS_ORIGINS`, actual
  trusted proxy addresses in `TRUST_PROXY`, real SMTP, secret management, encrypted
  database storage/backups, and appropriate retention/monitoring. These deployment
  services and policies are not created by the application code.

Upload controls were checked against [OWASP's upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
and [Multer's documentation](https://expressjs.com/en/resources/middleware/multer/).
Push configuration follows [Firebase HTTP v1 server authentication](https://firebase.google.com/docs/cloud-messaging/send/v1-api).

## Verification

The final local run passed the backend build, 223 authentication/security checks,
16 operational integration tests and 15 API client tests. The mobile type check
and all 30 mobile tests passed. Dashboard type checking, build and all seven API
tests also passed; its linter reports four existing warnings and no errors.
Headless Chrome checks passed for dashboard administration and the donor app,
including opt-in location update/removal, request response and mission actions,
notification read state, responsive layouts and persisted theme preferences.
The compiled API was also checked against `bloodlink_modelx` using the restricted
runtime login: health, admin sign-in, protected administration and logout
revocation all passed. The temporary verification API and preview were stopped.

`npm test` from `backend` runs the authentication/security integration suite,
the operational integration suite, and client regressions. Tests use randomly
named disposable PostgreSQL databases and clean them up; they do not execute
test cases against application tables. Password hashing, JWTs, PostgreSQL, HTTP,
transactions, multipart parsing and PDF generation are real. Email/push delivery
and antivirus replies are controlled test transports; live provider delivery and
physical device push have not been verified.

Operational tests cover unauthorized access, absence of read-time seeding,
matching exclusions, request/mission ownership, concurrent acceptance, stale stock
writes, idempotent donations, profile privilege escalation, document size/type and
ownership, read-state isolation, PDF expiration/reuse, reminder deduplication,
queue crash/retry/revocation handling, teammate scope, audit rollback, migration
repeatability, shared rate-limit races and clean/infected scanner responses.

Run `npm run type-check`, `npm run build`, `npm test` and `npm audit` from `backend`.
Client checks are `npm run type-check` / `npm test` in `mobile-app`, and
`npm run type-check` / `npm test` / `npm run build` in `web-dashboard`.

The backend audit reports zero known vulnerabilities after compatible dependency
patches. Compatible mobile patches removed the critical advisory, but npm still
reports 13 advisories in the Expo/configuration toolchain (2 low, 9 moderate,
2 high). npm's proposed blanket fix downgrades Expo to SDK 51, which is incompatible
with this SDK 57 project; that forced downgrade was not applied. These remaining
mobile tooling advisories need a compatible upstream SDK/tooling update. This does
not change the backend audit result, and a clean audit is not a security guarantee.
