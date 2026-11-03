// Start Expo with EXPO_PUBLIC_SHOW_SCREEN_PICKER=true, then run with CHROMIUM_PATH set to Chrome or Edge.
// Synthetic API records stay in this test; no real donor responses are submitted.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const clientOrigin = process.env.MOBILE_WEB_URL || (process.argv.includes('--review') ? 'http://localhost:8082' : 'http://127.0.0.1:8081');
const requests = [
  { id: '41', hospitalName: 'Sabaragamuwa General Hospital', distance: '3.2 km away', timeAgo: '10m ago', bloodGroup: 'O- Negative', unitsNeeded: 5, isUrgent: true, type: 'urgent', address: 'Hospital Road, Ratnapura', department: 'Trauma ICU', verifiedInstitution: true, acceptedDonors: 2, priority: 'Emergency', patientCase: 'Emergency trauma unit blood requirement.' },
  { id: '42', hospitalName: 'Teaching Hospital Ratnapura', distance: '4.5 km away', timeAgo: '45m ago', bloodGroup: 'O- Negative', unitsNeeded: 1, type: 'standard' },
  { id: '43', hospitalName: 'District Base Hospital', distance: '8.0 km away', timeAgo: '2h ago', bloodGroup: 'O- Negative', unitsNeeded: 1, type: 'scheduled', requirementLabel: 'O- Negative · Scheduled Drive' },
];
const stocks = [['O-', 4, 'Critical'], ['A-', 8, 'Low'], ['B+', 32, 'Normal'], ['O+', 24, 'Normal']].map(([bloodGroup, units, status]) => ({ bloodGroup, units, status, updatedAt: new Date().toISOString() }));
const banks = [
  { id: '1', name: 'Sabaragamuwa General Hospital', type: 'hospital', district: 'Ratnapura', phone: '+94452222261', address: 'Hospital Road, Ratnapura', latitude: 6.6828, longitude: 80.4034, distanceKm: 3.2, stocks },
  { id: '2', name: 'Teaching Hospital Ratnapura', type: 'hospital', district: 'Ratnapura', phone: '+94452223344', address: 'Ratnapura', distanceKm: 5.7, stocks: [{ bloodGroup: 'AB-', units: 2, status: 'Low', updatedAt: new Date().toISOString() }] },
  { id: '3', name: 'Ratnapura Blood Bank', type: 'bloodbank', district: 'Ratnapura', distanceKm: 8, stocks: [] },
  { id: '4', name: 'National Blood Center Colombo', type: 'bloodbank', district: 'Colombo', distanceKm: 85, stocks },
];

