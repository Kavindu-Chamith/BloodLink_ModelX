# Local demo handoff — 3 November 2026

For the full request journey in simple English, see [REQUEST_FLOW.md](REQUEST_FLOW.md).

The local PostgreSQL database `bloodlink_modelx` contains the original donor dataset
and the supplemental records. All generated people, institutions, histories and
inventory remain explicitly synthetic. This is a working local demonstration,
not a production deployment or a source of actual emergency coverage.

## Open the applications

- Institution/admin dashboard: http://localhost:5173
- Donor application browser preview: http://localhost:8081
- API health: http://localhost:4000/api/health

The services were started during this handoff. If stopped, open three terminals:

```powershell
# Terminal 1
cd backend
npm.cmd run dev

# Terminal 2, from repository root
cd web-dashboard
npm.cmd run dev -- --host localhost

# Terminal 3, from repository root
cd mobile-app
$env:BROWSER='none'
npm.cmd run web -- --offline --port 8081
```

Keep PostgreSQL running. The mobile offline flag disables Expo's network checks,
not the application's connection to the local backend. This preview uses the
existing development configuration. Physical devices need a reachable API host.

## Credentials

Passwords are kept only in ignored local files, never in CSVs, Git or this document:

- `.qa-private/dataset-import/staff-credentials.json`: 48 institution accounts.
- `.qa-private/dataset-import/today-demo-credentials.json`: the new demo donor
  password, matching staff email, institution and request IDs.

The paired staff account is `bloodlink.staff.ins001@example.invalid`.
The donor account is `demo.today.donor@example.invalid`.
Staff must replace their temporary password on first sign-in. After changing it,
use the replacement password; the original private file is not automatically updated.
Existing administrator, donor and institution passwords were not reset.

## Suggested demonstration

1. Sign into the institution dashboard with the paired staff account and replace
   its temporary password.
2. Open Requests and select the request with reason “DEMO current-day outreach
   workflow.” It has a 48-hour response window, one requested unit and an independent
   target of five volunteers. Its ID is recorded in the donor credential file.
3. View cumulative 10/25/50 km candidate counts, outreach gaps, the freshness warning
   and response totals. The initial smoke check found 7/31/41 candidates respectively;
   these change as availability, expiry and responses change.
4. Sign into the donor preview. Inspect the synthetic profile, two historical
   donation entries, clearly labelled sample PDF and private demo message.
5. Accept the current-day request. Its response appears in the institution view.
   Send a coordinator update or cancel the mission from the donor app.
6. For a full collection demonstration, accept again after cancellation. The staff
   account can confirm one donation. This changes stock, closes the donor mission,
   updates history and applies the configured 90-day reminder rule. These are
   simulated actions. The original request can then be fulfilled once its unit
   requirement is met. Create another request through the UI if another run is needed;
   new requests require the existing super-admin review workflow.

The historical dataset was not shifted to today's clock. A separate idempotent
`npm.cmd run demo:today` command created the current-day scenario. Repeating it
returns the existing scenario; it does not silently reopen fulfilled/expired requests.
The current-day request initially expires on **5 November 2026 at 09:21 Sri Lanka
time**; consult the recorded `expiresAt` for the exact timestamp.

## Data imported and decisions applied

| Supplemental records | Imported |
| --- | ---: |
| Requests | 333 |
| Donation events | 71,097 |
| Responses | 275 |
| Institution staff | 48 |

Original donor/profile/organization/stock mappings are reused. New `request_map`,
`donation_map`, `response_map` and `staff_map` tables in `bloodlink_dataset` retain
source IDs and payloads. Original CSVs and manifests remain unchanged.

- The 47 source `closed` requests are operationally archived as `Cancelled`, with
  `source_status='closed'` and an explanatory reason. None was called fulfilled.
- Two requests marked active had expired at import. They were cancelled. Other
  requests expire through the worker, and API/matching checks reject them immediately
  even before worker cleanup. Future source requests are not activated early.
- Donor BLD005878's earliest accepted open mission, REQ00162, was retained. The later
  REQ00225 acceptance remains historical with `closed_at` set. Both raw responses
  are preserved. There are no duplicate open accepted missions.
- The 31,830 historical gaps shorter than the application's 90-day rule are flagged
  using `donations.interval_policy_review_required`. Dates were preserved; they are
  synthetic history, not evidence that a real clinical interval was appropriate.
- Historical donation import changed **zero stock unit counts**. Seventy-eight
  mock stock status labels were aligned to the existing application's fixture
  thresholds (0–2 Critical, 3–9 Low, 10+ Normal); original labels remain in source data.
- Original pre-existing business records, identities and password hashes were
  verified unchanged, ignoring newly added schema fields. Auth sessions and rate
  counters are normal runtime records and are not treated as immutable fixtures.

## Application changes

Migration 009 adds consent state/time, availability update time, city/province,
simulated-data markers, request expiry, independent outreach targets and historical
interval flags. Existing unknown consent stays unknown.

Matching, coverage and dispatch require affirmative recorded consent, availability
updated within 30 days, verified stated group, same requested group, saved location,
the application's donation interval, and no other open accepted mission. Availability
on grants outreach consent; availability off withdraws it. The Profile text explains
this. Missing, future and stale timestamps do not qualify.

Coverage is an aggregate of potential volunteers, not confirmed collections or usable
units. The current implementation uses the existing Haversine SQL distance calculation;
PostGIS is not required or claimed to have been added. Staff still assess donation
suitability. Simulated accounts/requests cannot enqueue or deliver real push messages.

## Repeatable commands

```powershell
cd backend
npm.cmd run migrate
npm.cmd run dataset:supplement            # Read-only database preflight
npm.cmd run dataset:supplement -- --apply # Identical import is a no-op
npm.cmd run demo:today                    # Separate current-time scenario
npm.cmd run test:dataset-import           # Disposable local database
npm.cmd run test:operations               # Disposable local database
```

On a new database, initialize and import the original data before the supplement.
The original importer is `npm.cmd run dataset:import -- --apply`.
The commands require local development configuration. The supplied credentials are
test-only and use non-deliverable addresses.

## Validation and recovery

Passed:
- Original and supplemental CSV validation (297,599 and 574,850 checks).
- Full-data import tests, including a forced late failure/rollback, preserved
  existing accounts, duplicate prevention, stock-unit preservation and mission conflict handling.
- 223 authentication/security checks; 23 operational tests; 15 API-client tests.
- 30 mobile unit tests; backend/mobile type checks; dashboard and backend builds.
- Institution browser tests with the real API and disposable PostgreSQL: approval,
  donor acceptance, collection, private messages, team access and 320px–desktop layouts.
- Actual local database smoke check: both logins, donor profile/history, PDF,
  private message, acceptance, cancellation and coordinator updates. Matching took
  19 ms in that run; this is one measured local result, not a performance guarantee.

Execution reports are under `.qa-private/dataset-import/`. The pre-supplement database
backup is `.qa-private/dataset-import/before-supplement.dump`. Keep both backup and
credentials private. No external notifications were sent.

Remaining external setup: real SMTP delivery, FCM credentials/device delivery,
production hosting and physical Android/iOS checks. The local demo uses the in-app
inbox and configured development email transport. No real phone/NIC identities or
auth tokens were fabricated to fill optional tables.
