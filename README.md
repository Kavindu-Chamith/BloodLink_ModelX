# BloodLink

BloodLink connects blood-donation outreach across a donor mobile app, an institution dashboard, and a network-administration portal.

## What is implemented

- **Donor app:** profiles, consent and availability, request browsing and responses, history, and in-app notifications.
- **Institution dashboard:** requests, stock records, donor responses, staff access, and health-alert workflows.
- **Network administration:** institution and account management, request review, and network oversight.
- **API and database:** Node.js/Express API, role-based access, PostgreSQL persistence, request lifecycle rules, audit records, and location-based outreach matching.

The current matching flow is a rule-based outreach filter using a donor's recorded blood-group label, consent, availability, and location. It is not a transfusion-compatibility calculation, medical eligibility decision, or machine-learning model. Institution staff determine suitability.

## Data and competition status

Checked-in application and import fixtures are fictional and marked `SYNTHETIC_TEST_DATA_NOT_REAL`. They support software workflows only and do not describe actual donors, blood-service demand, inventory, or population trends. No licensed real-data analysis or result is integrated in this build. The approximate town-centre coordinate provenance also needs documentation.

The repository is **not yet ready for a competition submission that requires real-data insights and a real-data demonstration**. See the [data-source and reuse review](docs/MODELX_DATA_SOURCE_REVIEW.md) and [AI/authorship disclosure](COMPETITION_DISCLOSURE.md). Do not present synthetic fixtures as real-world results.

## Run locally (Windows)

Requirements: Node.js 24.14 or later, npm, and PostgreSQL tools available on `PATH`.

```powershell
npm.cmd ci --prefix backend
npm.cmd ci --prefix web-dashboard
npm.cmd ci --prefix mobile-app
npm.cmd run setup
npm.cmd start
```

The local setup creates a private development database under ignored `.qa-private` storage. It does not include reusable account passwords in the repository. Set up or seed local accounts using the instructions in [local setup](docs/MODELX_SETUP.md). The apps are available at `http://localhost:5173` (web), `http://localhost:8081` (donor preview), and `http://localhost:4000/api/health` (API health). Stop with `npm.cmd stop`.

For manually managed PostgreSQL or mobile-device networking, follow the full [setup guide](docs/MODELX_SETUP.md). Never commit `.env` files, passwords, API keys, donor records, or uploaded documents. Share reviewer credentials through the competition's approved private channel, not this public repository.

## Repository map

| Path | Purpose |
|---|---|
| `mobile-app/` | Donor application (React Native / Expo) |
| `web-dashboard/` | Institution and network-administration portal |
| `backend/` | API, services, migrations runner, and automated checks |
| `database/` | Fresh-install schema and versioned migrations |
| `Dataset/` | Reproducible, explicitly synthetic workflow fixtures and generator |
| `docs/` | Setup, product workflows, data-source review, and contributor guidance |

## Documentation

- [Local setup](docs/MODELX_SETUP.md)
- [Request workflow](docs/REQUEST_FLOW.md)
- [Institution dashboard](docs/INSTITUTION_DASHBOARD.md)
- [Network-admin portal](docs/SUPER_ADMIN_DASHBOARD.md)
- [Synthetic fixture provenance](Dataset/README.md)
- [Data-source and reuse review](docs/MODELX_DATA_SOURCE_REVIEW.md)
- [AI/authorship disclosure](COMPETITION_DISCLOSURE.md)
- [Documentation index](docs/README.md)

## Demo account access

Passwords are deliberately not stored in README files or source control. Local admin credentials are configured in the ignored `backend/.env`. Any donor, staff, or reviewer demo credentials must be created for the target environment and shared privately with authorized reviewers. Do not use production credentials as demo accounts.

## Safety and privacy

BloodLink handles sensitive blood-group, location, and health-related information. The local synthetic fixtures contain no real donor records. This repository has not received an independent legal-compliance audit; deployment operators must assess applicable privacy, security, clinical and data-retention requirements. A recorded outreach match or donation interval reminder is not medical advice or a determination of eligibility.
