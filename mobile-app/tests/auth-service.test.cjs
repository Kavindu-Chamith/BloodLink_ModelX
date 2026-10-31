const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '../src/services/authService.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
class ApiClientError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
function loadService(api) {
  const context = { exports: {}, AbortController, setTimeout, clearTimeout, require(name) {
    assert.equal(name, './api');
    return { __esModule: true, default: api, ApiClientError };
  } };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

test('donor email and phone logins retain their session', async () => {
  const response = { user: { role: 'donor' }, accessToken: 'access', refreshToken: 'refresh' };
  const service = loadService({ async post(route) {
    assert.equal(route, '/auth/login');
    return { data: response };
  } });
  assert.equal(await service.loginWithEmail('donor@example.com', 'password'), response);
  assert.equal(await service.loginWithPhone('+94771234567', 'password'), response);
});

test('admin and staff logins are rejected and their unused sessions revoked', async () => {
  for (const role of ['admin', 'hospital_staff', 'bloodbank_staff']) {
    for (const method of ['loginWithEmail', 'loginWithPhone']) {
      let revoked = false;
      const service = loadService({ async post(route, body) {
        if (route === '/auth/login') return { data: { user: { role }, refreshToken: 'unused-session' } };
        assert.equal(route, '/auth/logout');
        assert.equal(body.refreshToken, 'unused-session');
        revoked = true;
        return { data: {} };
      } });
      await assert.rejects(service[method]('identifier', 'password'), error => error.status === 403 && /donor accounts/.test(error.message));
      assert.equal(revoked, true);
    }
  }
});

test('logout outage cannot admit a non-donor session to the donor app', async () => {
  const service = loadService({ async post(route) {
    if (route === '/auth/login') return { data: { user: { role: 'admin' }, refreshToken: 'unused-session' } };
    throw new Error('Network unavailable');
  } });
  await assert.rejects(service.loginWithEmail('admin@example.com', 'password'), /donor accounts/);
});

test('session restoration accepts donors and rejects an existing staff session', async () => {
  let user = { role: 'donor' };
  const service = loadService({ async authGet(route) {
    assert.equal(route, '/auth/me');
    return { data: { user } };
  } });
  assert.equal(await service.getMe(), user);
  user = { role: 'hospital_staff' };
  await assert.rejects(service.getMe(), error => error.status === 403);
});
