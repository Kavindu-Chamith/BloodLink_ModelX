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

The donor screens use authenticated backend APIs, including profile editing and
document uploads. The separate `web-dashboard` application provides the super
admin network portal.

## UI preview

`npm run web` opens the donor app in a browser. The interface uses warm neutral
surfaces, a restrained red accent, compact navigation, natural language and fewer
repeated badges, shadows and decorative panels. Wide browser windows keep a
readable mobile column. Light and dark modes use the same layout and contrast
rules; Profile stores the appearance choice across sessions.

Welcome, sign-in, onboarding, registration and password recovery retain their
original layouts, rounded controls, strong headings and existing step sequence.
They share the dashboard's colour palette, theme preference and input focus
treatment. Sign-in retains its original crimson header and phone/email switch.

Featured cards add soft depth, tinted surfaces and static circular line work.
Dashboard labels use the existing Ionicons family for donation dates, matching,
stock, institutions and records. Selected navigation icons and availability
status have a brief lift effect. History animates only its first two records;
selecting a different institution introduces its summary again. Location,
filter, document and dashboard actions share gentle press feedback.
Short card entrances and press feedback use React Native Animated, with no new
dependencies. Only opacity and transforms animate; native builds use the native
driver. Entrances finish within 460ms and never loop. A single shared
subscription honours live reduced-motion settings
(the OS preference on Android/iOS and `prefers-reduced-motion` on web).

Home shows the donor record and matching requests. Profile and History show
recorded donations and blood-group verification; they do not estimate lives saved
or imply clinical clearance from an elapsed donation interval. Request details
separate donor acceptance from confirmed collections. The donation reference is a
reference for the institution, not a fast-pass or scannable QR credential.

Blood banks lists approved, active institutions using `/api/donors/banks`.
Search, district/blood-group filters, reported stock, phone calls and external
map directions remain connected. The directory starts with all districts and
contains no schematic map or invented marker positions. Donor distances are
available only when matching coordinates exist.

History, Notifications, Requests and Profile load through their authenticated
services. Document actions appear when the corresponding artifact is available;
missing report URLs display an availability message. Native notifications and
actual email delivery still need their external provider configuration.

The development screen switcher is hidden by default. Set
`EXPO_PUBLIC_SHOW_SCREEN_PICKER=true` only for isolated screen review and restart
Expo. It is also hidden in production. Changing screens does not bypass API
permissions.

For the browser regression suite, start an isolated preview with the screen
switcher enabled on port 8082, then run `npm run test:browser -- --review`.
Alternatively set `MOBILE_WEB_URL`; the default is `http://127.0.0.1:8081`.
Set `CHROMIUM_PATH` if Chrome/Edge is not in a detected installation path.
The suite uses synthetic API responses and an isolated browser profile. It checks
focus, sign-in/sign-out, request acceptance and decline, location permissions,
filters, notification read state, navigation, both themes and 320/390/768px
layouts. It also checks press scaling, navigation target sizing, settled/idle
motion and live reduced-motion changes. Screenshots are saved under ignored
`.qa-private/donor-pages/`.

Run `npm run type-check` and `npm test` for type, authentication, validation and
theme-contrast checks. Browser checks do not substitute for testing on physical
Android and iOS devices.
