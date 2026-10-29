const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '../src/requests/services/requestsService.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadService(api) {
  const context = {
    exports: {},
    require(name) {
      assert.equal(name, '../../services/api');
      return { api };
    },
  };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

test('request feed preserves server data instead of substituting demo records', async () => {
  const payload = { donorName: 'Test Donor', alerts: [], activeMission: null, activeCount: 0, unreadAlertsCount: 0 };
  const service = loadService({
    async authGet(endpoint) {
      assert.equal(endpoint, '/requests/me');
      return { data: payload };
    },
  });
  assert.equal(await service.fetchRequestsData(), payload);
});

test('accept and decline use authenticated requests and preserve the server result', async () => {
  const result = { success: true, message: 'Response recorded' };
  let expected;
  const service = loadService({
    async authPost(endpoint, body) {
      assert.equal(endpoint, '/requests/42/respond');
      assert.equal(body.status, expected);
      return { data: result };
    },
  });
  for (expected of ['accepted', 'declined']) {
    assert.equal(await service.respondToAlertRequest('42', expected), result);
  }
});

test('coordinator notifications and mission cancellations use the selected mission', async () => {
  const calls = [];
  const result = { success: true, message: 'Saved' };
  const service = loadService({
    async authPost(endpoint, body) {
      calls.push({ endpoint, body: JSON.parse(JSON.stringify(body)) });
      return { data: result };
    },
  });
  assert.equal(await service.notifyMissionCoordinator('17', 'Running late'), result);
  assert.equal(await service.cancelMission('17'), result);
  assert.deepEqual(calls, [
    { endpoint: '/requests/mission/17/notify', body: { reason: 'Running late' } },
    { endpoint: '/requests/mission/17/cancel', body: {} },
  ]);
});

test('API failures propagate without reporting a successful donor response', async () => {
  const failure = new Error('Request is no longer active');
  const service = loadService({
    async authGet() { throw failure; },
    async authPost() { throw failure; },
  });
  await assert.rejects(service.fetchRequestsData(), error => error === failure);
  await assert.rejects(service.respondToAlertRequest('42', 'accepted'), error => error === failure);
  await assert.rejects(service.notifyMissionCoordinator('17', 'Late'), error => error === failure);
  await assert.rejects(service.cancelMission('17'), error => error === failure);
});
