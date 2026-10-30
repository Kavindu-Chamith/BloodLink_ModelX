const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/controllers/banks.controller.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function controller(query) {
  const context = { exports: {}, require: name => { assert.equal(name, '../db'); return { pool: { query } }; } };
  vm.runInNewContext(compiled, context);
  return context.exports.getBloodBanks;
}
const bank = (id, latitude, longitude) => ({ id, name: `Bank ${id}`, type: 'bloodbank', district: 'Colombo', latitude, longitude, stocks: [] });

test('bank directory returns verified active public institutions without inventing donor distances', async () => {
  const getBanks = controller(async sql => {
    assert.match(sql, /verification_status = 'approved' AND o.is_active = true/);
    return { rows: [bank(1, '6.9', '79.8')] };
  });
  let payload;
  await getBanks({}, { json: value => { payload = value; } }, error => { throw error; });
  assert.equal(payload.donorInitials, 'D');
  assert.equal(payload.banks[0].distanceKm, null);
  assert.equal(payload.banks[0].latitude, 6.9);
  assert.equal(payload.banks[0].id, '1');
});

test('bank directory calculates and sorts distances without returning donor coordinates', async () => {
  const getBanks = controller(async (sql, params) => {
    if (sql.includes('FROM donor_profiles')) {
      assert.equal(params[0], 42);
      return { rows: [{ full_name: 'Test Donor', latitude: 0, longitude: 0 }] };
    }
    return { rows: [bank(1, 0, 1), bank(2, 0, 0), bank(3, null, null)] };
  });
  let payload;
  await getBanks({ user: { id: 42 } }, { json: value => { payload = value; } }, error => { throw error; });
  assert.equal(payload.donorInitials, 'TD');
  assert.deepEqual(Array.from(payload.banks, b => b.id), ['2', '1', '3']);
  assert.equal(payload.banks[0].distanceKm, 0);
  assert.equal(payload.banks[1].distanceKm, 111.2);
  assert.equal(payload.banks[2].distanceKm, null);
  assert.deepEqual(Object.keys(payload).sort(), ['banks', 'donorInitials']);
});

test('bank query failures reach the API error handler', async () => {
  const failure = new Error('Database unavailable');
  const getBanks = controller(async () => { throw failure; });
  let received;
  await getBanks({}, { json: () => assert.fail('Must not report success') }, error => { received = error; });
  assert.equal(received, failure);
});
