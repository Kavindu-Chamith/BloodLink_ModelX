# Institution dashboard and request approval

Implemented 1 November 2026. This extends the existing super admin portal with institution workspaces inspired by the supplied dashboard, stock, request and health-alert screens.

## Accounts and ownership

The super admin creates and assigns the primary bank login using the existing account-first workflow. The same sign-in page routes admins to `/admin` and hospital/bank staff to `/bank`. A mandatory temporary-password change happens before institution API access. Bank A and Bank B may both be in Ratnapura; records are scoped by the authenticated account's organization ID, never a client-selected bank or district.

The primary bank account can manage teammates. A teammate can manage operations but cannot create or suspend other staff. Only the super admin manages primary bank access and institution approval.

## New API contracts

All paths begin with `/api`; existing authentication and institution role checks apply.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/requests` | Creates a Pending request; accepts optional `reason` (1–1000 characters) and `department` (1–150). Returns zero dispatched donors until approval. |
| GET | `/admin/blood-requests` | Super admin review queue/history, with institution, author and reviewer. Optional `approvalStatus=Pending`, `Approved` or `Rejected`; at most 1000 records. |
| PATCH | `/admin/blood-requests/:id/review` | Super admin only. `decision: Approved` or `Rejected`; rejection requires `reason` (1–2000). Locks the request and atomically records approval, notification dispatch and audit. Repeated/concurrent decisions return 409. |
| GET | `/institution/overview` | Includes approved active requests, pending open requests, institution identity and stock/donation totals. |
| GET | `/institution/health-alerts` | Sending institution's private messages; at most 200 records. |
| GET | `/institution/health-alerts/recipients` | Active donors with a donation at that institution; at most 1000 recipients. |
| POST | `/institution/health-alerts` | `donorId`, `subject` (1–150), `message` (1–2000, multiline supported). Donation relationship and active recipient are checked server-side. |
| GET | `/notifications/:id/health-message` | Donor-only private message lookup by notification ID. Another donor receives 404; staff and admins receive 403. |

Blood requests keep their existing `Active` / `Fulfilled` / `Cancelled` lifecycle and gain a separate `Pending` / `Approved` / `Rejected` approval state, reviewer, timestamp and rejection reason. The bank may cancel a pending request. Rejected requests require a corrected new submission.

## Upgrade

Run `npm.cmd run migrate` from `backend` before starting the updated API. Migration 008 is included in the fresh schema and is repeatable through the migration runner. It places existing open requests into Pending review, closes their old donor missions and cancels outstanding push jobs. It preserves accounts, requests, stock and donations. After approval, matching pending notifications can be reopened; donors must explicitly respond again. Review existing open requests after upgrading.

The new table follows the restricted runtime role's existing default grants. If deploying without the provisioned default grants, rerun `npm.cmd run db:runtime` after migration. The API checks the new schema at startup and gives migration instructions if it is missing.

## Verification

Automated integration checks cover pending/rejected request invisibility, bank ownership, forged approval fields, wrong-role approval, concurrent review, rejection reasons, cancelled review, donor matching, donation confirmation and private message ownership. Browser checks exercise two banks in Ratnapura, a super admin and a donor against real API/PostgreSQL in a disposable database, plus the existing super admin browser regressions. Responsive checks cover 320, 390, 768, 1024 and 1440 pixels.

The screens report actual available units and responses. They do not invent expiry dates, donor counts, clinical results or delivery acknowledgments. Health messages are entered by institution staff; clinical screening remains with qualified staff. Native push delivery requires the existing FCM configuration and device integration.