function installFixtures(requests, banks) {
  const original = window.fetch.bind(window);
  window.qa = { requests, banks, mission: null, failRespond: false, calls: [] };
  window.qa.profile = { id: '1', fullName: 'Kavindu Perera', phone: '+94771234567', district: 'Ratnapura', donorSince: '2022-12-01', bloodGroup: 'O-', isAvailable: true, hasMatchingLocation: false, totalDonations: 4, lastDonationDate: '2026-05-15', nextEligibleDate: '2026-08-13', lastDonationPlace: 'Test center', bloodGroupVerification: 'approved', nicNumber: '199812345678', nicVerified: false, document: null };
  window.qa.notifications = [
    { id: '1', kind: 'critical_need', category: 'urgent', title: 'Critical O- Blood Alert Nearby', body: 'Synthetic browser test alert.', createdAt: new Date().toISOString(), isRead: false },
    { id: '2', kind: 'lab_result', category: 'doctor', title: 'Post-Donation Screening Report', createdAt: new Date().toISOString(), isRead: false, labReport: { hemoglobin: '14.2 g/dL', infectiousDiseases: 'Negative', volumeMl: 450, allClear: true, doctorMessage: 'Synthetic browser fixture only.' } },
    { id: '3', kind: 'profile_synced', category: 'system', title: 'Donor Profile Synced', createdAt: new Date().toISOString(), isRead: false },
  ];
  window.fetch = async (input, options = {}) => {
    const url = String(input);
    if (!url.includes(':4000/api/')) return original(input, options);
    const route = new URL(url).pathname.replace('/api', '');
    const body = options.body ? JSON.parse(options.body) : {};
    window.qa.calls.push({ route, body });
    let data = {}, status = 200;
    if (route === '/auth/login') data = { user: { id: 1, role: 'donor', email: 'fixture@example.com', status: 'active' }, accessToken: 'fixture-access', refreshToken: 'fixture-refresh' };
    else if (route === '/auth/logout') data = { success: true };
    else if (route === '/donors/me' || route === '/donors/me/availability') {
      window.qa.profile = { ...window.qa.profile, ...body };
      if ('latitude' in body) window.qa.profile.hasMatchingLocation = body.latitude !== null;
      data = window.qa.profile;
    } else if (route === '/donors/me/donations') data = { donorName: 'Kavindu Perera', summary: { bloodGroup: 'O-', totalDonations: 4, totalVolumeMl: 1800 }, records: [0, 1, 2, 3].map((i) => ({ id: 'history-' + i, hospitalName: i % 2 ? 'Ratnapura Blood Bank' : 'Sabaragamuwa General Hospital', donatedAt: ['2026-05-15', '2026-01-12', '2025-09-08', '2025-05-02'][i], donationType: 'Whole blood', volumeMl: 450, status: 'verified' })) };
    else if (route === '/donors/me/donation-record') data = { url: null };
    else if (route === '/notifications') data = window.qa.notifications;
    else if (route === '/notifications/read-all') { window.qa.notifications.forEach(item => { item.isRead = true; }); data = { success: true }; }
    else if (/^\/notifications\/\d+\/read$/.test(route)) { window.qa.notifications.find(item => item.id === route.split('/')[2]).isRead = true; data = { success: true }; }
    else if (route === '/requests/me') data = { donorInitials: 'KP', donorName: 'Kavindu Perera', unreadAlertsCount: window.qa.requests.length, activeCount: window.qa.mission ? 1 : 0, alerts: window.qa.requests, activeMission: window.qa.mission };
    else if (route === '/donors/banks') data = { donorInitials: 'KP', banks: window.qa.banks };
    else if (/\/requests\/\d+\/respond/.test(route)) {
      if (window.qa.failRespond) { status = 503; data = { error: 'Connection interrupted. Please try again.' }; }
      else {
        const id = route.split('/')[2], request = window.qa.requests.find(r => r.id === id);
        if (body.status === 'accepted') window.qa.mission = { id, hospitalName: request.hospitalName, unitDepartment: 'Emergency Trauma Unit', bloodGroup: request.bloodGroup, unitsNeeded: 1, estimatedArrival: '~15 mins', status: 'En Route', coordinatorName: 'Hospital Coordinator', coordinatorPhone: '+94452222261', fastPassToken: '#BL-8921', steps: [{ id: '1', title: 'Accepted Request', time: '14:10', status: 'completed' }, { id: '2', title: 'En Route to Hospital', status: 'in_progress', badgeText: 'In Progress' }, { id: '3', title: 'Arrive & Donate', status: 'upcoming', badgeText: 'Upcoming' }] };
        window.qa.requests = window.qa.requests.filter(r => r.id !== id);
        data = { success: true, message: 'Response recorded' };
      }
    } else if (route === '/donors/home') {
      if (window.qa.failDashboard) { status = 403; data = { error: 'Insufficient permissions' }; }
      else data = { donor: { name: 'Kavindu Perera', initials: 'KP', isVerified: true, bloodGroup: 'O-', rhGroup: 'O Rh-', authorityVerified: true, lastDonationDate: '15 May 2026', nextEligibleStatus: 'Donation interval passed', qualificationInterval: '90-day donation interval', totalDonations: 4, monthlyGain: 1, urgentRequestsCount: window.qa.requests.filter(r => r.isUrgent).length, matchedRequestsCount: window.qa.requests.length, unreadNotificationsCount: window.qa.notifications.filter(n => !n.isRead).length }, emergencyMatch: null, requests: window.qa.requests.map(r => ({ id: r.id, hospitalName: r.hospitalName, bloodGroup: 'O-', priority: r.isUrgent ? 'Emergency' : 'Urgent', distance: r.distance, requiredUnits: r.unitsNeeded, status: 'available' })) };
    }
    else if (route.includes('/notify')) data = { success: true, message: 'Sent' };
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  };
}

