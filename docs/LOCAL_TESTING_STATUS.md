# Local testing status

Updated 31 October 2026.

## Preview data loaded

Sign in to the donor app with `donor.test@example.com` and the password already
provided in this conversation. That password was preserved.

The reserved local test donor is now named **DEMO Test Donor**, with an approved
synthetic O+ document, an available status, a Colombo matching location, three
historical donations, three matched requests and test notifications. These records
are fixtures; they are not clinical evidence or real donation events.

Three approved institutions are clearly named **DEMO Colombo Hospital**,
**DEMO Colombo Blood Bank**, and **DEMO Kandy Blood Bank**. Each has eight blood
stock groups with Critical, Low and Normal examples. The Kandy institution is
outside the donor's matching radius. No real hospital phone numbers were added.
Three dedicated preview staff accounts were also created for API testing. They
cannot sign in to the donor app or the platform administrator dashboard.

`npm.cmd run seed:preview` in `backend` creates these fixtures only for a local
development database. It is an explicit command, not startup behavior. Repeating
it reports the existing fixture IDs without duplicating records or resetting
passwords. Staff passwords are generated on the first run and are not committed
or placed in audit logs. An audit entry records all inserted fixture IDs.

## What to try

1. Sign in using **Email**, open Home and Requests, and inspect the three matches.
2. Accept one request, open Active Mission, notify the coordinator and cancel the
   mission. Accepting prevents a second simultaneous mission.
3. Open Banks; search DEMO, filter Colombo/Kandy, filter a blood group, and enable
   critical-stock filtering. The stock list contains actual database fixtures.
4. Open History to see three synthetic donations; download the complete donor
   record PDF. Individual donation certificates are unavailable (see below).
5. Open Notifications; mark one read and then mark all read. Reopen to check that
   the read state persisted.
6. Edit Profile, toggle availability, change appearance, and update/remove the
   matching location. Removing location or availability intentionally removes
   matches. Restoring a position near Colombo restores geographic matches.
7. Click Sign out, cancel once, then confirm. The welcome screen should appear;
   a fresh sign-in is required to use protected APIs.

Inputs now use a subtle red focus indicator instead of nested blue outlines.
Keyboard focus remains visible. Sign-out uses an in-app dialog on web and native.
Informational/error alerts now have a web implementation. The splash animation
uses the web-supported driver and stops its animations when unmounted.
The floating development screen picker is hidden during normal use so it cannot
cover Continue or other controls. Developers can opt in by starting Expo with
`EXPO_PUBLIC_SHOW_SCREEN_PICKER=true`; it is intended for isolated UI review only.

## Features and remaining limits

| Feature | Status |
| --- | --- |
| Donor email/phone login, registration, recovery, session rotation/revocation | Implemented; real email delivery needs SMTP |
| Home, matching, request acceptance/decline, mission cancellation | Implemented through authenticated APIs |
| Coordinator messages | Persisted and available through institution API; no staff web inbox UI exists |
| Profile edit, availability, matching location, verification upload/review | Implemented; browser location needs permission and localhost/HTTPS |
| History and complete donor record PDF | Implemented and checked against the local database |
| In-app notifications and read state | Implemented and persistent |
| Admin institution/account/review workflows | Implemented in the web dashboard |
| Stocks, request creation/dispatch, donation confirmation, teammate management | Implemented and integration-tested APIs; a hospital/blood-bank operational dashboard UI has not been built |
| Individual donation certificates | No generator or issuance workflow; button is now explicitly unavailable |
| Face ID / fingerprint login | No biometric enrollment or credential flow; misleading login action is now disabled and labeled unavailable |
| Lab reports, doctor notes, health advisory attachments, honor awards | Existing display components only; no clinical report/award authoring workflow or real attachments. Demo data does not invent clinical results |
| Bank map inside the donor app | Schematic illustration; Open in Maps opens the selected actual coordinates externally. It is not a live geographic map |
| Bank calls, device share actions | Depend on the browser/device phone/share handlers. Demo institutions intentionally have no callable phone number |
| Email OTP delivery | Local console transport; real inbox delivery requires SMTP configuration |
| SMS / phone verification | No SMS provider is configured; registration verifies email, while phone login uses the stored number and password |
| Native device push | Backend FCM queue implemented; Firebase credentials, native token acquisition/platform configuration, and physical-device delivery remain outstanding |
| Antivirus | Production uploads require ClamAV; local development permits uploads without it. No live ClamAV server is configured here |
| NIC verification | No identity verification provider/workflow; never reported as verified |

These limits are separate from the UI defects fixed above. A working display
component does not imply that its clinical content or external service exists.

## Verification

Mobile type checking and all 30 mobile tests pass. API client regressions include
a refresh-versus-sign-out race: a late refresh cannot restore the signed-out
session or log out a newer session. Operational integration tests use disposable
databases, not these preview records.

Authenticated checks against the preview database verified the donor login,
approved fixture profile, three matches, three donation records, three DEMO
institutions, notifications, PDF generation, and immediate API rejection after
logout. Browser checks cover focus styling, sign-out cancellation/confirmation,
request flows, navigation, notification state and responsive light/dark layouts.

See [backend handoff](BACKEND_COMPLETION.md) for the complete API and deployment
configuration. Remaining Expo toolchain advisories are recorded there.
