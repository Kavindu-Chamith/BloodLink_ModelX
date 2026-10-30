# Mobile App (React Native + TypeScript)

Run commands from `mobile-app`, with the backend running in a separate terminal
on port 4000. The repository root also provides `npm.cmd start` to launch all
three apps after [ModelX local setup](../docs/MODELX_SETUP.md).

```sh
npm ci
npm run type-check
npm start
```

Scan the QR code with a compatible Expo Go app on a phone connected to the same
network as your computer. The API client uses the Expo development host on port
4000 automatically. To override it, set `EXPO_PUBLIC_API_URL` in a local `.env`
file, for example `http://192.168.1.10:4000/api`, and restart Expo.

If Windows PowerShell reports that `npm.ps1` cannot run because scripts are
disabled, use `npm.cmd` instead:

```powershell
npm.cmd ci
npm.cmd run type-check
npm.cmd start -- --clear
```

After pulling dependency changes, install again before starting Expo. Missing
`expo-document-picker` or `react-native-safe-area-context` prevents bundling,
even when the Profile screen is not open, because it is imported at startup.

The Profile screen currently uses mock data. The Home feed and authentication use
the backend API; profile editing and document uploads still need backend
integration. The separate `web-dashboard` application provides the super admin
network portal.

## UI preview

`npm run web` opens a browser preview of the donor app. Home and Profile retain
the approved red emergency card, dark eligibility panel, paired statistics,
verification cards, and bottom navigation. Typography, text wrapping, contrast,
and touch targets are refined within that design. The Profile theme control
supports both light and dark appearances.

The appearance switch in **Profile** controls the whole mobile app, including
donor tabs, request details, dialogs, sign-in, registration and recovery forms.
The choice is saved on the device and restored when the app is reopened. Until
a preference is chosen, the app follows the device appearance. Both modes share
one palette, with readable status colors, visible keyboard focus and larger
touch targets for frequently used controls.

The development screen switcher is visible by default in Expo development mode.
Tap the **Screens** button near the bottom-right corner and select any screen
to preview it without completing preceding forms. This changes the displayed
screen; real sign-in, registration, and verification still use the backend.
For unobstructed screenshots, set `EXPO_PUBLIC_SHOW_SCREEN_PICKER=false` in the
mobile app's local `.env` and restart Expo. The switcher is hidden in production.

Requests includes New Alerts, the full request detail screen, and Active Mission.
Accepting or declining a request uses the existing API; failed responses stay on
the detail screen with a retry message. All five donor tabs are connected, and
the Home notification bell opens Notifications.

Blood Banks uses `/api/donors/banks` to list approved, active institutions and
their reported stock levels. Search, district and blood group filters, critical
stock filtering, center selection, phone calls and external map links are wired.
The in-app area overview is a schematic; **Open in Maps** opens the real location.
Distances appear when the signed-in donor and institution have saved coordinates.

History and Notifications currently retain their existing in-memory sample data.
Certificates, official donor record PDFs, lab PDFs and doctor notes need real
document URLs from their services. Missing documents display an availability message.

For browser checks, start Expo web, set `CHROMIUM_PATH` to an installed Chrome or
Edge executable, then run `npm.cmd run test:browser`. The checks use isolated
synthetic API responses and save screenshots under `.qa-private/donor-pages/`.
