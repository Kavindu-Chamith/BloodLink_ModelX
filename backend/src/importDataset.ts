import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';
import { hashPassword } from './services/password.service';

dotenv.config();
type Row = Record<string, string>;
const provenance = 'SYNTHETIC_TEST_DATA_NOT_REAL';
const definitions = [
  ['locations_reference', 'location_id'], ['donors', 'donor_id'],
  ['institutions', 'institution_id'], ['blood_requests', 'request_id'],
  ['donor_responses', 'response_id'], ['donation_history', 'donation_event_id'],
  ['blood_stocks', 'stock_record_id'],
] as const;
const groups = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
const quote = (s: string) => '"' + s.replace(/"/g, '""') + '"';
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** RFC 4180 fields, including escaped quotes, multiline text, BOM and CRLF. */
export function parseCSV(input: string): Row[] {
  const text = input.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [], value = '', quoted = false, closed = false;
  const field = () => { record.push(value); value = ''; closed = false; };
  const line = () => { field(); records.push(record); record = []; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else value += char;
    } else if (char === ',') field();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      line();
    } else if (char === '"' && !value && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error('Malformed CSV quoting');
      value += char;
    }
  }
  if (quoted) throw new Error('Unterminated CSV quoted field');
  if (record.length || value || closed) line();
  const headers = records.shift();
  if (!headers?.length || new Set(headers).size !== headers.length || headers.some(h => !/^[a-z][a-z0-9_]*$/.test(h))) {
    throw new Error('Missing, duplicate or invalid CSV headers');
  }
  return records.map((r, i) => {
    if (r.length !== headers.length) throw new Error(`CSV row ${i + 2}: incorrect column count`);
    return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
  });
}

export function loadDataset(directory: string) {
  const digest = crypto.createHash('sha256').update('bloodlink-dataset-import-v1');
  const manifestBytes = fs.readFileSync(path.join(directory, 'manifest.json'));
  digest.update(manifestBytes);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const tables: Record<string, Row[]> = {};
  for (const [table, key] of definitions) {
    const bytes = fs.readFileSync(path.join(directory, `${table}.csv`));
    digest.update(table).update(bytes);
    const rows = tables[table] = parseCSV(bytes.toString('utf8'));
    ensure(rows.length > 0, `Empty dataset: ${table}`);
    ensure(rows.length === manifest.generated_counts[table], `Manifest count mismatch: ${table}`);
    ensure(rows.every(r => r[key] && r.data_provenance === provenance), `Invalid identity/provenance: ${table}`);
    ensure(new Set(rows.map(r => r[key])).size === rows.length, `Duplicate identifiers: ${table}`);
  }
  const ids = (table: string, key: string) => new Set(tables[table].map(r => r[key]));
  const donors = ids('donors', 'donor_id'), institutions = ids('institutions', 'institution_id');
  const requests = ids('blood_requests', 'request_id');
  ensure(new Set(tables.donors.map(r => r.test_email)).size === donors.size, 'Duplicate donor emails');
  const snapshot = Date.parse(manifest.snapshot_utc);
  ensure(Number.isFinite(snapshot), 'Invalid snapshot date');
  for (const r of tables.donors) {
    ensure(/^bloodlink\.donor\d+@example\.invalid$/.test(r.test_email), 'Expected reserved synthetic donor email');
    ensure(groups.has(r.blood_group), `Invalid blood group: ${r.donor_id}`);
    ensure(['Yes', 'No'].includes(r.availability), 'Invalid availability');
    ensure(['granted', 'withdrawn', 'not_provided'].includes(r.consent_status), 'Invalid consent');
    ensure(['verified', 'pending', 'rejected', 'unverified'].includes(r.blood_group_verification), 'Invalid verification');
    ensure(Number.isFinite(Date.parse(r.created_at)) && Date.parse(r.created_at) <= Date.parse(r.availability_updated_at)
      && Date.parse(r.availability_updated_at) <= snapshot, `Invalid donor dates: ${r.donor_id}`);
    ensure(!r.last_donation_date || (/^\d{4}-\d{2}-\d{2}$/.test(r.last_donation_date)
      && Date.parse(r.last_donation_date) <= snapshot), 'Invalid last donation date');
  }
  for (const r of [...tables.donors, ...tables.institutions]) {
    ensure(r.latitude.trim() && r.longitude.trim() && Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude))
      && Number(r.latitude) >= -90 && Number(r.latitude) <= 90 && Number(r.longitude) >= -180 && Number(r.longitude) <= 180,
    'Missing/invalid coordinates');
  }
  for (const r of tables.institutions) ensure(['mock_blood_bank', 'mock_hospital'].includes(r.institution_type), 'Invalid institution type');
  for (const r of [...tables.blood_requests, ...tables.blood_stocks]) ensure(institutions.has(r.institution_id), 'Orphan institution reference');
  for (const r of [...tables.donor_responses, ...tables.donation_history]) ensure(donors.has(r.donor_id), 'Orphan donor reference');
  for (const r of tables.donor_responses) ensure(requests.has(r.request_id), 'Orphan request reference');
  for (const r of tables.blood_stocks) ensure(groups.has(r.blood_group) && /^\d+$/.test(r.simulated_units)
    && ['normal', 'low', 'critical'].includes(r.stock_status) && Number.isFinite(Date.parse(r.recorded_at)), 'Invalid stock');
  ensure(new Set(tables.blood_stocks.map(r => `${r.institution_id}:${r.blood_group}`)).size === tables.blood_stocks.length, 'Duplicate stock pairs');
  return { id: digest.digest('hex'), manifest, tables };
}

