const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const { parseCSV, loadDataset, importDataset } = require('../src/importDataset');

test('CSV preserves Unicode, quoted commas, quotes, multiline fields and empty values', () => {
  assert.deepEqual(parseCSV('\uFEFFid,name,note\r\n1,"සිංහල, தமிழ்","a""b\nc"\r\n2,test,\r\n'), [
    { id: '1', name: 'සිංහල, தமிழ்', note: 'a"b\nc' }, { id: '2', name: 'test', note: '' },
  ]);
  for (const text of ['id,id\n1,2', 'id,name\n1', 'id\n"unterminated', 'id\n"a"junk']) {
    assert.throws(() => parseCSV(text));
  }
});

test('full import is atomic, preserves existing accounts and is safe to repeat', async () => {
  const owner = new URL(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(owner.hostname), 'Integration test requires local PostgreSQL');
  const name = `bloodlink_dataset_test_${crypto.randomBytes(8).toString('hex')}`;
  const control = new Pool({ connectionString: owner.toString() });
  let database;
  try {
    await control.query(`CREATE DATABASE "${name}"`);
    owner.pathname = '/' + name;
    database = new Pool({ connectionString: owner.toString() });
    await database.query(fs.readFileSync(path.resolve(__dirname, '../../database/schema.sql'), 'utf8'));
    await database.query("INSERT INTO users(email,password_hash,role) VALUES('existing@example.test','untouched','admin')");
    const original = (await database.query('SELECT * FROM users')).rows;
    const dataset = loadDataset(path.resolve(__dirname, '../../Dataset'));
    const preview = await importDataset(database, dataset);
    assert.equal(preview.dryRun, true);
    assert.deepEqual((await database.query('SELECT * FROM users')).rows, original);
    assert.equal((await database.query("SELECT to_regnamespace('bloodlink_dataset') AS name")).rows[0].name, null);

    // Force a late database constraint failure after donor and source inserts.
    const validUnits = dataset.tables.blood_stocks[0].simulated_units;
    dataset.tables.blood_stocks[0].simulated_units = '-1';
    await assert.rejects(importDataset(database, dataset, true), /check constraint/);
    dataset.tables.blood_stocks[0].simulated_units = validUnits;
    assert.deepEqual((await database.query('SELECT * FROM users')).rows, original);
    assert.equal((await database.query("SELECT to_regnamespace('bloodlink_dataset') AS name")).rows[0].name, null);

    const result = await importDataset(database, dataset, true);
    assert.equal(result.dryRun, false);
    assert.deepEqual((await database.query("SELECT * FROM users WHERE email='existing@example.test'")).rows, original);
    assert.equal(Number((await database.query('SELECT count(*) n FROM donor_profiles')).rows[0].n), 10000);
    assert.equal(Number((await database.query('SELECT count(*) n FROM organizations')).rows[0].n), 48);
    assert.equal(Number((await database.query('SELECT count(*) n FROM blood_stocks')).rows[0].n), 384);
    assert.equal(Number((await database.query('SELECT count(*) n FROM blood_requests')).rows[0].n), 0);
    assert.equal(Number((await database.query('SELECT count(*) n FROM donations')).rows[0].n), 0);
    assert.equal(Number((await database.query(`SELECT count(*) n FROM donor_profiles d
      JOIN bloodlink_dataset.donor_map m ON m.user_id=d.user_id
      JOIN bloodlink_dataset.donors s USING(batch_id,donor_id)
      WHERE d.is_available AND (s.consent_status<>'granted' OR s.availability<>'Yes'
        OR s.availability_updated_at::timestamptz < NOW()-INTERVAL '30 days')`)).rows[0].n), 0);
    assert.equal((await importDataset(database, dataset, true)).alreadyImported, true);
    assert.equal(Number((await database.query('SELECT count(*) n FROM users')).rows[0].n), 10001);
    // Different source versions cannot overwrite an already imported account.
    await assert.rejects(importDataset(database, { ...dataset, id: 'different-source' }, true), /emails already exist/);
    await database.query(fs.readFileSync(path.resolve(__dirname,'../../database/migration_009_dataset_coordination.sql'),'utf8'));
    const {loadSupplement,importSupplement}=require('../src/importSupplementalDataset');
    const supplement=loadSupplement();
    assert.equal((await importSupplement(database,supplement)).report.dryRun,true);
    const sourceInstitution=supplement.tables.donation_institution_links[0].institution_id;
    supplement.tables.donation_institution_links[0].institution_id='MISSING';
    await assert.rejects(importSupplement(database,supplement,true));
    supplement.tables.donation_institution_links[0].institution_id=sourceInstitution;
    assert.equal(Number((await database.query('SELECT count(*) n FROM blood_requests')).rows[0].n),0);
    assert.equal(Number((await database.query('SELECT count(*) n FROM donations')).rows[0].n),0);
    const stocksBefore=(await database.query('SELECT organization_id,blood_group,available_units FROM blood_stocks ORDER BY organization_id,blood_group')).rows;
    const imported=await importSupplement(database,supplement,true);
    assert.equal(imported.report.inserted.donations,71097);
    assert.equal(imported.report.intervalFlagged,31830);
    assert.equal(imported.report.sourceClosedArchived,47);
    assert.equal(imported.credentials.length,48);
    assert.equal((await importSupplement(database,supplement,true)).report.alreadyImported,true);
    assert.equal(Number((await database.query('SELECT count(*) n FROM blood_requests')).rows[0].n),333);
    assert.equal(Number((await database.query('SELECT count(*) n FROM donations')).rows[0].n),71097);
    assert.equal(Number((await database.query('SELECT count(*) n FROM notifications')).rows[0].n),275);
    assert.deepEqual((await database.query('SELECT organization_id,blood_group,available_units FROM blood_stocks ORDER BY organization_id,blood_group')).rows,stocksBefore);
    assert.equal(Number((await database.query("SELECT count(*) n FROM blood_requests WHERE source_status='closed' AND status='Fulfilled'")).rows[0].n),0);
    assert.equal(Number((await database.query("SELECT count(*) n FROM (SELECT donor_id FROM notifications WHERE response_status='accepted' AND closed_at IS NULL GROUP BY donor_id HAVING count(*)>1) conflicts")).rows[0].n),0);
    assert.equal(Number((await database.query('SELECT count(*) n FROM push_delivery_jobs')).rows[0].n),0);
    const {seedTodayDemo}=require('../src/seedTodayDemo');
    const demo=await seedTodayDemo(database);
    assert.ok(demo.donorPassword);
    assert.equal((await seedTodayDemo(database)).alreadyCreated,true);
    assert.deepEqual((await database.query('SELECT organization_id,blood_group,available_units FROM blood_stocks ORDER BY organization_id,blood_group')).rows,stocksBefore);
  } finally {
    await database?.end();
    await control.query(`DROP DATABASE IF EXISTS "${name}"`);
    await control.end();
  }
});
