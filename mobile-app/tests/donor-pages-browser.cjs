// Start Expo web on port 8081, then run with CHROMIUM_PATH set to Chrome or Edge.
// Synthetic API records stay in this test; no real donor responses are submitted.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
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
  window.fetch = async (input, options = {}) => {
    const url = String(input);
    if (!url.includes(':4000/api/')) return original(input, options);
    const route = new URL(url).pathname.replace('/api', '');
    const body = options.body ? JSON.parse(options.body) : {};
    window.qa.calls.push({ route, body });
    let data = {}, status = 200;
    if (route === '/requests/me') data = { donorInitials: 'KP', donorName: 'Kavindu Perera', unreadAlertsCount: window.qa.requests.length, activeCount: window.qa.mission ? 1 : 0, alerts: window.qa.requests, activeMission: window.qa.mission };
    else if (route === '/donors/banks') data = { donorInitials: 'KP', banks: window.qa.banks };
    else if (/\/requests\/\d+\/respond/.test(route)) {
      if (window.qa.failRespond) { status = 503; data = { error: 'Connection interrupted. Please try again.' }; }
      else {
        const id = route.split('/')[2], request = window.qa.requests.find(r => r.id === id);
        if (body.status === 'accepted') window.qa.mission = { id, hospitalName: request.hospitalName, unitDepartment: 'Emergency Trauma Unit', bloodGroup: request.bloodGroup, unitsNeeded: 1, estimatedArrival: '~15 mins', status: 'En Route', coordinatorName: 'Hospital Coordinator', coordinatorPhone: '+94452222261', fastPassToken: '#BL-8921', steps: [{ id: '1', title: 'Accepted Request', time: '14:10', status: 'completed' }, { id: '2', title: 'En Route to Hospital', status: 'in_progress', badgeText: 'In Progress' }, { id: '3', title: 'Arrive & Donate', status: 'upcoming', badgeText: 'Upcoming' }] };
        window.qa.requests = window.qa.requests.filter(r => r.id !== id);
        data = { success: true, message: 'Response recorded' };
      }
    } else if (route === '/donors/home') data = { donor: { name: 'Kavindu Perera', initials: 'KP', isVerified: true, bloodGroup: 'O-', rhGroup: 'O Rh-', authorityVerified: true, lastDonationDate: '15 May 2026', nextEligibleStatus: 'Available Now', qualificationInterval: 'Qualified', totalDonations: 4, monthlyGain: 1, urgentRequestsCount: 3, matchedRequestsCount: 3, unreadNotificationsCount: 3 }, emergencyMatch: null, requests: [] };
    else if (route.includes('/notify')) data = { success: true, message: 'Sent' };
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  };
}

