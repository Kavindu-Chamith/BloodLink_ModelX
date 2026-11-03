const fs = require('node:fs');
const path = require('node:path');

// Generated JSON is directly importable into Postman. No real credentials belong here.
function buildCollection() {
  const folders = [];
  let folder;
  const group = name => { folder = { name, item: [] }; folders.push(folder); };
  function add(name, method, route, status, { actor, body, checks = '', save = {}, binary = false, form = false, inbox = false } = {}) {
    const header = [];
    if (actor) header.push({ key: 'Authorization', value: `Bearer {{${actor}AccessToken}}` });
    if (inbox) header.push({ key: 'Authorization', value: 'Bearer {{inboxKey}}' });
    const request = { method, header, url: `${inbox ? '{{inboxUrl}}' : '{{baseUrl}}'}${route}` };
    if (form) request.body = { mode: 'formdata', formdata: [{ key: 'document', type: 'file', src: 'fixtures/verification.pdf' }] };
    else if (body !== undefined) {
      header.push({ key: 'Content-Type', value: 'application/json' });
      request.body = { mode: 'raw', raw: JSON.stringify(body), options: { raw: { language: 'json' } } };
    }
    const script = [
      `pm.test('Expected HTTP ${status}', () => pm.response.to.have.status(${status}));`,
      binary ? "pm.test('PDF response', () => { pm.expect(pm.response.headers.get('Content-Type')).to.include('application/pdf'); pm.expect(pm.response.text().slice(0, 5)).to.eql('%PDF-'); });" :
        "const data = pm.response.json(); pm.test('JSON response', () => pm.expect(typeof data).to.eql('object'));",
      ...Object.entries(save).map(([key, expression]) => `pm.test('Save ${key}', () => { const value = ${expression}; pm.expect(value).to.not.equal(undefined); pm.environment.set(${JSON.stringify(key)}, value); });`),
      checks,
    ].filter(Boolean);
    folder.item.push({ name, request, event: [{ listen: 'test', script: { type: 'text/javascript', exec: script } }] });
  }
  const get = (name, route, actor, checks = '') => add(name, 'GET', route, 200, { actor, checks });
  const post = (name, route, actor, body = {}, status = 200, extra = {}) => add(name, 'POST', route, status, { actor, body, ...extra });
  const patch = (name, route, actor, body = {}, status = 200, extra = {}) => add(name, 'PATCH', route, status, { actor, body, ...extra });
  const saveTokens = prefix => ({ [`${prefix}AccessToken`]: 'data.accessToken', [`${prefix}RefreshToken`]: 'data.refreshToken' });
  const bank = name => ({ name, type: 'bloodbank', district: 'Colombo', address: 'Synthetic Postman test address', latitude: 6.9, longitude: 79.9 });
  const login = (prefix, email, password) => post(`${prefix} login`, '/api/auth/login', null, { email, password }, 200, { save: saveTokens(prefix) });

  group('01 Public health and authentication guards');
  get('API identity', '/', null, "pm.test('API online', () => pm.expect(data.status).to.eql('online'));");
  get('Database health', '/api/health', null, "pm.test('Database connected', () => pm.expect(data.status).to.eql('ok'));");
  get('Public institution directory', '/api/donors/banks', null, "pm.test('Directory shape', () => pm.expect(data.banks).to.be.an('array'));");
  add('Unknown endpoint', 'GET', '/api/not-a-route', 404);
  add('Donor profile requires authentication', 'GET', '/api/donors/me', 401);
  add('Administration requires authentication', 'GET', '/api/admin/stats', 401);
  post('Invalid login rejected', '/api/auth/login', null, { email: '{{donorEmail}}', password: 'Incorrect!123' }, 401);
  login('admin', '{{adminEmail}}', '{{password}}');
  get('Current administrator', '/api/auth/me', 'admin', "pm.test('Administrator role', () => pm.expect(data.user.role).to.eql('admin'));");

  group('02 Donor email verification and registration');
  post('Send registration email OTP', '/api/auth/send-otp', null, { identifier: '{{donorEmail}}', type: 'email' }, 200,
    { checks: "pm.test('OTP is private', () => { pm.expect(data).to.not.have.property('otp'); pm.expect(data).to.not.have.property('devOtp'); });" });
  add('Read captured test email', 'GET', '/otp/{{donorEmail}}', 200, { inbox: true, save: { registrationOtp: 'data.otp' } });
  post('Verify registration OTP', '/api/auth/verify-otp', null, { identifier: '{{donorEmail}}', type: 'email', otp: '{{registrationOtp}}' }, 200,
    { save: { registrationToken: 'data.registrationToken' } });
  post('Register donor', '/api/auth/register', null, { email: '{{donorEmail}}', password: '{{password}}', fullName: 'SYNTHETIC Postman Donor', phone: '0771234501', nic: '199012345678', bloodGroup: 'O-', registrationToken: '{{registrationToken}}' }, 201,
    { save: { ...saveTokens('donor'), donorId: 'data.user.id' } });
  get('Current donor', '/api/auth/me', 'donor', "pm.test('Donor role', () => pm.expect(data.user.role).to.eql('donor'));");
  add('Donor cannot access admin', 'GET', '/api/admin/stats', 403, { actor: 'donor' });
  patch('Donor profile and location', '/api/donors/me', 'donor', { fullName: 'SYNTHETIC Postman Donor', phone: '0771234501', district: 'Colombo', latitude: 6.9001, longitude: 79.9001 });
  patch('Set availability', '/api/donors/me/availability', 'donor', { isAvailable: true });
  patch('Cannot self-verify blood group', '/api/donors/me', 'donor', { bloodGroupVerified: true }, 400);
  get('Donor profile', '/api/donors/me', 'donor', "pm.test('Precise location stays private', () => { pm.expect(data).to.not.have.property('latitude'); pm.expect(data).to.not.have.property('longitude'); });");

  group('03 Private verification documents and review');
  add('Upload verification with trailing slash', 'POST', '/api/donors/me/verification-documents/', 201, { actor: 'donor', form: true,
    save: { verificationId: 'data.document.id', documentPath: 'data.document.downloadPath' } });
  get('Pending donor reviews', '/api/donors/admin/pending', 'admin');
  add('Download private document as owner', 'GET', '{{documentPath}}', 200, { actor: 'donor', binary: true });
  add('Anonymous document denied', 'GET', '{{documentPath}}', 401);
  patch('Reject verification', '/api/donors/admin/{{verificationId}}/reject', 'admin', { reason: 'Synthetic review rejection for API coverage' });
  post('Resubmit owned private document', '/api/donors/submit', 'donor', { documentUrl: '{{documentPath}}', claimedBloodGroup: 'O-' }, 201,
    { save: { verificationId: 'data.verification.id' } });
  patch('Approve verification', '/api/donors/admin/{{verificationId}}/approve', 'admin');
  get('Verified profile', '/api/donors/me', 'donor', "pm.test('Verified group persisted', () => pm.expect(data.bloodGroupVerified).to.eql(true));");

  group('04 Organization and hospital staff onboarding');
  post('Hospital self-registration', '/api/organizations/register', null, { name: 'SYNTHETIC Postman Hospital', type: 'hospital' }, 201, { save: { hospitalId: 'data.organization.id' } });
  get('Pending organizations', '/api/organizations/admin/pending', 'admin');
  patch('Approve hospital', '/api/organizations/admin/{{hospitalId}}/approve', 'admin');
  post('Second hospital to reject', '/api/organizations/register', null, { name: 'SYNTHETIC Rejected Hospital', type: 'hospital' }, 201, { save: { rejectedHospitalId: 'data.organization.id' } });
  patch('Reject hospital', '/api/organizations/admin/{{rejectedHospitalId}}/reject', 'admin');
  post('Hospital staff self-registration', '/api/staff/register', null, { email: '{{hospitalEmail}}', password: '{{password}}', organizationId: '{{hospitalId}}', role: 'hospital_staff' }, 201, { save: { hospitalStaffId: 'data.user.id' } });
  get('Pending hospital staff', '/api/staff/admin/pending', 'admin');
  patch('Approve hospital staff', '/api/staff/admin/{{hospitalStaffId}}/approve', 'admin');
  post('Second hospital staff to reject', '/api/staff/register', null, { email: '{{rejectedStaffEmail}}', password: '{{password}}', organizationId: '{{hospitalId}}', role: 'hospital_staff' }, 201, { save: { rejectedStaffId: 'data.user.id' } });
  patch('Reject hospital staff', '/api/staff/admin/{{rejectedStaffId}}/reject', 'admin');
  login('hospital', '{{hospitalEmail}}', '{{password}}');
  get('Hospital overview', '/api/institution/overview', 'hospital');
  add('Hospital cannot administer network', 'GET', '/api/admin/organizations', 403, { actor: 'hospital' });

  group('05 Bank onboarding, credentials, directory and access');
  post('Create primary bank login', '/api/admin/bank-accounts', 'admin', { accountEmail: '{{bankEmail}}', password: '{{password}}' }, 201, { save: { bankAccountId: 'data.user.id' } });
  get('Bank accounts including unassigned', '/api/admin/bank-accounts', 'admin');
  post('Onboard bank with selected login', '/api/admin/blood-banks', 'admin', { ...bank('SYNTHETIC Postman Blood Bank'), accountId: '{{bankAccountId}}' }, 201, { save: { bankId: 'data.organization.id' } });
  login('bank', '{{bankEmail}}', '{{password}}');
  add('Temporary password restricts operations', 'GET', '/api/stocks', 403, { actor: 'bank' });
  post('Replace temporary password', '/api/auth/change-password', 'bank', { currentPassword: '{{password}}', password: '{{changedPassword}}', confirmPassword: '{{changedPassword}}' });
  login('bank', '{{bankEmail}}', '{{changedPassword}}');
  post('Create pending bank in directory', '/api/admin/organizations', 'admin', bank('SYNTHETIC Secondary Blood Bank'), 201, { save: { secondBankId: 'data.organization.id' } });
  patch('Approve secondary bank', '/api/organizations/admin/{{secondBankId}}/approve', 'admin');
  patch('Edit bank details', '/api/admin/organizations/{{secondBankId}}', 'admin', { ...bank('SYNTHETIC Secondary Bank Updated'), branchName: 'Synthetic branch', parentOrganizationId: '{{bankId}}' });
  post('Create secondary primary login', '/api/admin/bank-accounts', 'admin', { accountEmail: '{{secondBankEmail}}', password: '{{password}}' }, 201, { save: { secondBankAccountId: 'data.user.id' } });
  post('Assign login to existing bank', '/api/admin/blood-banks/{{secondBankId}}/account', 'admin', { accountId: '{{secondBankAccountId}}' });
  get('Network organizations', '/api/admin/organizations', 'admin');
  get('Bank details', '/api/admin/organizations/{{bankId}}', 'admin');
  get('Network overview', '/api/admin/network-overview', 'admin');
  patch('Suspend secondary institution', '/api/admin/organizations/{{secondBankId}}/access', 'admin', { isActive: false });
  patch('Reactivate secondary institution', '/api/admin/organizations/{{secondBankId}}/access', 'admin', { isActive: true });
  post('Provision staff centrally', '/api/admin/staff', 'admin', { email: '{{centralStaffEmail}}', password: '{{password}}', role: 'bloodbank_staff', organizationId: '{{bankId}}' }, 201, { save: { centralStaffId: 'data.user.id' } });
  get('Network staff', '/api/admin/staff', 'admin');
  get('User directory', '/api/admin/users', 'admin');
  patch('Suspend user', '/api/admin/users/{{centralStaffId}}/status', 'admin', { status: 'suspended' });
  patch('Reactivate user', '/api/admin/users/{{centralStaffId}}/status', 'admin', { status: 'active' });
  get('Platform statistics', '/api/admin/stats', 'admin');
  get('Audit log', '/api/admin/audit-logs?limit=100', 'admin', "pm.test('Audit history persisted', () => pm.expect(data.logs.length).to.be.above(0));");
  get('Delivery queue status', '/api/admin/delivery-status', 'admin');

  group('06 Institution stocks and teammates');
  get('Institution overview', '/api/institution/overview', 'bank');
  get('Initial eight blood stock groups', '/api/stocks', 'bank', "pm.test('Eight groups', () => pm.expect(data.stocks).to.have.lengthOf(8));");
  add('Create stock report', 'PUT', '/api/stocks/O-', 200, { actor: 'bank', body: { availableUnits: 5 }, save: { stockStamp: 'data.stock.updated_at' } });
  add('Reject stale stock update', 'PUT', '/api/stocks/O-', 409, { actor: 'bank', body: { availableUnits: 6 } });
  add('Update stock with current version', 'PUT', '/api/stocks/O-', 200, { actor: 'bank', body: { availableUnits: 12, expectedUpdatedAt: '{{stockStamp}}' }, checks: "pm.test('Derived stock status', () => pm.expect(data.stock.status).to.eql('Normal'));" });
  post('Primary login creates teammate', '/api/institution/staff', 'bank', { email: '{{teammateEmail}}', password: '{{password}}' }, 201, { save: { teammateId: 'data.user.id' } });
  get('Institution staff list', '/api/institution/staff', 'bank');
  patch('Suspend own teammate', '/api/institution/staff/{{teammateId}}/status', 'bank', { status: 'suspended' });
  patch('Reactivate own teammate', '/api/institution/staff/{{teammateId}}/status', 'bank', { status: 'active' });
  add('Donor cannot change stock', 'PUT', '/api/stocks/O-', 403, { actor: 'donor', body: { availableUnits: 100 } });

  group('07 Blood requests, approval and donor missions');
  post('Create pending blood request with blank optional details', '/api/requests', 'bank', { bloodGroup: 'O-', requiredUnits: 1, priority: 'Emergency', radiusKm: 10, reason: '', department: '' }, 201,
    { save: { requestId: 'data.request.id' }, checks: "pm.test('Approval required', () => pm.expect(data.request.approval_status).to.eql('Pending'));" });
  get('Request review queue', '/api/admin/blood-requests?approvalStatus=Pending', 'admin');
  get('Donor cannot see pending request', '/api/requests/me', 'donor', "pm.test('No pending donor alerts', () => pm.expect(data.alerts).to.have.lengthOf(0));");
  post('Pending request dispatch blocked', '/api/requests/{{requestId}}/dispatch', 'bank', {}, 409);
  patch('Super admin approves and matches donors', '/api/admin/blood-requests/{{requestId}}/review', 'admin', { decision: 'Approved' }, 200, { checks: "pm.test('Eligible donor matched', () => pm.expect(data.matchedDonors).to.eql(1));" });
  get('Institution request list', '/api/requests', 'bank');
  get('Institution request details', '/api/requests/{{requestId}}', 'bank');
  add('Other institution cannot inspect request', 'GET', '/api/requests/{{requestId}}', 404, { actor: 'hospital' });
  post('Redispatch is deduplicated', '/api/requests/{{requestId}}/dispatch', 'bank', {}, 200, { checks: "pm.test('No duplicate matches', () => pm.expect(data.matchedDonors).to.eql(0));" });
  get('Donor home', '/api/donors/home', 'donor', "pm.test('One matched request', () => pm.expect(data.donor.matchedRequestsCount).to.eql(1));");
  get('Nearby requests', '/api/donors/requests', 'donor');
  get('Donor requests alias', '/api/donors/requests/me', 'donor');
  get('Requests dashboard', '/api/requests/me', 'donor');
  post('Accept through donor alias', '/api/donors/requests/{{requestId}}/respond', 'donor', { status: 'accepted' });
  post('Send coordinator update', '/api/requests/mission/{{requestId}}/notify', 'donor', { reason: 'Synthetic test donor is on the way' });
  post('Coordinator update cooldown', '/api/requests/mission/{{requestId}}/notify', 'donor', { reason: 'Repeated test update' }, 429);
  post('Cancel active mission', '/api/requests/mission/{{requestId}}/cancel', 'donor');
  post('Accept request again', '/api/requests/{{requestId}}/respond', 'donor', { status: 'accepted' });
  post('Confirm collected donation', '/api/requests/{{requestId}}/donations', 'bank', { donorId: '{{donorId}}' }, 200, { save: { donationId: 'data.donation.id' } });
  post('Donation confirmation is idempotent', '/api/requests/{{requestId}}/donations', 'bank', { donorId: '{{donorId}}' }, 200, { checks: "pm.test('Same donation', () => pm.expect(String(data.donation.id)).to.eql(String(pm.environment.get('donationId'))));" });
  get('Fulfilled request details', '/api/requests/{{requestId}}', 'bank', "pm.test('Fulfilled automatically', () => pm.expect(data.request.status).to.eql('Fulfilled'));");
  post('Create request to cancel', '/api/requests', 'bank', { bloodGroup: 'O-', requiredUnits: 1 }, 201, { save: { cancelledRequestId: 'data.request.id' } });
  patch('Cancel pending request', '/api/requests/{{cancelledRequestId}}/status', 'bank', { status: 'Cancelled' });
  post('Create request to reject', '/api/requests', 'bank', { bloodGroup: 'O-', requiredUnits: 1 }, 201, { save: { rejectedRequestId: 'data.request.id' } });
  patch('Reject request with reason', '/api/admin/blood-requests/{{rejectedRequestId}}/review', 'admin', { decision: 'Rejected', reason: 'Synthetic rejection test' });

  group('08 History, PDFs, private health messages and notifications');
  get('Donation history', '/api/donors/me/donations', 'donor', "pm.test('Donation persisted', () => pm.expect(data.records).to.have.lengthOf(1));");
  add('Create expiring PDF link', 'GET', '/api/donors/me/donation-record', 200, { actor: 'donor', save: { pdfPath: 'data.url' } });
  add('Download donation record', 'GET', '{{pdfPath}}', 200, { binary: true });
  add('PDF link cannot be reused', 'GET', '{{pdfPath}}', 404);
  get('Health message recipients', '/api/institution/health-alerts/recipients', 'bank', "pm.test('Donor relationship established', () => pm.expect(data.donors).to.have.lengthOf(1));");
  post('Send private health message', '/api/institution/health-alerts', 'bank', { donorId: '{{donorId}}', subject: 'Synthetic follow-up', message: 'Synthetic API test message. No clinical result.' }, 201);
  get('Sent health messages', '/api/institution/health-alerts', 'bank', "pm.test('Private follow-up persisted', () => pm.expect(data.alerts).to.have.lengthOf(1));");
  add('Notification inbox', 'GET', '/api/notifications', 200, { actor: 'donor', save: { notificationId: 'data.find(n => n.hasPrivateMessage).id' }, checks: "pm.test('Health details excluded from inbox', () => pm.expect(JSON.stringify(data)).to.not.include('No clinical result.'));" });
  get('Open private health message', '/api/notifications/{{notificationId}}/health-message', 'donor', "pm.test('Private message content', () => pm.expect(data.alert.subject).to.eql('Synthetic follow-up'));");
  patch('Mark notification read', '/api/notifications/{{notificationId}}/read', 'donor');
  patch('Mark all notifications read', '/api/notifications/read-all', 'donor');
  get('Read status persisted', '/api/notifications', 'donor', "pm.test('Every notice read', () => pm.expect(data.every(n => n.isRead)).to.eql(true));");
  post('FCM registration reports disabled transport', '/api/notifications/devices', 'donor', { token: 'synthetic-device-token-not-a-real-fcm-token' }, 503);
  add('Unregister owned or absent device safely', 'DELETE', '/api/notifications/devices/00000000-0000-4000-8000-000000000000', 200, { actor: 'donor' });
  add('Invalid device ID rejected', 'DELETE', '/api/notifications/devices/not-a-uuid', 400, { actor: 'donor' });

  group('09 Password recovery, refresh and logout');
  post('Shared public registration throttle enforced', '/api/auth/register', null, {}, 429);
  post('Request password reset', '/api/auth/forgot-password', null, { email: '{{donorEmail}}' });
  add('Read queued reset email from test inbox', 'GET', '/otp/{{donorEmail}}', 200, { inbox: true, save: { resetOtp: 'data.otp' } });
  post('Verify reset email OTP', '/api/auth/verify-reset-otp', null, { email: '{{donorEmail}}', otp: '{{resetOtp}}' }, 200, { save: { resetToken: 'data.resetToken' } });
  post('Reset donor password', '/api/auth/reset-password', null, { resetToken: '{{resetToken}}', password: '{{changedPassword}}', confirmPassword: '{{changedPassword}}' });
  add('Reset revoked donor access', 'GET', '/api/auth/me', 401, { actor: 'donor' });
  login('donor', '{{donorEmail}}', '{{changedPassword}}');
  post('Rotate refresh token', '/api/auth/refresh', null, { refreshToken: '{{donorRefreshToken}}' }, 200, { save: saveTokens('donor') });
  get('Refreshed access works', '/api/auth/me', 'donor');
  post('Logout', '/api/auth/logout', null, { refreshToken: '{{donorRefreshToken}}' });
  add('Logout revoked access', 'GET', '/api/auth/me', 401, { actor: 'donor' });
  post('Logout revoked refresh', '/api/auth/refresh', null, { refreshToken: '{{donorRefreshToken}}' }, 401);

  return {
    info: { name: 'BloodLink backend complete local workflow checks', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description: 'Run with npm run test:postman or import alongside the environment from npm run test:postman:serve. Uses only a disposable local database and synthetic credentials. FCM is deliberately disabled; a 503 is expected. Email is captured by a test-only inbox outside the production API.' },
    event: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: [
      "if (pm.environment.get('isolatedRun') !== 'true' || !/^http:\\/\\/127\\.0\\.0\\.1:\\d+$/.test(pm.environment.get('baseUrl') || '')) { throw new Error('Start the disposable harness and select its generated environment.'); }",
    ] } }],
    item: folders,
  };
}
if (require.main === module) {
  const target = path.join(__dirname, 'BloodLink.postman_collection.json');
  const collection = buildCollection();
  fs.writeFileSync(target, JSON.stringify(collection, null, 2) + '\n');
  console.log(`Generated ${collection.item.reduce((sum, f) => sum + f.item.length, 0)} Postman requests.`);
}
module.exports = { buildCollection };
