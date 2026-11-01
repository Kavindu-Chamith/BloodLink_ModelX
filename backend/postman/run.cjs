const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { Pool } = require('pg');
const { buildCollection } = require('./build-collection.cjs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const root = path.resolve(__dirname, '../..');
const serving = process.argv.includes('--serve');
const databaseName = 'bloodlink_postman_' + crypto.randomBytes(8).toString('hex');
const privateDir = path.join(root, '.qa-private', 'postman', databaseName);
const reportPath = path.join(__dirname, 'last-run.json');

// Inventory comes from mounted route declarations, not a handwritten endpoint count.
function routeInventory() {
  const mounts = {
    'auth.routes.ts': '/api/auth', 'admin.routes.ts': '/api/admin',
    'donor.routes.ts': '/api/donors', 'donorVerification.routes.ts': '/api/donors',
    'organization.routes.ts': '/api/organizations', 'staff.routes.ts': '/api/staff',
    'requests.routes.ts': '/api/requests', 'notifications.routes.ts': '/api/notifications',
    'operations.routes.ts': null,
  };
  const routes = [];
  const scan = (source, prefix) => {
    for (const match of source.matchAll(/\b(router|institutionRoutes|stockRoutes|app)\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) {
      const base = match[1] === 'stockRoutes' ? '/api/stocks' : match[1] === 'institutionRoutes' ? '/api/institution' : prefix;
      routes.push({ method: match[2].toUpperCase(), path: (base + match[3]).replace(/\/$/, '') || '/' });
    }
  };
  for (const [name, prefix] of Object.entries(mounts)) scan(fs.readFileSync(path.join(__dirname, '../src/routes', name), 'utf8'), prefix);
  scan(fs.readFileSync(path.join(__dirname, '../src/app.ts'), 'utf8'), '');
  return [...new Map(routes.map(route => [route.method + ' ' + route.path, route])).values()]
    .sort((a, b) => a.path.split(':').length - b.path.split(':').length || a.path.localeCompare(b.path));
}
function routeFor(inventory, method, pathname) {
  const parts = (pathname.replace(/\/$/, '') || '/').split('/');
  return inventory.find(route => route.method === method && route.path.split('/').length === parts.length &&
    route.path.split('/').every((part, i) => part.startsWith(':') || part.toLowerCase() === parts[i].toLowerCase()));
}
const listen = server => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
});
const close = server => !server?.listening ? Promise.resolve() : new Promise(resolve => server.close(resolve));

