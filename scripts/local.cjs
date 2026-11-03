// Windows local development, isolated from the original BloodLink installation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');

const root = path.resolve(__dirname, '..');
const privateDir = path.join(root, '.qa-private');
const dataDir = path.join(privateDir, 'postgres');
const configPath = path.join(privateDir, 'local-config.json');
const backendDir = path.join(root, 'backend');
const envPath = path.join(backendDir, '.env');
const controlPipe = '\\\\.\\pipe\\bloodlink-modelx-' + crypto.createHash('sha256').update(root).digest('hex').slice(0, 16);

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.status})`);
}

function loadConfig() {
  if (!fs.existsSync(configPath)) throw new Error('Run npm.cmd run setup first.');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function managedDatabaseConfig() {
  if (!fs.existsSync(envPath)) throw new Error('Configure backend/.env first, or run npm.cmd run setup.');
  const env = require('../backend/node_modules/dotenv').parse(fs.readFileSync(envPath));
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required in backend/.env.');
  const connection = new URL(env.DATABASE_URL);
  if (!fs.existsSync(configPath)) return null;
  const config = loadConfig();
  const isPrivateDatabase = ['127.0.0.1', 'localhost'].includes(connection.hostname)
    && Number(connection.port || 5432) === config.port
    && connection.username === 'modelx'
    && connection.pathname === '/bloodlink_modelx';
  return isPrivateDatabase ? config : null;
}

function databaseRunning(config) {
  return spawnSync(path.join(config.pgBin, 'pg_ctl.exe'), ['-D', dataDir, 'status'], { stdio: 'ignore', windowsHide: true }).status === 0;
}

function startDatabase(config) {
  if (!databaseRunning(config)) {
    run(path.join(config.pgBin, 'pg_ctl.exe'), ['-D', dataDir, '-l', path.join(privateDir, 'postgres.log'), '-w', 'start']);
  }
}

async function available(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Port ${port} is occupied. Stop its service before starting ModelX.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

async function setup() {
  fs.mkdirSync(privateDir, { recursive: true });
  const { Pool } = require('../backend/node_modules/pg');
  const dotenv = require('../backend/node_modules/dotenv');
  let config;
  if (fs.existsSync(configPath)) {
    config = loadConfig();
  } else {
    if (fs.existsSync(envPath)) throw new Error('backend/.env already exists. Preserve it and configure your database manually.');
    const located = spawnSync('where.exe', ['pg_ctl.exe'], { encoding: 'utf8', windowsHide: true });
    if (located.status !== 0) throw new Error('Install PostgreSQL and put its bin directory on PATH.');
    const pgBin = path.dirname(located.stdout.trim().split(/\r?\n/)[0]);
    config = { pgBin, port: 5433 };
    await available(config.port);
    const databasePassword = crypto.randomBytes(32).toString('hex');
    const adminPassword = 'Mx!' + crypto.randomBytes(24).toString('base64url') + '9aA';
    const passwordFile = path.join(privateDir, 'initdb-password.txt');
    fs.writeFileSync(passwordFile, databasePassword, { mode: 0o600 });
    try {
      run(path.join(pgBin, 'initdb.exe'), ['-D', dataDir, '-U', 'modelx', '--pwfile=' + passwordFile, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C']);
    } finally {
      fs.rmSync(passwordFile, { force: true });
    }
    fs.appendFileSync(path.join(dataDir, 'postgresql.conf'), `\n# ModelX private local instance\nlisten_addresses = '127.0.0.1'\nport = ${config.port}\n`);
    let env = fs.readFileSync(path.join(backendDir, '.env.example'), 'utf8');
    const values = {
      DATABASE_URL: `postgresql://modelx:${databasePassword}@127.0.0.1:${config.port}/bloodlink_modelx`,
      JWT_ACCESS_SECRET: crypto.randomBytes(48).toString('hex'),
      JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('hex'),
      ADMIN_EMAIL: 'admin@bloodlink.lk',
      ADMIN_PASSWORD: adminPassword,
      CORS_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://127.0.0.1:8081',
    };
    for (const [key, value] of Object.entries(values)) env = env.replace(new RegExp('^' + key + '=.*$', 'm'), `${key}=${value}`);
    fs.writeFileSync(envPath, env, { mode: 0o600 });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
  startDatabase(config);
  const env = dotenv.parse(fs.readFileSync(envPath));
  const connection = new URL(env.DATABASE_URL);
  connection.pathname = '/postgres';
  const admin = new Pool({ connectionString: connection.toString(), connectionTimeoutMillis: 5000 });
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', ['bloodlink_modelx']);
    if (!exists.rowCount) await admin.query('CREATE DATABASE bloodlink_modelx');
  } finally {
    await admin.end();
  }
  const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  let initialized;
  try { initialized = (await pool.query("SELECT to_regclass('public.users') AS users")).rows[0].users; }
  finally { await pool.end(); }
  const tsNode = path.join(backendDir, 'node_modules/ts-node/register');
  run(process.execPath, ['-r', tsNode, 'src/migrate.ts', ...(initialized ? [] : ['--init'])], backendDir);
  run(process.execPath, ['-r', tsNode, 'src/seed.ts'], backendDir);
  const dashboardEnv = path.join(root, 'web-dashboard/.env.local');
  if (!fs.existsSync(dashboardEnv)) fs.copyFileSync(path.join(root, 'web-dashboard/.env.example'), dashboardEnv);
  console.log('Setup complete. Run npm.cmd start. Admin credentials are in backend/.env.');
}