type Dataset = ReturnType<typeof loadDataset>;
async function chunks<T>(rows: T[], work: (chunk: T[]) => Promise<unknown>) {
  for (let offset = 0; offset < rows.length; offset += 1000) await work(rows.slice(offset, offset + 1000));
}

export async function importDataset(database: Pool, dataset: Dataset, apply = false) {
  const client = await database.connect();
  const rows = dataset.tables;
  try {
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
    // Cooperating imports serialize before reading/checking any import state.
    if (apply) await client.query("SELECT pg_advisory_xact_lock(hashtext('bloodlink-dataset-import-v1'))");
    const schema = (await client.query("SELECT to_regclass('bloodlink_dataset.batches') AS batches")).rows[0];
    if (schema.batches) {
      const previous = (await client.query('SELECT report FROM bloodlink_dataset.batches WHERE id=$1', [dataset.id])).rows[0];
      if (previous) { await client.query('COMMIT'); return { ...previous.report, alreadyImported: true }; }
    }
    const conflicts = (await client.query('SELECT count(*)::integer AS count FROM public.users WHERE email=ANY($1::text[])', [rows.donors.map(r => r.test_email)])).rows[0].count;
    ensure(conflicts === 0, `${conflicts} donor emails already exist outside this import; no existing accounts were changed`);
    const report = {
      datasetId: dataset.id, database: (await client.query('SELECT current_database() AS name')).rows[0].name,
      snapshot: dataset.manifest.snapshot_utc, importedAt: new Date().toISOString(),
      sourceRows: Object.fromEntries(definitions.map(([t]) => [t, rows[t].length])),
      applicationRows: { users: rows.donors.length, donor_profiles: rows.donors.length,
        organizations: rows.institutions.length, blood_stocks: rows.blood_stocks.length },
      missing: [
        'Requests: required_units is absent. outreach_target counts volunteers and must not be substituted for units. Request expiry and outreach_target also have no application columns.',
        'Donation history: institution_id is absent, so organization_id cannot be populated. No historical institution was invented.',
        'Responses: requests must first be mapped into application blood_requests. Simulated delivery is not a real push delivery receipt.',
        'Verification documents, reviewer identities, institution registration evidence and staff accounts/credentials are absent. No review documents or staff accounts were fabricated.',
        'Donor phone numbers, NICs and birth dates are absent. TEST-LK identifiers are retained only in source tables; application phone is NULL.',
        'Consent, freshness timestamps, city/province, detailed verification states and provenance have no dedicated application profile fields; all remain in source tables.',
      ],
      policies: [
        'Existing application records are preserved. Repeating an identical import is a no-op; changed datasets with conflicting emails are rejected.',
        'All CSV columns are preserved in bloodlink_dataset source tables, with dataset foreign keys and mappings to application IDs.',
        'Application names are prefixed DEMO. CSV simulated verification/authorization becomes demo-only verified/approved state, without fabricated documentary reviews.',
        'Application availability requires source Yes, granted consent, and an update within 30 days of import time. Original availability stays in the source table. This is an import-time filter; ongoing freshness/consent enforcement requires application changes.',
        'Random account secrets are hashed and discarded; no login credentials, messages, push jobs or emails are generated.',
        'Last donation dates are copied from simulated summaries; next_eligible_date remains NULL. Confirmed donation records are not invented.',
        'Stock statuses are copied from the dataset fixture thresholds, not recalculated using application thresholds.',
      ],
    };
    if (!apply) { await client.query('COMMIT'); return { ...report, dryRun: true }; }
    await client.query('CREATE SCHEMA IF NOT EXISTS bloodlink_dataset');
    await client.query('REVOKE ALL ON SCHEMA bloodlink_dataset FROM PUBLIC');
    await client.query(`CREATE TABLE IF NOT EXISTS bloodlink_dataset.batches (
      id TEXT PRIMARY KEY, manifest JSONB NOT NULL, report JSONB NOT NULL, imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query('INSERT INTO bloodlink_dataset.batches(id,manifest,report) VALUES($1,$2,$3)', [dataset.id, dataset.manifest, report]);
    for (const [table, key] of definitions) {
      const columns = Object.keys(rows[table][0]);
      const links: Record<string, string> = {
        blood_requests: ', FOREIGN KEY(batch_id,institution_id) REFERENCES bloodlink_dataset.institutions(batch_id,institution_id)',
        donor_responses: ', FOREIGN KEY(batch_id,donor_id) REFERENCES bloodlink_dataset.donors(batch_id,donor_id), FOREIGN KEY(batch_id,request_id) REFERENCES bloodlink_dataset.blood_requests(batch_id,request_id)',
        donation_history: ', FOREIGN KEY(batch_id,donor_id) REFERENCES bloodlink_dataset.donors(batch_id,donor_id)',
        blood_stocks: ', FOREIGN KEY(batch_id,institution_id) REFERENCES bloodlink_dataset.institutions(batch_id,institution_id)',
      };
      await client.query(`CREATE TABLE IF NOT EXISTS bloodlink_dataset.${quote(table)} (
        batch_id TEXT NOT NULL REFERENCES bloodlink_dataset.batches(id),
        ${columns.map(c => `${quote(c)} TEXT NOT NULL`).join(',')}, PRIMARY KEY(batch_id,${quote(key)})${links[table] || ''})`);
      await chunks(rows[table], part => client.query(`INSERT INTO bloodlink_dataset.${quote(table)}(batch_id,${columns.map(quote).join(',')})
        SELECT $1,${columns.map(c => `x.${quote(c)}`).join(',')} FROM jsonb_to_recordset($2::jsonb) AS x(${columns.map(c => `${quote(c)} text`).join(',')})`, [dataset.id, JSON.stringify(part)]));
    }
    await client.query(`CREATE TABLE IF NOT EXISTS bloodlink_dataset.donor_map (
      batch_id TEXT NOT NULL, donor_id TEXT NOT NULL, user_id INTEGER NOT NULL UNIQUE REFERENCES public.users(id),
      PRIMARY KEY(batch_id,donor_id), FOREIGN KEY(batch_id,donor_id) REFERENCES bloodlink_dataset.donors(batch_id,donor_id))`);
    await client.query(`CREATE TABLE IF NOT EXISTS bloodlink_dataset.institution_map (
      batch_id TEXT NOT NULL, institution_id TEXT NOT NULL, organization_id INTEGER NOT NULL UNIQUE REFERENCES public.organizations(id),
      PRIMARY KEY(batch_id,institution_id), FOREIGN KEY(batch_id,institution_id) REFERENCES bloodlink_dataset.institutions(batch_id,institution_id))`);
    const passwordHash = await hashPassword(crypto.randomBytes(48).toString('base64url'));
    await chunks(rows.donors, part => client.query(`INSERT INTO public.users(email,password_hash,role,status,created_at,updated_at)
      SELECT test_email,$1,'donor','active',created_at::timestamptz,created_at::timestamptz
      FROM jsonb_to_recordset($2::jsonb) AS x(test_email text,created_at text)`, [passwordHash, JSON.stringify(part)]));
    // Newly populated tables have no planner statistics inside this transaction.
    await client.query('ANALYZE public.users');
    await client.query('ANALYZE bloodlink_dataset.donors');
    await client.query(`INSERT INTO bloodlink_dataset.donor_map(batch_id,donor_id,user_id)
      SELECT d.batch_id,d.donor_id,u.id FROM bloodlink_dataset.donors d JOIN public.users u ON u.email=d.test_email WHERE d.batch_id=$1`, [dataset.id]);
    await client.query('ANALYZE bloodlink_dataset.donor_map');
    await client.query(`INSERT INTO public.donor_profiles(user_id,full_name,phone,district,blood_group,blood_group_verified,
      is_available,latitude,longitude,last_donation_date,created_at,updated_at)
      SELECT m.user_id,'DEMO ' || d.fictional_name,NULL,d.district,d.blood_group,d.blood_group_verification='verified',
        d.availability='Yes' AND d.consent_status='granted'
          AND d.availability_updated_at::timestamptz BETWEEN NOW()-INTERVAL '30 days' AND NOW(),
        d.latitude::numeric,d.longitude::numeric,NULLIF(d.last_donation_date,'')::date,d.created_at::timestamptz,d.availability_updated_at::timestamptz
      FROM bloodlink_dataset.donors d JOIN bloodlink_dataset.donor_map m USING(batch_id,donor_id) WHERE d.batch_id=$1`, [dataset.id]);
    for (const institution of rows.institutions) {
      const result = await client.query(`INSERT INTO public.organizations(name,type,address,district,latitude,longitude,verification_status)
        VALUES($1,$2,$3,$4,$5,$6,'approved') RETURNING id`, [
        `DEMO ${institution.institution_name}`, institution.institution_type === 'mock_blood_bank' ? 'bloodbank' : 'hospital',
        `${institution.city}, ${institution.district} (simulated site)`, institution.district, institution.latitude, institution.longitude]);
      await client.query('INSERT INTO bloodlink_dataset.institution_map(batch_id,institution_id,organization_id) VALUES($1,$2,$3)', [dataset.id, institution.institution_id, result.rows[0].id]);
    }
    await client.query(`INSERT INTO public.blood_stocks(organization_id,blood_group,available_units,status,updated_at)
      SELECT m.organization_id,s.blood_group,s.simulated_units::integer,initcap(s.stock_status),s.recorded_at::timestamptz
      FROM bloodlink_dataset.blood_stocks s JOIN bloodlink_dataset.institution_map m USING(batch_id,institution_id) WHERE s.batch_id=$1`, [dataset.id]);
    await verifyImported(client, dataset);
    await client.query(`INSERT INTO public.audit_logs(action,target_type,metadata) VALUES('SYNTHETIC_DATASET_IMPORTED','dataset',$1)`, [report]);
    await client.query('COMMIT');
    return { ...report, dryRun: false };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

async function verifyImported(client: PoolClient, dataset: Dataset) {
  const counts = (await client.query(`SELECT
    (SELECT count(*)::integer FROM bloodlink_dataset.donor_map m JOIN public.donor_profiles d ON d.user_id=m.user_id WHERE m.batch_id=$1) donors,
    (SELECT count(*)::integer FROM bloodlink_dataset.institution_map WHERE batch_id=$1) institutions,
    (SELECT count(*)::integer FROM public.blood_stocks s JOIN bloodlink_dataset.institution_map m ON m.organization_id=s.organization_id WHERE m.batch_id=$1) stocks`, [dataset.id])).rows[0];
  ensure(counts.donors === dataset.tables.donors.length && counts.institutions === dataset.tables.institutions.length
    && counts.stocks === dataset.tables.blood_stocks.length, 'Application import count mismatch');
  for (const [table] of definitions) {
    const count = (await client.query(`SELECT count(*)::integer AS n FROM bloodlink_dataset.${quote(table)} WHERE batch_id=$1`, [dataset.id])).rows[0].n;
    ensure(count === dataset.tables[table].length, `Source import count mismatch: ${table}`);
  }
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  const directory = path.resolve(__dirname, '../../Dataset');
  let database: Pool | undefined;
  (async () => {
    const runtime = new URL(process.env.DATABASE_URL || '');
    const owner = new URL(process.env.MIGRATION_DATABASE_URL || runtime.toString());
    ensure(process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1', '[::1]'].includes(owner.hostname),
      'Synthetic dataset imports require a local development database');
    ensure(owner.hostname === runtime.hostname && (owner.port || '5432') === (runtime.port || '5432') && owner.pathname === runtime.pathname,
      'Runtime and migration connections must point to the same database');
    const dataset = loadDataset(directory);
    database = new Pool({ connectionString: owner.toString(), connectionTimeoutMillis: 5000,
      options: '-c statement_timeout=60000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=60000' });
    const report = await importDataset(database, dataset, apply);
    const output = path.resolve(__dirname, '../../.qa-private/dataset-import');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, apply ? 'import-report.json' : 'dry-run-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  })().catch(error => { console.error('Dataset import failed:', error.message); process.exitCode = 1; })
    .finally(async () => { await database?.end(); });
}