(async () => {
  const chromium = process.env.CHROMIUM_PATH;
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
    const pending = new Map(), errors = [];
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item.reject(message.error); else item.resolve(message.result); }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value || arg.description || '').join(' '));
    };
    socket.onclose = () => { for (const item of pending.values()) item.reject(new Error('Browser connection closed')); pending.clear(); };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => { pending.delete(key); reject(new Error('Browser command timed out: ' + method)); }, 45000); pending.set(key, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id: key, method, params })); });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
    const wait = async expression => { for (let i = 0; i < 200; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(150); } throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText')); };
    const click = async label => { await evaluate(`(() => { const els = [...document.querySelectorAll('[role="button"], [role="tab"], [role="switch"], input[type="checkbox"], button')]; const el = els.find(el => el.getAttribute('aria-label') === ${JSON.stringify(label)}) || els.find(el => el.textContent.trim() === ${JSON.stringify(label)}) || els.find(el => el.textContent.includes(${JSON.stringify(label)})); if (!el) throw new Error('Missing button: ' + ${JSON.stringify(label)}); el.click(); })()`); await delay(180); };
    const fill = async (selector, value) => { await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`); await delay(150); };
    const shot = async name => { await evaluate('document.fonts.ready.then(() => true)'); await evaluate(`document.querySelector('[aria-label="Open development screen navigator"]').style.opacity = '0'`); await delay(150); const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await fs.writeFile(path.join(output, name + '.png'), Buffer.from(result.data, 'base64')); await evaluate(`document.querySelector('[aria-label="Open development screen navigator"]').style.opacity = '1'`); };
    const size = async (width, height = 844) => { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await delay(150); };
    const fits = async label => assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), `${label} fits the viewport`);
    const screen = async label => { await click('Open development screen navigator'); await click(label); };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installFixtures.toString()})(${JSON.stringify(requests)}, ${JSON.stringify(banks)})` });
    await size(390);
    await send('Page.navigate', { url: 'http://127.0.0.1:8081' });
    await wait(`document.querySelector('[aria-label="Open development screen navigator"]')`);
    await screen('14. Blood Requests');
    await wait(`document.body.innerText.includes('Sabaragamuwa General Hospital')`);
    await shot('requests-alerts'); await fits('Requests');
    await click('View details and respond to Sabaragamuwa General Hospital');
    await wait(`document.body.innerText.includes('CLINICAL REQUIREMENTS')`);
    await shot('emergency-request');
    for (const width of [320, 390, 768]) { await size(width); await fits('Emergency request'); }
    await size(390);
    await evaluate('window.qa.failRespond = true'); await click('Accept Request & Coordinate');
    await wait(`document.body.innerText.includes('Connection interrupted')`);
    assert.ok(await evaluate(`document.body.innerText.includes('CLINICAL REQUIREMENTS')`), 'A failed response keeps the detail screen open');
    await evaluate('window.qa.failRespond = false'); await click('Accept Request & Coordinate');
    await wait(`document.body.innerText.includes('ACTIVE DISPATCH MISSION')`);
    await shot('requests-active');
    await click('New Alerts'); await click('View details for Teaching Hospital Ratnapura'); await click('Unable to Donate Right Now');
    await wait(`!document.body.innerText.includes('Teaching Hospital Ratnapura')`);
    assert.equal(await evaluate(`window.qa.calls.filter(c => c.route.endsWith('/respond') && c.body.status === 'declined').length`), 1);
    console.log('PASS: Request details, failure recovery, acceptance, active mission, and decline');
    await click('Banks'); await wait(`document.body.innerText.includes('NATIONAL BLOOD NETWORK') && document.body.innerText.includes('Stock Levels at Selected Center')`);
    await shot('blood-banks');
    await click('Filter blood banks'); await click('Show only critical stock'); await click('Show 1 centers');
    await wait(`document.body.innerText.includes('Verified Blood Banks (1)')`);
    await click('View All'); await fill('[aria-label="Search blood banks"]', 'not a center');
    await wait(`document.body.innerText.includes('No centers found')`);
    await click('Clear filters'); await click('Colombo');
    await wait(`document.body.innerText.includes('National Blood Center Colombo')`);
    for (const width of [320, 390, 768]) { await size(width); await fits('Blood banks'); }
    await size(390); await click('History');
    await wait(`document.body.innerText.includes('LIFETIME IMPACT')`);
    await shot('donation-history');
    await click('Download official donor record as PDF');
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
    await click('History'); await wait(`document.body.innerText.includes('LIFETIME IMPACT')`);
    for (const width of [320, 390, 768]) { await size(width); await fits('History'); }
    await size(390);
    await click('Profile');
    await wait(`document.querySelector('[aria-label="Dark mode"]') && document.body.innerText.includes('Available to donate')`);
    assert.equal(await evaluate(`document.querySelector('[aria-label="Dark mode"]').getAttribute('aria-checked')`), 'false');
    await click('Dark mode');
    await wait(`localStorage.getItem('bloodlink.color-scheme') === 'dark' && document.documentElement.style.colorScheme === 'dark'`);
    assert.equal(await evaluate(`document.querySelector('[aria-label="Dark mode"]').getAttribute('aria-checked')`), 'true');
    assert.ok(await evaluate(`(() => {const r=document.querySelector('[aria-label="Dark mode"]').getBoundingClientRect();return r.width>=44 && r.height>=44;})()`), 'Theme control has a comfortable touch target');
    await shot('profile-dark');
    const assertTheme = async (name, dark) => {
      const card = dark ? 'rgb(21, 33, 55)' : 'rgb(255, 255, 255)';
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-testid="donor-bottom-nav"]')).backgroundColor`), card, `${name} navigation uses the selected theme`);
      assert.equal(await evaluate('document.documentElement.style.colorScheme'), dark ? 'dark' : 'light');
      await fits(name);
    };
    for (const tab of ['Home', 'Banks', 'History', 'Requests']) {
      await click(tab);
      await wait(`document.querySelector('[data-testid="donor-bottom-nav"] [role="tab"][aria-selected="true"]')?.getAttribute('aria-label')?.startsWith(${JSON.stringify(tab)})`);
      if (tab === 'Home') await wait(`document.body.innerText.includes('Kavindu Perera')`);
      if (tab === 'Banks') await wait(`document.body.innerText.includes('Stock Levels at Selected Center')`);
      if (tab === 'History') await wait(`document.body.innerText.includes('LIFETIME IMPACT')`);
      if (tab === 'Requests') await wait(`document.body.innerText.includes('District Base Hospital')`);
      await assertTheme(tab, true); await shot(tab.toLowerCase() + '-dark');
      for (const width of [320, 390, 768]) { await size(width); await fits(`${tab} dark`); }
      await size(390);
    }
    await click('View details for District Base Hospital');
    await wait(`document.body.innerText.includes('CLINICAL REQUIREMENTS')`);
    await assertTheme('Request details', true); await shot('request-details-dark');
    await click('Back to requests'); await click('Active');
    await wait(`document.body.innerText.includes('ACTIVE DISPATCH MISSION')`);
    await assertTheme('Active mission', true); await shot('active-mission-dark');
    await click('Notify Coordinator');
    await wait(`document.body.innerText.toLowerCase().includes('select status / reason:')`); await shot('coordinator-dark'); await click('Close');
    await click('Home'); await wait(`document.querySelector('[aria-label^="Notifications,"]')`);
    await evaluate(`document.querySelector('[aria-label^="Notifications,"]').click()`);
    await wait(`document.body.innerText.includes('Post-Donation Screening Report')`);
    await assertTheme('Notifications', true); await shot('notifications-dark');
    await screen('9. Login Screen'); await wait(`document.body.innerText.includes('Sign in method')`);
    assert.equal(await evaluate(`getComputedStyle([...document.querySelectorAll('div')].find(el => el.textContent === 'Sign in method')).color`), 'rgb(241, 245, 251)', 'Login text uses the selected theme');
    await shot('login-dark');
    await screen('4. Register: Step 1'); await wait(`document.body.innerText.toLowerCase().includes('personal')`); await shot('registration-dark');
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
    assert.deepEqual(errors, [], 'No runtime exceptions');
    console.log('PASS: Bank search, districts, critical-stock filter, notification filters and read state, and navigation');
    console.log('Screenshots: ' + output);
  } finally {
    if (socket) socket.close();
    browser.kill();
    const resolved = path.resolve(profile);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('bloodlink-donor-browser-')) { await delay(500); await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {}); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
