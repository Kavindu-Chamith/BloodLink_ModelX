# BloodLink ModelX local copy

The folder name is `BloodLink_ModelX`; the application branding remains BloodLink.
This is an independent copy of the original BloodLink project, maintained at
[Kavindu-Chamith/BloodLink_ModelX](https://github.com/Kavindu-Chamith/BloodLink_ModelX).
The original project has not been changed. Existing source, notices, lockfiles,
and documentation have been preserved. Older documents may still mention the
original repository or machine-specific paths; use this guide for this copy.

## Included and excluded

All 194 tracked project files were copied, with these two new guides added:
`docs/MODELX_SETUP.md` and `docs/TEAMMATE_NOTIFICATIONS_TASK.md`.
The copy excludes `.git`, installed dependencies, build outputs, Expo and npm
caches, actual `.env` files, private QA artifacts, and local database backups.
The `.env.example` templates are included. No database contents were copied.

## Quick local startup (Windows)

Dependencies are installed in `backend`, `mobile-app`, and `web-dashboard`.
From the project root, run:

```powershell
npm.cmd run setup
npm.cmd start
```

Setup uses PostgreSQL's installed binaries from `PATH` to create an isolated
instance at `127.0.0.1:5433`. Its database is `bloodlink_modelx`; its data and logs
live in the ignored `.qa-private` directory. The existing PostgreSQL service and
original project's database are separate. Setup can be run again to apply pending
migrations and preserve existing admin passwords.

The dashboard is at `http://localhost:5173`, the donor browser preview at
`http://localhost:8081`, and API health at `http://localhost:4000/api/health`.
Sign into the dashboard with `ADMIN_EMAIL` and the generated `ADMIN_PASSWORD`
from `backend/.env`. Keep that file private. Signup OTP emails appear in the
backend terminal. Google Maps is optional; configure your browser key in
`web-dashboard/.env.local` to enable its embedded map.

Run `npm.cmd stop` from another terminal to stop the apps and this copy's private
database. Ctrl+C in the startup terminal stops the three apps and leaves the
database running. The database files persist.
The mobile app also advertises its Expo development URL for compatible phones on
the same network; its API address follows the Expo host automatically.

For a fresh source checkout, install dependencies before setup:

```powershell
npm.cmd ci --prefix backend
npm.cmd ci --prefix web-dashboard
npm.cmd ci --prefix mobile-app
```

The root package only provides local lifecycle commands and needs no dependency
installation. Local scripts require Windows and PostgreSQL tools on `PATH`.
They do not change an existing manually configured `backend/.env`; use the manual
instructions below if you supply your own PostgreSQL connection.

## Manual install and configuration

Open `D:\Programming\Github\BloodLink_ModelX` in your editor. Install dependencies
separately in `backend`, `mobile-app`, and `web-dashboard` using `npm.cmd ci`.
Use a Node.js version supported by each package and its lockfile.

For the backend, create a separate PostgreSQL database such as
`bloodlink_modelx`, then run these commands from `backend`:

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Edit `.env`: point `DATABASE_URL` to the NEW database and configure two distinct
JWT secrets, each at least 32 characters long. Generate each secret separately:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Follow [backend setup](../backend/README.md) for the remaining settings. For the
new empty database, run `npm.cmd run db:init`. Then run `npm.cmd run dev`.
For admin login, configure `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD`, then
run `npm.cmd run seed` against the new database. Review seed settings first.
Do not point initialization or seed commands at the original project's database.
The default backend port is 4000; stop the other local backend or change this
copy's port and corresponding client API URLs.

From `web-dashboard`:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Configure `VITE_API_URL` if the backend address changed. See the
[dashboard guide](../web-dashboard/README.md) for login and Maps configuration.

From `mobile-app`:

```powershell
npm.cmd ci
npm.cmd start
```

For an API override, set `EXPO_PUBLIC_API_URL` to the new API address before
starting Expo. On a phone, use the development computer's reachable LAN address.
Notifications currently use mock data and can be opened with the development
screen navigator without implementing notification API endpoints.

## Pulled updates synchronized on 29 October 2026

The source copy now includes the blood-request API, its routes and tests, the
mobile request integration, and `migration_006_real_blood_requests.sql`.
For an existing ModelX database, run `npm.cmd run migrate` from `backend` after
installing dependencies and checking that `DATABASE_URL` points to ModelX's own
database. A new empty database should use `npm.cmd run db:init` as above.
No database commands were run during the file synchronization.

## Teammate handoff

Send `BloodLink_ModelX_Teammate.zip`, stored next to this project folder.
It contains eight existing reference files and a development brief. It is a
focused handoff, not a standalone runnable app. Give your teammate access to
this complete baseline through this repository, or send the full
source copy separately. Do not send local credentials or installed dependencies.

Her task is notification search and an unread-only filter; see
[the task brief](TEAMMATE_NOTIFICATIONS_TASK.md). The task remains unimplemented
so she can develop, test, and commit her own changes.

## GitHub repository

The Git remote is `https://github.com/Kavindu-Chamith/BloodLink_ModelX.git`.
The initial working baseline is on `main`, preserving the repository's original
README commit. Local credentials, installed dependencies, database data, build
outputs and private QA artifacts are ignored. Fresh clones must install module
dependencies and run local setup as described above.

Preserve existing source notices and attribution. Add your teammate to this
repository so she can create her feature branch and commit her implementation.
Follow [the contribution guide](CONTRIBUTING.md) for shared integration work.

## Local checks

Run these from the project root with the private database running:

```powershell
npm.cmd --prefix backend run build
npm.cmd --prefix backend test
npm.cmd --prefix web-dashboard run build
npm.cmd --prefix web-dashboard run lint
npm.cmd --prefix web-dashboard test
npm.cmd --prefix mobile-app run type-check
npm.cmd --prefix mobile-app test
```

The backend suite creates and removes disposable test databases. It does not run
tests against the application's tables. Dashboard browser checks additionally
require `CHROMIUM_PATH`; see [dashboard testing](../web-dashboard/README.md).

## Source export verification

The export verifies SHA-256 equality of every copied source file, absence of
Git metadata and excluded local files, and the handoff archive contents.
Dependencies were not installed in this copy, and the applications were not
started or tested against a database as part of creating the copy.