async function start() {
  const config = managedDatabaseConfig();
  for (const port of [4000, 5173, 8081]) await available(port);
  if (config) startDatabase(config);
  const children = [];
  let stopping = false;
  const control = net.createServer(socket => {
    socket.end();
    shutdown();
  });
  function shutdown(code = 0) {
    if (stopping) return;
    stopping = true;
    control.close();
    for (const child of children) {
      if (child.exitCode === null) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    }
    process.exitCode = code;
  }
  control.on('error', error => { console.error(error.message); shutdown(1); });
  control.listen(controlPipe);
  const services = [
    ['backend', ['--watch', '-r', path.join(backendDir, 'node_modules/ts-node/register'), path.join(backendDir, 'src/index.ts')]],
    ['web-dashboard', [path.join(root, 'web-dashboard/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort']],
    ['mobile-app', [path.join(root, 'mobile-app/node_modules/expo/bin/cli'), 'start', '--web', '--port', '8081']],
  ];
  for (const [directory, args] of services) {
    const child = spawn(process.execPath, args, { cwd: path.join(root, directory), stdio: 'inherit', windowsHide: true });
    children.push(child);
    child.on('error', error => { console.error(error.message); shutdown(1); });
    child.on('exit', code => { if (!stopping) { console.error(`${directory} exited (${code}).`); shutdown(code || 1); } });
  }
  process.once('SIGINT', () => shutdown());
  process.once('SIGTERM', () => shutdown());
  console.log('Dashboard: http://localhost:5173 | Mobile preview: http://localhost:8081 | API: http://localhost:4000/api/health');
  console.log(config
    ? 'Press Ctrl+C to stop the apps, or run npm.cmd stop to stop the apps and private database.'
    : 'Press Ctrl+C or run npm.cmd stop to stop the apps. PostgreSQL is managed separately.');
}

async function main() {
  switch (process.argv[2]) {
    case 'setup': return setup();
    case 'start': return start();
    case 'stop': {
      const config = managedDatabaseConfig();
      await new Promise(resolve => {
        const socket = net.createConnection(controlPipe);
        socket.setTimeout(3000);
        socket.once('error', resolve);
        socket.once('close', resolve);
        socket.once('timeout', () => { socket.destroy(); resolve(); });
        socket.once('connect', () => socket.end());
      });
      if (config && databaseRunning(config)) run(path.join(config.pgBin, 'pg_ctl.exe'), ['-D', dataDir, '-m', 'fast', '-w', 'stop']);
      return;
    }
    default: throw new Error('Use setup, start, or stop.');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