(async () => {
  const chromium = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
  if (!chromium) throw new Error('Set CHROMIUM_PATH to an installed Chrome or Edge executable.');
  const output = path.resolve(__dirname, '../../.qa-private/donor-pages');
  await fs.mkdir(output, { recursive: true });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'bloodlink-donor-browser-'));
  const browser = spawn(chromium, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    let port;
    for (let i = 0; i < 100; i++) { const data = await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8').catch(() => ''); if (data) { port = Number(data.split('\n')[0]); break; } await delay(200); }
    assert.ok(port, 'Browser starts');
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl.replace('localhost', '127.0.0.1'));
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let id = 0;
    const pending = new Map(), errors = [], animationWarnings = [];
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item.reject(message.error); else item.resolve(message.result); }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value || arg.description || '').join(' '));
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'warning') {
        const warning = message.params.args.map(arg => arg.value || arg.description || '').join(' ');
        if (warning.includes('useNativeDriver')) animationWarnings.push(warning);
      }
    };
    socket.onclose = () => { for (const item of pending.values()) item.reject(new Error('Browser connection closed')); pending.clear(); };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => { pending.delete(key); reject(new Error('Browser command timed out: ' + method)); }, 45000); pending.set(key, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id: key, method, params })); });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
    const wait = async expression => { for (let i = 0; i < 200; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(150); } throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText')); };
    const click = async label => { await evaluate(`(() => { const els = [...document.querySelectorAll('[role="button"], [role="tab"], [role="switch"], input[type="checkbox"], button')]; const el = els.find(el => el.getAttribute('aria-label') === ${JSON.stringify(label)}) || els.find(el => el.textContent.trim() === ${JSON.stringify(label)}) || els.find(el => el.textContent.includes(${JSON.stringify(label)})); if (!el) throw new Error('Missing button: ' + ${JSON.stringify(label)}); el.click(); })()`); await delay(180); };
    const fill = async (selector, value) => {
      await wait(`document.querySelector(${JSON.stringify(selector)})`);
      await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select(); })()`);
      await send('Input.insertText', { text: value }); await delay(150);
    };
    const shot = async name => { await evaluate('document.fonts.ready.then(() => true)'); await evaluate(`document.querySelector('[aria-label="Open development screen navigator"]').style.opacity = '0'`); await delay(150); const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await fs.writeFile(path.join(output, name + '.png'), Buffer.from(result.data, 'base64')); await evaluate(`document.querySelector('[aria-label="Open development screen navigator"]').style.opacity = '1'`); };
    const size = async (width, height = 844) => { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await delay(150); };
    const fits = async label => {
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), `${label} fits the viewport`);
      assert.ok(await evaluate(`(() => { const nav = document.querySelector('[data-testid="donor-bottom-nav"]'); return !nav || [...nav.querySelectorAll('[role="tab"]')].every(tab => tab.getBoundingClientRect().width >= nav.getBoundingClientRect().width / 6); })()`), `${label} keeps evenly sized navigation targets`);
    };
    const screen = async label => { await click('Open development screen navigator'); await click(label); };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installFixtures.toString()})(${JSON.stringify(requests)}, ${JSON.stringify(banks)})` });
    await size(390);
    await send('Page.navigate', { url: clientOrigin });
    await wait(`document.querySelector('[aria-label="Open development screen navigator"]')`);
    for (const [label, expected, screenshot] of [
      ['2. Welcome', 'SMART BLOOD DONATION', 'welcome-original'],
      ['3. Onboarding Carousel', 'Smart Matching', 'onboarding-original'],
      ['4. Register: Step 1', 'Step 1 of 4', 'registration-personal'],
      ['5. Register: Step 2', 'Step 2 of 4', 'registration-blood-group'],
      ['6. Register: Step 3', 'Step 3 of 4', 'registration-verification'],
      ['7. Register: Step 4', 'Step 4 of 4', 'registration-document'],
      ['8. Registered Successfully', 'Continue', 'registration-success'],
      ['9. Login Screen', 'Sign in method', 'login-original'],
      ['10. Reset Password: Step 1', 'Reset', 'reset-email'],
      ['11. Reset Password: Step 2', 'code', 'reset-verification'],
      ['12. Reset Password: Step 3', 'password', 'reset-password'],
    ]) {
      await screen(label);
      await wait(`document.body.innerText.toLowerCase().includes(${JSON.stringify(expected.toLowerCase())})`);
      await shot(screenshot);
      for (const width of [320, 390, 768]) {
        await size(width); await fits(label);
        if (label.startsWith('5.')) {
          assert.equal(await evaluate(`new Set([...document.querySelectorAll('[aria-label^="Blood group "]')].map(el => Math.round(el.getBoundingClientRect().top))).size`), 2, 'Blood-group selection keeps its original four-by-two grid at every width');
          const nextButton = await evaluate(`(() => { const button = document.querySelector('[aria-label="Continue"]'); const rect = button?.getBoundingClientRect(); return { top: rect?.top, bottom: rect?.bottom, height: innerHeight, viewport: innerWidth }; })()`);
          assert.ok(nextButton.top >= 0 && nextButton.bottom <= nextButton.height, 'Blood-group Continue button remains visible: ' + JSON.stringify(nextButton));
        }
      }
      await size(390);
    }
    await screen('5. Register: Step 2'); await click('Blood group O-');
    await wait(`document.body.innerText.includes('O- selected')`);
    await shot('registration-blood-group-selected');
    await click('Continue'); await wait(`document.body.innerText.includes('Step 3 of 4')`);
    console.log('PASS: Original authentication layouts, registration steps, blood-group selection and recovery screens fit 320/390/768px');
    if (process.argv.includes('--auth-only')) return;
    await screen('4. Register: Step 1');
    await wait(`document.querySelector('input[placeholder="Enter your full name"]')`);
    for (const selector of ['input[placeholder="Enter your full name"]', 'input[aria-label="Sri Lankan mobile number"]', 'input[aria-label="Date of birth, year month day"]']) {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
      await delay(300);
      await wait(`document.activeElement === document.querySelector(${JSON.stringify(selector)})`);
      assert.equal(await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).outlineStyle`), 'none', 'Inputs do not have nested blue browser outlines');
      assert.notEqual(await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).boxShadow`), 'none', 'Text input keeps a visible focus indicator');
    }
    await shot('registration-focus');
    await screen('9. Login Screen'); await shot('login-light'); await click('Sign in with email');
    await fill('input[placeholder="you@email.com"]', 'fixture@example.com');
    await fill('input[placeholder="Password"]', 'FixtureOnly123!');
    await click('Sign in');
    await wait(`document.body.innerText.includes('Kavindu Perera')`);
    await shot('home-light');
    await click('Profile'); await wait(`document.body.innerText.includes('Available to donate')`);
    await click('Sign out'); await wait(`document.body.innerText.includes('Sign out of BloodLink?')`);
    await shot('sign-out-confirmation');
    await click('Cancel sign out');
    await wait(`!document.body.innerText.includes('Sign out of BloodLink?')`);
    await click('Sign out'); await click('Confirm sign out');
    await wait(`document.body.innerText.includes('Get Started') && document.body.innerText.includes('Log In')`);
    await shot('welcome-light');
    await wait(`window.qa.calls.some(call => call.route === '/auth/logout' && call.body.refreshToken === 'fixture-refresh')`);
    console.log('PASS: Form focus styling, sign-out cancellation, session revocation request and return to welcome');
    await screen('14. Blood Requests');
    await wait(`document.body.innerText.includes('Sabaragamuwa General Hospital')`);
    await shot('requests-alerts'); await fits('Requests');
    await click('View details and respond to Sabaragamuwa General Hospital');
    await wait(`document.body.innerText.includes('Request details')`);
    await shot('emergency-request');
    for (const width of [320, 390, 768]) { await size(width); await fits('Emergency request'); }
    await size(390);
    await evaluate('window.qa.failRespond = true'); await click('Accept request');
    await wait(`document.body.innerText.includes('Connection interrupted')`);
    assert.ok(await evaluate(`document.body.innerText.includes('Request details')`), 'A failed response keeps the detail screen open');
    await evaluate('window.qa.failRespond = false'); await click('Accept request');
    await wait(`document.body.innerText.includes('Your accepted request')`);
    await shot('requests-active');
    await click('New Alerts'); await click('View details for Teaching Hospital Ratnapura'); await click('Decline request');
    await wait(`!document.body.innerText.includes('Teaching Hospital Ratnapura')`);
    assert.equal(await evaluate(`window.qa.calls.filter(c => c.route.endsWith('/respond') && c.body.status === 'declined').length`), 1);
    console.log('PASS: Request details, failure recovery, acceptance, active mission, and decline');
    await click('Banks'); await wait(`document.body.innerText.includes('Find a centre') && document.body.innerText.includes('Reported stock at this centre')`);
    await shot('blood-banks');
    await click('Ratnapura'); await click('Filter blood banks'); await click('Show only critical stock'); await click('Show 1 centers');
    await wait(`document.body.innerText.includes('Institutions (1)')`);
    await click('Reset filters'); await fill('[aria-label="Search blood banks"]', 'not a center');
    await wait(`document.body.innerText.includes('No centers found')`);
    await click('Clear filters'); await click('Colombo');
    await wait(`document.body.innerText.includes('National Blood Center Colombo')`);
    for (const width of [320, 390, 768]) { await size(width); await fits('Blood banks'); }
    await size(390); await click('History');
    await wait(`document.body.innerText.includes('Your donation record')`);
    await shot('donation-history');
    await click('Download donor record as PDF');
    await wait(`document.body.innerText.includes('Your official donor record will be available')`);
    await click('Home'); await wait(`document.querySelector('[aria-label^="Notifications,"]')`);
    await evaluate(`document.querySelector('[aria-label^="Notifications,"]').click()`);
    await wait(`document.body.innerText.includes('Post-Donation Screening Report')`);
    assert.ok(await evaluate(`document.querySelector('[data-testid="notification-filters"]').getBoundingClientRect().height >= 44`), 'Notification filters remain fully visible');
    await size(390, 1200); await shot('notifications'); await fits('Notifications');
    for (const width of [320, 390, 768]) { await size(width); await fits('Notifications'); }
    await size(390);
    await click('Open lab PDF'); await wait(`document.body.innerText.includes('The lab report PDF is not available yet.')`); await click('Dismiss document message');
    await click('Doctor Reports');
    assert.equal(await evaluate(`document.body.innerText.includes('Critical O- Blood Alert Nearby')`), false);
    await click('Mark all notifications as read');
    await wait(`!document.body.innerText.includes('3 New')`);
    await click('Requests'); await wait(`document.body.innerText.includes('District Base Hospital')`);
    await click('History'); await wait(`document.body.innerText.includes('Your donation record')`);
    for (const width of [320, 390, 768]) { await size(width); await fits('History'); }
    await size(390);
    await click('Profile');
    await wait(`document.querySelector('[aria-label="Dark mode"]') && document.body.innerText.includes('Available to donate')`);
    await send('Browser.grantPermissions', { origin: clientOrigin, permissions: ['geolocation'] });
    await send('Emulation.setGeolocationOverride', { latitude: 6.912345, longitude: 79.934567, accuracy: 50 });
    await click('Update matching location');
    await wait(`document.body.innerText.includes('Your matching location has been updated.')`);
    assert.equal(await evaluate('window.qa.profile.latitude'), 6.912);
    assert.equal(await evaluate('window.qa.profile.longitude'), 79.935);
    await click('Remove matching location');
    await wait(`document.body.innerText.includes('Your matching location has been removed.')`);
    assert.equal(await evaluate('window.qa.profile.latitude'), null);
    console.log('PASS: Location is opt-in, approximate, updated through the API, and removable');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Dark mode"]').getAttribute('aria-checked')`), 'false');
    await click('Dark mode');
    await wait(`localStorage.getItem('bloodlink.color-scheme') === 'dark' && document.documentElement.style.colorScheme === 'dark'`);
    assert.equal(await evaluate(`document.querySelector('[aria-label="Dark mode"]').getAttribute('aria-checked')`), 'true');
    assert.ok(await evaluate(`(() => {const r=document.querySelector('[aria-label="Dark mode"]').getBoundingClientRect();return r.width>=44 && r.height>=44;})()`), 'Theme control has a comfortable touch target');
    await shot('profile-dark');
    const assertTheme = async (name, dark) => {
      const card = dark ? 'rgb(32, 37, 34)' : 'rgb(255, 255, 255)';
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-testid="donor-bottom-nav"]')).backgroundColor`), card, `${name} navigation uses the selected theme`);
      assert.equal(await evaluate('document.documentElement.style.colorScheme'), dark ? 'dark' : 'light');
      await fits(name);
    };
    for (const tab of ['Home', 'Banks', 'History', 'Requests']) {
      await click(tab);
      await wait(`document.querySelector('[data-testid="donor-bottom-nav"] [role="tab"][aria-selected="true"]')?.getAttribute('aria-label')?.startsWith(${JSON.stringify(tab)})`);
      if (tab === 'Home') await wait(`document.body.innerText.includes('Kavindu Perera')`);
      if (tab === 'Banks') await wait(`document.body.innerText.includes('Reported stock at this centre')`);
      if (tab === 'History') await wait(`document.body.innerText.includes('Your donation record')`);
      if (tab === 'Requests') await wait(`document.body.innerText.includes('District Base Hospital')`);
      await assertTheme(tab, true); await shot(tab.toLowerCase() + '-dark');
      for (const width of [320, 390, 768]) { await size(width); await fits(`${tab} dark`); }
      await size(390);
    }
    await click('View details for District Base Hospital');
    await wait(`document.body.innerText.includes('Request details')`);
    await assertTheme('Request details', true); await shot('request-details-dark');
    await click('Back to requests'); await click('Active');
    await wait(`document.body.innerText.includes('Your accepted request')`);
    await assertTheme('Active mission', true); await shot('active-mission-dark');
    await click('Notify Coordinator');
    await wait(`document.body.innerText.toLowerCase().includes('select status / reason:')`); await shot('coordinator-dark'); await click('Close');
    await click('Home'); await wait(`document.querySelector('[aria-label^="Notifications,"]')`);
    await evaluate(`document.querySelector('[aria-label^="Notifications,"]').click()`);
    await wait(`document.body.innerText.includes('Post-Donation Screening Report')`);
    await assertTheme('Notifications', true); await shot('notifications-dark');
    await screen('9. Login Screen'); await wait(`document.body.innerText.includes('Sign in method')`);
    assert.equal(await evaluate(`getComputedStyle([...document.querySelectorAll('div')].find(el => el.textContent === 'Sign in method')).color`), 'rgb(242, 243, 237)', 'Login text uses the selected theme');
    await shot('login-dark');
    await screen('4. Register: Step 1'); await wait(`document.body.innerText.toLowerCase().includes('personal')`); await shot('registration-dark');
    for (const [label, expected, screenshot] of [
      ['5. Register: Step 2', 'Step 2 of 4', 'registration-blood-group-dark'],
      ['6. Register: Step 3', 'Step 3 of 4', 'registration-verification-dark'],
      ['7. Register: Step 4', 'Step 4 of 4', 'registration-document-dark'],
    ]) {
      await screen(label); await wait(`document.body.innerText.includes(${JSON.stringify(expected)})`);
      await fits(label + ' dark'); await shot(screenshot);
      assert.equal(await evaluate('document.documentElement.style.colorScheme'), 'dark');
    }
    await send('Page.reload', { ignoreCache: true });
    await wait(`document.querySelector('[aria-label="Open development screen navigator"]')`);
    assert.equal(await evaluate('document.documentElement.style.colorScheme'), 'dark', 'Saved dark preference survives reload');
    await screen('15. Donor Profile'); await wait(`document.querySelector('[aria-label="Dark mode"]')`);
    assert.equal(await evaluate(`document.querySelector('[aria-label="Dark mode"]').getAttribute('aria-checked')`), 'true');
    await click('Dark mode');
    await wait(`localStorage.getItem('bloodlink.color-scheme') === 'light'`);
    await wait(`document.body.innerText.includes('Available to donate')`);
    await shot('profile-light');
    for (const tab of ['Home', 'Banks', 'History', 'Requests']) {
      await click(tab); await wait(`document.querySelector('[data-testid="donor-bottom-nav"] [role="tab"][aria-selected="true"]')?.getAttribute('aria-label')?.startsWith(${JSON.stringify(tab)})`);
      await assertTheme(tab, false);
    }
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await send('Page.reload', { ignoreCache: true });
    await wait(`document.querySelector('[aria-label="Open development screen navigator"]')`);
    assert.equal(await evaluate('document.documentElement.style.colorScheme'), 'light', 'Explicit light preference wins over a dark system setting after reload');
    console.log('PASS: Shared theme on all tabs, details, coordinator dialog, notifications, login and registration; saved preferences survive reload and system changes');
    await evaluate('window.qa.failDashboard = true');
    await screen('13. Home Dashboard');
    await wait(`document.body.innerText.includes('Your account cannot access the donor dashboard')`);
    assert.equal(await evaluate(`document.body.innerText.includes('Your donor record')`), false, 'Denied requests do not display fabricated donor eligibility');
    await evaluate('window.qa.failDashboard = false');
    await click('Try again');
    await wait(`document.body.innerText.includes('Kavindu Perera')`);
    console.log('PASS: Dashboard permission errors show account guidance and recover through retry');
    const holdHomeTab = async () => {
      const point = await evaluate(`(() => { const rect = document.querySelector('[role="tab"][aria-label="Home"]').getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; })()`);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
      await delay(220);
      const scale = await evaluate(`new DOMMatrix(getComputedStyle(document.querySelector('[role="tab"][aria-label="Home"]')).transform).a`);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
      return scale;
    };
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await delay(100);
    const pressedScale = await holdHomeTab();
    assert.ok(pressedScale < 0.995 && pressedScale >= 0.97, 'Press feedback has a restrained scale effect');
    await delay(550);
    assert.equal(await evaluate(`[...document.querySelectorAll('[data-testid="card-entrance"]')].every(el => getComputedStyle(el).opacity === '1' && new DOMMatrix(getComputedStyle(el).transform).m42 === 0)`), true, 'Entrance animations settle without retaining an offset');
    await evaluate(`(() => { window.qa.idleMotionWrites = 0; window.qa.motionObserver = new MutationObserver(records => { window.qa.idleMotionWrites += records.length; }); document.querySelectorAll('[data-testid="card-entrance"], [data-testid="icon-pop"], [data-testid="donor-bottom-nav"] [role="tab"]').forEach(el => window.qa.motionObserver.observe(el, { attributes: true, attributeFilter: ['style'] })); })()`);
    await delay(650);
    await evaluate('window.qa.motionObserver.disconnect()');
    assert.equal(await evaluate('window.qa.idleMotionWrites'), 0, 'Settled motion does not keep updating card, icon or navigation styles while idle');
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await delay(100);
    await click('History'); await wait(`document.body.innerText.includes('Recorded volume')`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-testid="card-entrance"]')).opacity`), '1', 'Reduced-motion cards remain fully visible');
    await click('Home'); await wait(`document.body.innerText.includes('Kavindu Perera')`);
    assert.equal(await holdHomeTab(), 1, 'Live reduced-motion preference disables press scaling');
    assert.equal(await evaluate(`[...document.querySelectorAll('[data-testid="icon-pop"]')].every(el => { const matrix = new DOMMatrix(getComputedStyle(el).transform); return matrix.a === 1 && matrix.m42 === 0; })`), true, 'Reduced-motion icons retain their resting size and position');
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    console.log('PASS: Press feedback, settled card entrances, idle motion and live reduced-motion preference');
    assert.deepEqual(errors, [], 'No runtime exceptions');
    assert.deepEqual(animationWarnings, [], 'Web animations do not request the native animation driver');
    console.log('PASS: Bank search, districts, critical-stock filter, notification filters and read state, and navigation');
    console.log('Screenshots: ' + output);
  } finally {
    if (socket) socket.close();
    browser.kill();
    const resolved = path.resolve(profile);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('bloodlink-donor-browser-')) { await delay(500); await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {}); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
