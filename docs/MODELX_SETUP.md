# BloodLink local development setup

Use this guide to run the web dashboard, donor preview and API on Windows. Local
secrets and database files stay outside source control; start with the checked-in
`.env.example` templates and the setup commands below.

## Quick local startup (Windows)

Dependencies are installed in `backend`, `mobile-app`, and `web-dashboard`.
From the project root, run:

```powershell
npm.cmd run setup
npm.cmd start
```

Setup uses PostgreSQL's installed binaries from `PATH` to create an isolated
instance at `127.0.0.1:5433`. Its database is `bloodlink_modelx`; its data and logs
live in the ignored `.qa-private` directory. The isolated development database
is separate from any other PostgreSQL database on the machine. Setup can be run again to apply pending
migrations and preserve existing admin passwords.

The dashboard is at `http://localhost:5173`, the donor browser preview at
`http://localhost:8081`, and API health at `http://localhost:4000/api/health`.
Sign into the dashboard with `ADMIN_EMAIL` and the generated `ADMIN_PASSWORD`
from `backend/.env`. Keep that file private. Signup OTP emails appear in the
backend terminal. Google Maps is optional; configure your browser key in
`web-dashboard/.env.local` to enable its embedded map.

Run `npm.cmd stop` from another terminal to stop the apps and the isolated private
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

Open the repository root in your editor. Install dependencies separately in
`backend`, `mobile-app`, and `web-dashboard` using `npm.cmd ci`.
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
Do not point initialization or seed commands at a production or unrelated database.
The default backend port is 4000; stop any other local backend or change the
backend port and corresponding client API URLs.

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
Notifications use the authenticated API and require a signed-in account and a
running backend.

## Existing database upgrade

For an existing development database, run `npm.cmd run migrate` from `backend`
after installing dependencies and confirming `DATABASE_URL` points to the
intended database. A new empty database should use `npm.cmd run db:init` as above.

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
