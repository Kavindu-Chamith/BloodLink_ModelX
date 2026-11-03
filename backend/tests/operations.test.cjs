const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { Pool } = require('pg');
require('dotenv').config();

test('secure operational workflows against a disposable PostgreSQL database', { timeout: 120000 }, async t => {
  const configured = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  assert.ok(configured, 'Configure TEST_DATABASE_URL or local DATABASE_URL');
  const url = new URL(configured);
  if (!process.env.TEST_DATABASE_URL) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const name = 'bloodlink_operations_' + crypto.randomBytes(8).toString('hex');
  const admin = new Pool({ connectionString: configured, connectionTimeoutMillis: 5000 });
  let pool, server, created = false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`); created = true;
    url.pathname = '/' + name;
    process.env.DATABASE_URL = url.toString();
    process.env.NODE_ENV = 'test'; process.env.EMAIL_TRANSPORT = 'console'; process.env.PUSH_TRANSPORT = 'disabled';
    process.env.RATE_LIMIT_STORE = 'memory';
    process.env.DONATION_INTERVAL_DAYS = '90';
    process.env.SEED_DEMO_DATA = 'false';
    process.env.JWT_ACCESS_SECRET = crypto.randomBytes(48).toString('hex');
    process.env.JWT_REFRESH_SECRET = crypto.randomBytes(48).toString('hex');
    pool = require('../src/db').pool;
    await require('../src/migrate').runMigrations(true);
    assert.equal((await pool.query('SELECT COUNT(*)::integer AS count FROM blood_requests')).rows[0].count, 0, 'Fresh installs must not fabricate blood requests');
    assert.equal((await pool.query("SELECT skipped FROM schema_migrations WHERE name = 'migration_006_real_blood_requests.sql'")).rows[0].skipped, true);
    const { createApp } = require('../src/app');
    const { issueTokenPair } = require('../src/services/token.service');
    const { hashPassword } = require('../src/services/password.service');
    const { createEligibilityReminders, processPushJobs } = require('../src/services/notifications.service');
    const passwordHash = await hashPassword('TestOnly!Password987');
    const org = async (name, latitude = 6.9, longitude = 79.9) => (await pool.query(`INSERT INTO organizations(name, type, verification_status, latitude, longitude)
      VALUES ($1, 'bloodbank', 'approved', $2, $3) RETURNING id`, [name, latitude, longitude])).rows[0].id;
    const orgA = await org('Test institution A'), orgB = await org('Test institution B');
    async function user(label, role = 'donor', organizationId = null, overrides = {}) {
      const row = (await pool.query(`INSERT INTO users(email, password_hash, role, organization_id) VALUES ($1, $2, $3, $4) RETURNING id`, [`${label}@example.test`, passwordHash, role, organizationId])).rows[0];
      if (role === 'donor') await pool.query(`INSERT INTO donor_profiles(user_id, full_name, blood_group, blood_group_verified, latitude, longitude)
        VALUES ($1, $2, 'O-', true, 6.9001, 79.9001)`, [row.id, label]);
      for (const [column, value] of Object.entries(overrides)) {
        assert.ok(['blood_group_verified', 'is_available', 'latitude', 'longitude', 'blood_group', 'next_eligible_date'].includes(column));
        await pool.query(`UPDATE donor_profiles SET ${column} = $1 WHERE user_id = $2`, [value, row.id]);
      }
      const pair = await issueTokenPair({ id: String(row.id), role, orgId: organizationId ? String(organizationId) : null });
      return { id: row.id, token: pair.accessToken, refreshToken: pair.refreshToken };
    }
    const donor = await user('eligible'), other = await user('other'), unverified = await user('unverified', 'donor', null, { blood_group_verified: false });
    const unavailable = await user('unavailable', 'donor', null, { is_available: false });
    const far = await user('far', 'donor', null, { latitude: 9.5 });
    const different = await user('different', 'donor', null, { blood_group: 'A+' });
    const noLocation = await user('no-location', 'donor', null, { latitude: null, longitude: null });
    const recovering = await user('recovering', 'donor', null, { next_eligible_date: '2099-01-01' });
    const staffA = await user('staff-a', 'bloodbank_staff', orgA), staffB = await user('staff-b', 'bloodbank_staff', orgB);
    const primary = await user('primary', 'bloodbank_staff', orgA), platformAdmin = await user('admin', 'admin');
    await pool.query('UPDATE users SET is_bank_account = true WHERE id = $1', [primary.id]);
    server = http.createServer(createApp());
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const limiters = require('../src/middleware/rateLimiter.middleware');
    function resetLimits() { for (const limiter of Object.values(limiters)) limiter.resetKey('127.0.0.1'); }
    async function api(route, identity, body, method = body === undefined ? 'GET' : 'POST') {
      resetLimits();
      const multipart = body instanceof FormData;
      const response = await fetch(base + route, { method, headers: { ...(identity && { Authorization: `Bearer ${identity.token}` }), ...(!multipart && body !== undefined && { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body) });
      const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
      return { status: response.status, data, headers: response.headers };
    }
    let requestId, secondRequestId;

    await t.test('optional request details accept blank forms and reject invalid values', async () => {
      for (const value of ['', '   ', null]) {
        const result = await api('/requests', staffA, { bloodGroup: 'AB+', requiredUnits: 1, reason: value, department: value });
        assert.equal(result.status, 201);
        assert.equal(result.data.request.reason, '');
        assert.equal(result.data.request.department, '');
      }
      for (const value of [false, 123, {}, '<script>', 'x'.repeat(1001)]) {
        assert.equal((await api('/requests', staffA, { bloodGroup: 'AB+', requiredUnits: 1, reason: value })).status, 400);
      }
    });

    await t.test('a hidden mission at a suspended institution does not block the next acceptance', async () => {
      const identity = await user('mission-recovery', 'donor', null, { blood_group: 'AB+' });
      const suspendedOrg = await org('Mission recovery institution');
      const suspendedStaff = await user('mission-recovery-staff', 'bloodbank_staff', suspendedOrg);
      const createApproved = async staff => {
        const result = await api('/requests', staff, { bloodGroup: 'AB+', requiredUnits: 1 });
        assert.equal(result.status, 201);
        const id = result.data.request.id;
        assert.equal((await api(`/admin/blood-requests/${id}/review`, platformAdmin, { decision: 'Approved' }, 'PATCH')).status, 200);
        return id;
      };
      const oldId = await createApproved(suspendedStaff), nextId = await createApproved(staffA);
      assert.equal((await api(`/requests/${oldId}/respond`, identity, { status: 'accepted' })).status, 200);
      assert.equal((await api(`/admin/organizations/${suspendedOrg}/access`, platformAdmin, { isActive: false }, 'PATCH')).status, 200);
      assert.equal((await api('/requests/me', identity)).data.activeMission, null);
      assert.equal((await api(`/requests/${nextId}/respond`, identity, { status: 'accepted' })).status, 200);
      assert.ok((await pool.query('SELECT closed_at FROM notifications WHERE request_id = $1 AND donor_id = $2', [oldId, identity.id])).rows[0].closed_at);
      assert.equal((await api(`/requests/mission/${nextId}/cancel`, identity, {})).status, 200);
    });

    await t.test('anonymous and wrong-role users cannot access donor records or mutate responses', async () => {
      for (const route of ['/donors/home', '/donors/me', '/donors/me/donations', '/requests/me', '/notifications']) assert.equal((await api(route)).status, 401, route);
      assert.equal((await api('/requests/1/respond', null, { status: 'accepted' })).status, 401);
      assert.equal((await api('/donors/home', staffA)).status, 403);
      assert.equal((await api('/donors/banks', { token: 'invalid' })).status, 401);
      const before = (await pool.query('SELECT COUNT(*)::integer AS count FROM blood_requests')).rows[0].count;
      assert.equal((await api('/requests/me', unverified)).status, 200);
      assert.equal((await pool.query('SELECT COUNT(*)::integer AS count FROM blood_requests')).rows[0].count, before, 'GET must never seed requests');
    });
    await t.test('request creation matches only verified, available, nearby donors of the requested group', async () => {
      assert.equal((await api('/requests', donor, { bloodGroup: 'O-', requiredUnits: 1 })).status, 403);
      assert.equal((await api('/requests', staffA, { bloodGroup: 'O-', requiredUnits: '1' })).status, 400);
      const result = await api('/requests', staffA, { bloodGroup: 'O-', requiredUnits: 1, priority: 'Emergency', radiusKm: 10 });
      assert.equal(result.status, 201); assert.equal(result.data.matchedDonors, 0); requestId = result.data.request.id;
      assert.equal(result.data.request.approval_status, 'Pending');
      assert.equal((await api('/requests/me', donor)).data.alerts.length, 0);
      assert.equal((await api('/donors/home', donor)).data.donor.matchedRequestsCount, 0);
      assert.equal((await api('/notifications', donor)).data.length, 0);
      for (const status of ['accepted', 'declined']) assert.equal((await api(`/requests/${requestId}/respond`, donor, { status })).status, 409);
      assert.equal((await api(`/requests/${requestId}/dispatch`, staffA, {})).status, 409);
      assert.equal((await api(`/admin/blood-requests/${requestId}/review`, staffA, { decision: 'Approved' }, 'PATCH')).status, 403);
      assert.equal((await api('/admin/blood-requests', donor)).status, 403);
      assert.ok((await api('/admin/blood-requests', platformAdmin)).data.requests.some(row => row.id === requestId));
      const approvals = await Promise.all([1, 2].map(() => api(`/admin/blood-requests/${requestId}/review`, platformAdmin, { decision: 'Approved' }, 'PATCH')));
      assert.deepEqual(approvals.map(result => result.status).sort(), [200, 409]);
      assert.equal(approvals.find(result => result.status === 200).data.matchedDonors, 2);
      const notified = (await pool.query('SELECT donor_id FROM notifications WHERE request_id = $1 ORDER BY donor_id', [requestId])).rows.map(row => row.donor_id);
      assert.deepEqual(notified, [donor.id, other.id]);
      const feed = await api('/requests/me', donor);
      assert.ok(feed.data.alerts.some(row => row.id === String(requestId)));
      assert.doesNotMatch(JSON.stringify(feed.data), /latitude|longitude|password_hash|nic/);
      assert.equal((await api('/requests/me', unverified)).data.alerts.length, 0);
      const home = await api('/donors/home', donor); assert.equal(home.data.donor.matchedRequestsCount, 1);
      assert.ok(home.data.emergencyMatch.distance.includes('km'));
      assert.equal((await api(`/requests/${requestId}`, staffB)).status, 404);
      assert.equal((await api(`/requests/${requestId}/dispatch`, staffB, {})).status, 404);
      assert.equal((await api(`/requests/${requestId}/dispatch`, staffA, {})).data.matchedDonors, 0);
      secondRequestId = (await api('/requests', staffA, { bloodGroup: 'O-', requiredUnits: 2, radiusKm: 10 })).data.request.id;
      assert.equal((await api(`/admin/blood-requests/${secondRequestId}/review`, platformAdmin, { decision: 'Approved' }, 'PATCH')).status, 200);
    });
    await t.test('rejected and cancelled pending requests never reach donors or permit dispatch', async () => {
      const rejected = (await api('/requests', staffA, { bloodGroup: 'O-', requiredUnits: 1, approval_status: 'Approved', organizationId: orgB })).data.request;
      assert.equal(rejected.organization_id, orgA); assert.equal(rejected.approval_status, 'Pending');
      assert.equal((await api(`/admin/blood-requests/${rejected.id}/review`, platformAdmin, { decision: 'Rejected' }, 'PATCH')).status, 400);
      assert.equal((await api(`/admin/blood-requests/${rejected.id}/review`, platformAdmin, { decision: 'Rejected', reason: 'Please clarify the clinical requirement' }, 'PATCH')).status, 200);
      assert.equal((await api(`/admin/blood-requests/${rejected.id}/review`, platformAdmin, { decision: 'Approved' }, 'PATCH')).status, 409);
      assert.equal((await api(`/requests/${rejected.id}/dispatch`, staffA, {})).status, 409);
      assert.equal((await api(`/requests/${rejected.id}/respond`, donor, { status: 'accepted' })).status, 409);
      assert.equal((await api(`/requests/${rejected.id}`, staffB)).status, 404);
      assert.equal((await api(`/requests/${rejected.id}`, staffA)).data.request.review_reason, 'Please clarify the clinical requirement');
      assert.equal((await pool.query('SELECT COUNT(*)::integer AS count FROM notifications WHERE request_id=$1', [rejected.id])).rows[0].count, 0);
      assert.ok(!(await api('/requests/me', donor)).data.alerts.some(row => row.id === String(rejected.id)));
      const cancelled = (await api('/requests', staffA, { bloodGroup: 'O-', requiredUnits: 1 })).data.request;
      assert.equal((await api(`/requests/${cancelled.id}/status`, staffA, { status: 'Cancelled' }, 'PATCH')).status, 200);
      assert.equal((await api(`/admin/blood-requests/${cancelled.id}/review`, platformAdmin, { decision: 'Approved' }, 'PATCH')).status, 409);
    });
    await t.test('response validation, mission ownership and concurrent acceptance are enforced', async () => {
      assert.equal((await api(`/requests/req-${requestId}/respond`, donor, { status: 'accepted' })).status, 400);
      assert.equal((await api(`/requests/${requestId}/respond`, donor, { status: 'anything' })).status, 400);
      for (const identity of [unverified, unavailable, far, different, noLocation, recovering]) assert.equal((await api(`/requests/${requestId}/respond`, identity, { status: 'accepted' })).status, 409);
      assert.equal((await api(`/requests/${requestId}/respond`, unverified, { status: 'declined' })).status, 409, 'Unmatched donors cannot invent unrelated responses');
      const outcomes = await Promise.all([requestId, secondRequestId].map(id => api(`/requests/${id}/respond`, donor, { status: 'accepted' })));
      assert.deepEqual(outcomes.map(result => result.status).sort(), [200, 409]);
      const accepted = (await pool.query("SELECT request_id FROM notifications WHERE donor_id = $1 AND response_status = 'accepted' AND closed_at IS NULL", [donor.id])).rows[0].request_id;
      if (accepted !== requestId) {
        assert.equal((await api(`/requests/mission/${accepted}/cancel`, donor, {})).status, 200);
        assert.equal((await api(`/requests/${requestId}/respond`, donor, { status: 'accepted' })).status, 200);
      }
      assert.equal((await api(`/requests/mission/${requestId}/notify`, other, { reason: 'I am delayed' })).status, 404);
      assert.equal((await api(`/requests/mission/${requestId}/cancel`, other, {})).status, 404);
      assert.equal((await api(`/requests/mission/${requestId}/notify`, donor, { reason: 'I am delayed' })).status, 200);
      assert.equal((await api(`/requests/mission/${requestId}/notify`, donor, { reason: 'Again' })).status, 429);
      const details = (await api(`/requests/${requestId}`, staffA)).data;
      assert.equal(details.messages[0].message, 'I am delayed');
      assert.doesNotMatch(JSON.stringify(details), /latitude|longitude|nic|password_hash/);
      assert.ok((await api('/requests/me', donor)).data.activeMission);
    });
    await t.test('stock updates enforce tenant access, derived status and optimistic concurrency', async () => {
      assert.equal((await api('/stocks', donor)).status, 403);
      assert.equal((await api('/stocks/O-', staffA, { availableUnits: -1 }, 'PUT')).status, 400);
      const first = await api('/stocks/O-', staffA, { availableUnits: 5 }, 'PUT');
      assert.equal(first.status, 200); assert.equal(first.data.stock.status, 'Low');
      assert.equal((await api('/stocks/O-', staffA, { availableUnits: 10 }, 'PUT')).status, 409);
      const concurrent = await Promise.all([11, 12].map(availableUnits => api('/stocks/O-', staffA, { availableUnits, expectedUpdatedAt: first.data.stock.updated_at }, 'PUT')));
      assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 409]);
      const otherStock = await api('/stocks', staffB);
      assert.equal(otherStock.data.stocks.find(row => row.blood_group === 'O-').available_units, 0);
    });
    await t.test('donation confirmation is staff-only, idempotent and atomic across history, stock and eligibility', async () => {
      assert.equal((await api(`/requests/${requestId}/status`, staffA, { status: 'Fulfilled' }, 'PATCH')).status, 409);
      assert.equal((await api(`/requests/${requestId}/donations`, donor, { donorId: donor.id })).status, 403);
      assert.equal((await api(`/requests/${requestId}/donations`, staffB, { donorId: donor.id })).status, 404);
      assert.equal((await api(`/requests/${requestId}/donations`, staffA, { donorId: donor.id, unitsDonated: 9 })).status, 400);
      const before = (await pool.query('SELECT available_units FROM blood_stocks WHERE organization_id = $1 AND blood_group = $2', [orgA, 'O-'])).rows[0].available_units;
      const outcomes = await Promise.all([1, 2].map(() => api(`/requests/${requestId}/donations`, staffA, { donorId: donor.id })));
      assert.deepEqual(outcomes.map(result => result.status), [200, 200]); assert.equal(outcomes[0].data.donation.id, outcomes[1].data.donation.id);
      assert.equal((await pool.query('SELECT COUNT(*)::integer AS count FROM donations WHERE request_id = $1', [requestId])).rows[0].count, 1);
      assert.equal((await pool.query('SELECT available_units FROM blood_stocks WHERE organization_id = $1 AND blood_group = $2', [orgA, 'O-'])).rows[0].available_units, before + 1);
      assert.equal((await api(`/requests/${requestId}`, staffA)).data.request.status, 'Fulfilled');
      assert.equal((await api('/requests/me', donor)).data.activeMission, null);
      assert.equal((await api('/donors/me/donations', donor)).data.records.length, 1);
      assert.equal((await api('/donors/me/donations', other)).data.records.length, 0);
      assert.equal((await api(`/requests/${secondRequestId}/respond`, donor, { status: 'accepted' })).status, 409);
      assert.equal((await api(`/requests/${requestId}/respond`, other, { status: 'accepted' })).status, 409);
    });
    await t.test('profile updates reject privilege and blood-group changes and keep precise location private', async () => {
      for (const body of [{ role: 'admin' }, { bloodGroup: 'A+' }, { bloodGroupVerified: true }, { nextEligibleDate: '2020-01-01' }, { latitude: true }, { latitude: 6.9 }]) assert.equal((await api('/donors/me', other, body, 'PATCH')).status, 400);
      const result = await api('/donors/me', other, { fullName: 'Updated donor', district: 'Colombo', phone: '0771234567', latitude: 0, longitude: 0 }, 'PATCH');
      assert.equal(result.status, 200); assert.equal(result.data.phone, '+94771234567'); assert.equal(result.data.district, 'Colombo');
      assert.doesNotMatch(JSON.stringify(result.data), /latitude|longitude|password_hash/);
      assert.equal((await api('/donors/me/availability', other, { isAvailable: 'true' }, 'PATCH')).status, 400);
      assert.equal((await api('/donors/me/availability', other, { isAvailable: false }, 'PATCH')).data.isAvailable, false);
      assert.equal(result.headers.get('cache-control'), 'no-store');
    });
    let documentPath;
    await t.test('document uploads enforce content/size limits, ownership and authenticated download', async () => {
      const form = (content, name = 'report.pdf', type = 'application/pdf') => { const data = new FormData(); data.append('document', new Blob([content], { type }), name); return data; };
      assert.equal((await api('/donors/me/verification-documents', null, form('%PDF-1.4\n%%EOF'))).status, 401);
      assert.equal((await api('/donors/me/verification-documents', other, form('<script>bad</script>'))).status, 400);
      assert.equal((await api('/donors/me/verification-documents', other, form('%PDF-1.4\n%%EOF', 'report.html'))).status, 400);
      const malformed = await fetch(base + '/donors/me/verification-documents', { method: 'POST', headers: { Authorization: `Bearer ${other.token}`, 'Content-Type': 'multipart/form-data; boundary=broken' }, body: '--broken\r\nInvalid header' });
      assert.equal(malformed.status, 400);
      assert.equal((await api('/donors/me/verification-documents', other, form(Buffer.alloc(5242881)))).status, 413);
      const uploaded = await api('/donors/me/verification-documents/', other, form('%PDF-1.4\n%%EOF'));
      assert.equal(uploaded.status, 201); assert.equal(uploaded.data.document.status, 'pending'); documentPath = uploaded.data.document.downloadPath.replace(/^\/api/, '');
      assert.equal((await api('/donors/me/verification-documents', other, form('%PDF-1.4\n%%EOF'))).status, 409);
      assert.equal((await api(documentPath, donor)).status, 404); assert.equal((await api(documentPath)).status, 401);
      assert.equal((await api(documentPath, staffA)).status, 403);
      const fetched = await api(documentPath, platformAdmin); assert.equal(fetched.status, 200); assert.ok(fetched.data.toString().startsWith('%PDF-'));
      assert.ok(fetched.headers.get('content-disposition').startsWith('attachment'));
      assert.equal((await api('/donors/submit', donor, { documentUrl: '/api' + documentPath, claimedBloodGroup: 'O-' })).status, 404);
    });
    await t.test('notification read state is persistent, owner-scoped and independent of donor response', async () => {
      const notifications = await api('/notifications', donor); assert.ok(notifications.data.length >= 2);
      const notification = notifications.data.find(row => row.kind === 'community_impact');
      assert.equal((await api(`/notifications/${notification.id}/read`, other, {}, 'PATCH')).status, 404);
      assert.equal((await api(`/notifications/${notification.id}/read`, donor, {}, 'PATCH')).status, 200);
      assert.equal((await api('/notifications', donor)).data.find(row => row.id === notification.id).isRead, true);
      assert.equal((await api('/notifications/read-all', donor, {}, 'PATCH')).status, 200);
      assert.ok((await api('/notifications', donor)).data.every(row => row.isRead));
      assert.equal((await api('/notifications?limit=101', donor)).status, 400);
    });
    await t.test('PDF links expire, require an active session, and can be consumed only once', async () => {
      const link = await api('/donors/me/donation-record', donor); assert.equal(link.status, 200);
      const download = await api(link.data.url.replace(/^\/api/, '')); assert.equal(download.status, 200); assert.ok(download.data.toString().startsWith('%PDF-'));
      assert.equal((await api(link.data.url.replace(/^\/api/, ''))).status, 404);
      const expiring = await api('/donors/me/donation-record', donor);
      await pool.query("UPDATE download_tickets SET expires_at = NOW() - INTERVAL '1 second'");
      assert.equal((await api(expiring.data.url.replace(/^\/api/, ''))).status, 404);
    });
    await t.test('health messages require a donation relationship and stay private to the sending bank and recipient', async () => {
      const body = { donorId: donor.id, subject: 'Follow-up appointment', message: 'Please contact our donation team\nto arrange your follow-up.' };
      assert.equal((await api('/institution/health-alerts', donor, body)).status, 403);
      assert.equal((await api('/institution/health-alerts', platformAdmin, body)).status, 403);
      assert.equal((await api('/institution/health-alerts', staffB, body)).status, 404);
      assert.equal((await api('/institution/health-alerts', staffA, { ...body, donorId: other.id })).status, 404);
      assert.ok((await api('/institution/health-alerts/recipients', staffA)).data.donors.some(d => d.id === donor.id));
      assert.equal((await api('/institution/health-alerts/recipients', staffB)).data.donors.length, 0);
      const sent = await api('/institution/health-alerts', staffA, body); assert.equal(sent.status, 201);
      assert.equal((await api('/institution/health-alerts', staffB)).data.alerts.length, 0);
      assert.equal((await api('/institution/health-alerts', staffA)).data.alerts[0].message, body.message);
      const inbox = (await api('/notifications', donor)).data;
      const notice = inbox.find(n => n.hasPrivateMessage); assert.ok(notice);
      assert.doesNotMatch(JSON.stringify(inbox), /Follow-up appointment|arrange your follow-up/);
      assert.equal((await api(`/notifications/${notice.id}/health-message`, other)).status, 404);
      assert.equal((await api(`/notifications/${notice.id}/health-message`, staffB)).status, 403);
      assert.equal((await api(`/notifications/${notice.id}/health-message`, donor)).data.alert.message, body.message);
    });
    await t.test('reminders are deduplicated and push workers recover, retry, and suppress logged-out devices', async () => {
      await pool.query("UPDATE donor_profiles SET last_donation_date = CURRENT_DATE - 100, next_eligible_date = CURRENT_DATE - 10 WHERE user_id = $1", [donor.id]);
      await pool.query('UPDATE donations SET donation_date = CURRENT_DATE - 100 WHERE donor_id = $1', [donor.id]);
      await Promise.all([createEligibilityReminders(), createEligibilityReminders()]);
      assert.equal((await pool.query("SELECT COUNT(*)::integer AS count FROM notifications WHERE donor_id = $1 AND dedupe_key LIKE 'interval:%'", [donor.id])).rows[0].count, 1);
      process.env.PUSH_TRANSPORT = 'fcm';
      const device = await api('/notifications/devices', donor, { token: 'test-device-token-at-least-20-characters' }); assert.equal(device.status, 201);
      assert.equal((await api('/notifications/devices', other, { token: 'test-device-token-at-least-20-characters' })).status, 409);
      const notification = (await pool.query("SELECT id FROM notifications WHERE donor_id = $1 AND request_id IS NULL LIMIT 1", [donor.id])).rows[0].id;
      await pool.query('INSERT INTO push_delivery_jobs(notification_id, device_id) VALUES ($1, $2)', [notification, device.data.device.id]);
      let sent = 0;
      await Promise.all([processPushJobs(async () => { sent++; }), processPushJobs(async () => { sent++; })]);
      assert.equal(sent, 1);
      await pool.query("UPDATE push_delivery_jobs SET status = 'processing', lease_until = NOW() - INTERVAL '1 second'");
      await processPushJobs(async () => { throw new Error('Simulated delivery failure'); });
      assert.equal((await pool.query('SELECT status FROM push_delivery_jobs')).rows[0].status, 'pending');
      await pool.query("UPDATE push_delivery_jobs SET next_attempt_at = NOW()");
      await processPushJobs(async () => { sent++; }); assert.equal(sent, 2);
      const closedNotice = (await pool.query(`UPDATE notifications SET closed_at = NOW()
        WHERE request_id = $1 AND donor_id = $2 RETURNING id`, [secondRequestId, donor.id])).rows[0].id;
      await pool.query('INSERT INTO push_delivery_jobs(notification_id, device_id) VALUES ($1, $2)', [closedNotice, device.data.device.id]);
      await processPushJobs(async () => assert.fail('Closed notification must not receive push'));
      assert.equal((await pool.query('SELECT status FROM push_delivery_jobs WHERE notification_id = $1', [closedNotice])).rows[0].status, 'cancelled');
      await pool.query('DELETE FROM push_delivery_jobs WHERE notification_id = $1', [closedNotice]);
      await pool.query("UPDATE push_delivery_jobs SET status = 'pending', next_attempt_at = NOW()");
      await pool.query('UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1', [donor.id]);
      await processPushJobs(async () => assert.fail('Logged-out device must not receive push'));
      assert.equal((await pool.query('SELECT status FROM push_delivery_jobs')).rows[0].status, 'cancelled');
      process.env.PUSH_TRANSPORT = 'disabled';
    });
    await t.test('only the primary institution account can provision or suspend its own teammates', async () => {
      assert.equal((await api('/institution/staff', staffA, { email: 'team@example.test', password: 'TestOnly!Password987' })).status, 403);
      const created = await api('/institution/staff', primary, { email: 'team@example.test', password: 'TestOnly!Password987', organizationId: orgB, role: 'admin' });
      assert.equal(created.status, 201); assert.equal(created.data.user.role, 'bloodbank_staff');
      assert.equal((await pool.query('SELECT organization_id FROM users WHERE id = $1', [created.data.user.id])).rows[0].organization_id, orgA);
      assert.equal((await api(`/institution/staff/${staffB.id}/status`, primary, { status: 'suspended' }, 'PATCH')).status, 404);
      assert.equal((await api(`/institution/staff/${primary.id}/status`, primary, { status: 'suspended' }, 'PATCH')).status, 404);
      assert.equal((await api(`/institution/staff/${created.data.user.id}/status`, primary, { status: 'suspended' }, 'PATCH')).status, 200);
    });
    await t.test('failed audit persistence rolls back operational writes', async () => {
      const units = (await pool.query('SELECT available_units FROM blood_stocks WHERE organization_id = $1 AND blood_group = $2', [orgA, 'O-'])).rows[0].available_units;
      const stamp = (await pool.query('SELECT updated_at FROM blood_stocks WHERE organization_id = $1 AND blood_group = $2', [orgA, 'O-'])).rows[0].updated_at;
      await pool.query(`CREATE FUNCTION reject_operation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'STOCK_UPDATED' THEN RAISE EXCEPTION 'Simulated audit outage'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER fail_operation_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_operation_audit()`);
      assert.equal((await api('/stocks/O-', staffA, { availableUnits: 100, expectedUpdatedAt: stamp.toISOString() }, 'PUT')).status, 500);
      assert.equal((await pool.query('SELECT available_units FROM blood_stocks WHERE organization_id = $1 AND blood_group = $2', [orgA, 'O-'])).rows[0].available_units, units);
      await pool.query('DROP TRIGGER fail_operation_audit ON audit_logs; DROP FUNCTION reject_operation_audit()');
    });
    await t.test('migrations rerun without changing application records', async () => {
      const before = (await pool.query('SELECT COUNT(*)::integer AS count FROM donations')).rows[0].count;
      const migrations = (await pool.query('SELECT COUNT(*)::integer AS count FROM schema_migrations')).rows[0].count;
      await require('../src/migrate').runMigrations();
      assert.equal((await pool.query('SELECT COUNT(*)::integer AS count FROM donations')).rows[0].count, before);
      assert.equal((await pool.query('SELECT COUNT(*)::integer AS count FROM schema_migrations')).rows[0].count, migrations);
    });
    await t.test('shared rate-limit counters remain atomic across API instances and windows', async () => {
      const { PostgresRateLimitStore } = require('../src/services/rateLimit.store');
      const first = new PostgresRateLimitStore('integration'), second = new PostgresRateLimitStore('integration');
      first.init({ windowMs: 60000 }); second.init({ windowMs: 60000 });
      const counts = await Promise.all(Array.from({ length: 20 }, (_, index) => (index % 2 ? first : second).increment('192.0.2.10')));
      assert.deepEqual(counts.map(row => row.totalHits).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
      assert.equal((await pool.query('SELECT key_hash FROM rate_limit_counters')).rows[0].key_hash.length, 64);
      const separate = new PostgresRateLimitStore('another-endpoint'); separate.init({ windowMs: 60000 });
      assert.equal((await separate.increment('192.0.2.10')).totalHits, 1);
      // Multiple scopes on one HTTP request are independent counters. The store
      // must expose their prefixes to express-rate-limit's duplicate-hit checks.
      const express = require('express'), { rateLimit } = require('express-rate-limit');
      const scoped = express(), warnings = [];
      const previousError = console.error;
      const scopedServer = http.createServer(scoped);
      try {
        console.error = (...args) => { warnings.push(...args); };
        scoped.use(rateLimit({ limit: 100, store: new PostgresRateLimitStore('http-general') }));
        scoped.use(rateLimit({ limit: 10, store: new PostgresRateLimitStore('http-login') }));
        scoped.get('/', (_req, res) => res.json({ ok: true }));
        await new Promise(resolve => scopedServer.listen(0, '127.0.0.1', resolve));
        const response = await fetch(`http://127.0.0.1:${scopedServer.address().port}/`);
        assert.equal(response.status, 200); await response.json();
        assert.deepEqual(warnings, [], 'Independent PostgreSQL limiter scopes must not trigger duplicate-count warnings');
      } finally {
        console.error = previousError;
        if (scopedServer.listening) await new Promise(resolve => scopedServer.close(resolve));
      }
      await pool.query("UPDATE rate_limit_counters SET reset_time = NOW() - INTERVAL '1 second'");
      assert.equal((await first.increment('192.0.2.10')).totalHits, 1);
      await first.resetKey('192.0.2.10'); assert.equal((await second.increment('192.0.2.10')).totalHits, 1);
    });
    await t.test('production document scanning fails closed and handles clean and infected scanner responses', async () => {
      const net = require('node:net'), { scanDocument } = require('../src/services/documentScan.service');
      const original = { host: process.env.CLAMAV_HOST, port: process.env.CLAMAV_PORT, mode: process.env.NODE_ENV };
      let scanner, infected = false, requests = 0;
      try {
        delete process.env.CLAMAV_HOST; process.env.NODE_ENV = 'production';
        await assert.rejects(scanDocument(Buffer.from('test')), error => error.status === 503);
        scanner = net.createServer(socket => {
          let data = Buffer.alloc(0), offset = 10;
          socket.on('data', chunk => {
            data = Buffer.concat([data, chunk]);
            if (data.length < 10) return;
            assert.equal(data.subarray(0, 10).toString(), 'zINSTREAM\0');
            while (offset + 4 <= data.length) {
              const size = data.readUInt32BE(offset);
              if (size === 0) { requests++; socket.end(infected ? 'stream: Test-Signature FOUND\0' : 'stream: OK\0'); return; }
              if (offset + 4 + size > data.length) return;
              offset += 4 + size;
            }
          });
        });
        await new Promise(resolve => scanner.listen(0, '127.0.0.1', resolve));
        process.env.CLAMAV_HOST = '127.0.0.1'; process.env.CLAMAV_PORT = String(scanner.address().port);
        await scanDocument(Buffer.alloc(100000, 65));
        infected = true;
        await assert.rejects(scanDocument(Buffer.from('test')), error => error.status === 400);
        assert.equal(requests, 2);
      } finally {
        if (scanner) await new Promise(resolve => scanner.close(resolve));
        for (const [key, value] of [['CLAMAV_HOST', original.host], ['CLAMAV_PORT', original.port], ['NODE_ENV', original.mode]]) {
          if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
      }
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