async function main() {
  const configured = process.env.TEST_DATABASE_URL || process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!configured) throw new Error('Configure a local database connection or explicit TEST_DATABASE_URL with CREATEDB permission.');
  const connection = new URL(configured);
  if (!process.env.TEST_DATABASE_URL && !['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname)) throw new Error('Remote tests require explicit TEST_DATABASE_URL.');
  const admin = new Pool({ connectionString: configured, connectionTimeoutMillis: 5000 });
  let pool, server, inbox, child, created = false;
  const observations = [], inventory = routeInventory();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`); created = true;
    connection.pathname = '/' + databaseName;
    Object.assign(process.env, {
      DATABASE_URL: connection.toString(), NODE_ENV: 'test', EMAIL_TRANSPORT: 'console',
      PUSH_TRANSPORT: 'disabled', RATE_LIMIT_STORE: 'memory', DONATION_INTERVAL_DAYS: '90',
      SEED_DEMO_DATA: 'false', JWT_ACCESS_SECRET: crypto.randomBytes(48).toString('hex'),
      JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('hex'),
    });
    delete process.env.TRUST_PROXY; delete process.env.CLAMAV_HOST;
    const emails = new Map();
    // Replace only email delivery. OTP creation, hashing, HTTP, SQL and transactions are real.
    require('nodemailer').createTransport = () => ({ sendMail: async message => {
      emails.set(message.to, message.text);
      return { message: JSON.stringify(message) };
    } });
    require('ts-node/register');
    pool = require('../src/db').pool;
    await require('../src/migrate').runMigrations(true);
    const password = 'Pm!' + crypto.randomBytes(18).toString('hex') + '9aA';
    const changedPassword = 'Changed!' + crypto.randomBytes(18).toString('hex') + '9aA';
    const passwordHash = await require('../src/services/password.service').hashPassword(password);
    await pool.query("INSERT INTO users(email, password_hash, role) VALUES ('admin@postman.example', $1, 'admin')", [passwordHash]);
    const app = require('../src/app').createApp();
    const { generalLimiter } = require('../src/middleware/rateLimiter.middleware');
    server = http.createServer((req, res) => {
      // This workflow exceeds the global 100-request window. Keep route-specific
      // throttles active; their expected responses are asserted by the collection.
      generalLimiter.resetKey('127.0.0.1');
      const route = routeFor(inventory, req.method, new URL(req.url, 'http://localhost').pathname);
      res.once('finish', () => observations.push({ method: req.method, route: route?.path || '[unknown endpoint]', status: res.statusCode }));
      app(req, res);
    });
    const baseUrl = await listen(server);
    const inboxKey = crypto.randomBytes(32).toString('hex');
    inbox = http.createServer(async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      if (req.headers.authorization !== `Bearer ${inboxKey}`) { res.writeHead(401); res.end('{}'); return; }
      const match = /^\/otp\/([^/]+)$/.exec(req.url);
      if (req.method !== 'GET' || !match) { res.writeHead(404); res.end('{}'); return; }
      try {
        // Deterministically drain the real email queue before reading the captured inbox.
        await require('../src/services/passwordResetDelivery.service').processPasswordResetJobs();
        const email = decodeURIComponent(match[1]);
        const otp = /code is: (\d{6})/.exec(emails.get(email) || '')?.[1];
        res.writeHead(otp ? 200 : 404); res.end(JSON.stringify(otp ? { otp } : { error: 'No captured email' }));
      } catch { res.writeHead(500); res.end('{"error":"Test inbox failed"}'); }
    });
    const inboxUrl = await listen(inbox);
    fs.mkdirSync(privateDir, { recursive: true });
    const values = {
      isolatedRun: 'true', baseUrl, inboxUrl, inboxKey, password, changedPassword,
      adminEmail: 'admin@postman.example', donorEmail: 'donor@postman.example',
      hospitalEmail: 'hospital@postman.example', rejectedStaffEmail: 'rejected@postman.example',
      bankEmail: 'bank@postman.example', secondBankEmail: 'second-bank@postman.example',
      centralStaffEmail: 'central-staff@postman.example', teammateEmail: 'teammate@postman.example',
    };
    const environmentPath = path.join(privateDir, 'isolated.postman_environment.json');
    fs.writeFileSync(environmentPath, JSON.stringify({ name: 'BloodLink disposable local testing', values: Object.entries(values).map(([key, value]) => ({ key, value, enabled: true, type: /password|key/i.test(key) ? 'secret' : 'default' })), _postman_variable_scope: 'environment' }, null, 2));
    const collection = buildCollection(), collectionPath = path.join(__dirname, 'BloodLink.postman_collection.json');
    fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2) + '\n');
    console.log(`Disposable API ready; ${inventory.length} routes inventoried, ${collection.item.reduce((sum, f) => sum + f.item.length, 0)} collection requests.`);
    if (serving) {
      console.log(`Import collection: ${collectionPath}\nImport environment: ${environmentPath}\nKeep this process open while running the collection once. Ctrl+C removes the disposable database.`);
      await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
      return;
    }
    console.log('Running installed Postman CLI with cloud reporting disabled.');
    let output = '';
    child = spawn(process.env.POSTMAN_CLI || 'postman', ['collection', 'run', collectionPath,
      '--environment', environmentPath, '--working-dir', __dirname, '--no-insecure-file-read',
      '--no-report-events', '--disable-unicode', '--timeout', '180000', '--timeout-request', '10000'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    const progress = setInterval(() => console.log(`Postman progress: ${observations.length} API responses recorded.`), 20000);
    let code;
    try {
      code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    } finally { clearInterval(progress); }
    fs.writeFileSync(path.join(privateDir, 'postman-cli.log'), output);
    const coverage = inventory.map(route => ({ ...route, responses: observations.filter(row => row.method === route.method && row.route === route.path).map(row => row.status) }));
    const missing = coverage.filter(row => !row.responses.length);
    const errors = observations.filter(row => row.status >= 500 && !(row.route === '/api/notifications/devices' && row.status === 503));
    const assertionRow = /\|\s*assertions\s*\|\s*(\d+)\s*\|\s*(\d+)/.exec(output);
    const assertions = assertionRow ? { executed: Number(assertionRow[1]), failed: Number(assertionRow[2]) } : null;
    const report = {
      generatedAt: new Date().toISOString(), runner: 'Installed Postman CLI', cloudReporting: false,
      collectionRequests: collection.item.reduce((sum, f) => sum + f.item.length, 0),
      apiRequests: observations.length, routeCount: inventory.length, coveredRoutes: coverage.length - missing.length,
      assertions, cliExitCode: code,
      passed: code === 0 && assertions !== null && assertions.executed > 0 && assertions.failed === 0 && missing.length === 0 && errors.length === 0,
      unexpectedServerErrors: errors, missingRoutes: missing, coverage,
      limits: ['Email delivered to captured test inbox, not SMTP.', 'FCM disabled: device registration intentionally returns 503; no physical-device delivery verified.', 'Global IP counter reset between requests; route-specific limiters remain active.', 'Single-process happy/negative workflows; concurrency and migration upgrade checks are in npm test.'],
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(`Postman exit: ${code}; route coverage ${report.coveredRoutes}/${report.routeCount}; unexpected server errors ${errors.length}.`);
    console.log(`Sanitized report: ${reportPath}\nPrivate CLI log: ${path.join(privateDir, 'postman-cli.log')}`);
    // Keep routine output concise. Request URLs and credentials remain in ignored artifacts.
    const summaryStart = output.lastIndexOf('|                         |');
    const summary = output.slice(summaryStart >= 0 ? summaryStart : Math.max(0, output.length - 2000));
    console.log(summary.replace(/Bearer [^\s"']+/g, 'Bearer [redacted]').replace(/\/api\/donation-records\/[a-f0-9]{64}/g, '/api/donation-records/[redacted]'));
    if (!report.passed) process.exitCode = 1;
  } finally {
    if (child && child.exitCode === null) child.kill();
    await close(server); await close(inbox);
    if (pool) await pool.end();
    if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await admin.end();
    console.log('Disposable Postman database removed.');
  }
}
main().catch(error => { console.error('Postman harness failed:', error.code || error.message); process.exitCode = 1; });
