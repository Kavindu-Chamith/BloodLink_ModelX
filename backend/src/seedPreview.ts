import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import { pool } from './db';
import { transaction } from './transaction';
import { hashPassword } from './services/password.service';
import { dispatchMatches } from './services/coordination.service';

// Explicit local-only fixtures. Never call this from startup, migrations or HTTP.
export async function seedPreview() {
  const database = new URL(process.env.DATABASE_URL!);
  if (process.env.NODE_ENV !== 'development' || !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) {
    throw new Error('Preview fixtures require a local development database');
  }
  if (!process.argv.includes('--local-preview')) throw new Error('Pass --local-preview to create clearly labeled synthetic records');
  const password = `Preview!${crypto.randomBytes(12).toString('base64url')}9a`;
  const hash = await hashPassword(password);
  const pdf = new PDFDocument();
  const chunks: Buffer[] = [];
  const bytes = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', chunk => chunks.push(chunk)); pdf.on('end', () => resolve(Buffer.concat(chunks))); pdf.on('error', reject);
  });
  pdf.fontSize(20).text('DEMO DOCUMENT — NOT MEDICAL EVIDENCE').moveDown();
  pdf.fontSize(12).text('Synthetic O+ verification fixture for local BloodLink testing only. No real medical assessment has been performed.');
  pdf.end();
  const content = await bytes;
  const result = await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bloodlink-local-preview-v1'))");
    const seeded = (await client.query("SELECT metadata FROM audit_logs WHERE action = 'LOCAL_PREVIEW_DATA_CREATED' ORDER BY id LIMIT 1")).rows[0];
    if (seeded) return { alreadyPresent: true, ...seeded.metadata };
    const actor = (await client.query("SELECT id FROM users WHERE role = 'admin' AND status = 'active' ORDER BY id LIMIT 1")).rows[0];
    if (!actor) throw new Error('Seed the local administrator first');
    let donor = (await client.query("SELECT u.id, u.role, dp.full_name FROM users u LEFT JOIN donor_profiles dp ON dp.user_id = u.id WHERE u.email = 'donor.test@example.com' FOR UPDATE OF u")).rows[0];
    let donorCreated = false;
    if (!donor) {
      donor = (await client.query("INSERT INTO users(email,password_hash,role,status) VALUES ('donor.test@example.com',$1,'donor','active') RETURNING id, role", [hash])).rows[0];
      await client.query("INSERT INTO donor_profiles(user_id,full_name,blood_group) VALUES ($1,'Local Test Donor','O+')", [donor.id]);
      donorCreated = true;
    } else if (donor.role !== 'donor' || !['Local Test Donor', 'DEMO Test Donor'].includes(donor.full_name)) {
      throw new Error('Reserved test email belongs to another account; existing account was preserved');
    }
    const institutions: number[] = [];
    const staffAccounts: { email: string; role: string }[] = [];
    for (const [index, name, type, latitude, longitude] of [
      [0, 'DEMO Colombo Hospital', 'hospital', 6.927, 79.861],
      [1, 'DEMO Colombo Blood Bank', 'bloodbank', 6.917, 79.875],
      [2, 'DEMO Kandy Blood Bank', 'bloodbank', 7.29, 80.633],
    ] as const) {
      const org = (await client.query(`INSERT INTO organizations(name,type,district,address,contact_email,branch_name,latitude,longitude,verification_status,verified_by,verified_at)
        VALUES ($1,$2,$3,'Synthetic location — local test fixture',$4,'DEMO coordination desk',$5,$6,'approved',$7,NOW()) RETURNING id`,
        [name, type, index === 2 ? 'Kandy' : 'Colombo', `preview.${index}@example.com`, latitude, longitude, actor.id])).rows[0];
      institutions.push(org.id);
      const email = `preview.${type}.${index}@example.com`;
      const role = type === 'hospital' ? 'hospital_staff' : 'bloodbank_staff';
      await client.query(`INSERT INTO users(email,password_hash,role,organization_id,status,is_bank_account) VALUES ($1,$2,$3,$4,'active',$5)`, [email, hash, role, org.id, type === 'bloodbank']);
      staffAccounts.push({ email, role });
      for (const [groupIndex, group] of ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].entries()) {
        const units = [2, 0, 6, 15, 24, 4, 12, 1][(groupIndex + index) % 8]!;
        await client.query('INSERT INTO blood_stocks(organization_id,blood_group,available_units,status) VALUES ($1,$2,$3,$4)', [org.id, group, units, units <= 2 ? 'Critical' : units < 10 ? 'Low' : 'Normal']);
      }
    }
    // Only the reserved local test donor is modified. Existing passwords stay intact.
    await client.query(`UPDATE donor_profiles SET full_name='DEMO Test Donor', blood_group='O+', blood_group_verified=true,
      district='Colombo', is_available=true, latitude=6.927, longitude=79.861,
      last_donation_date=CURRENT_DATE-180, next_eligible_date=CURRENT_DATE-90, updated_at=NOW() WHERE user_id=$1`, [donor.id]);
    const documentId = crypto.randomUUID();
    await client.query("INSERT INTO verification_documents(id,owner_id,file_name,mime_type,content) VALUES ($1,$2,'DEMO-not-medical-evidence.pdf','application/pdf',$3)", [documentId, donor.id, content]);
    await client.query(`INSERT INTO donor_verifications(donor_id,document_url,claimed_blood_group,status,reviewed_by,reviewed_at)
      VALUES ($1,$2,'O+','approved',$3,NOW())`, [donor.id, `/api/documents/${documentId}`, actor.id]);
    for (const days of [180, 360, 540]) {
      await client.query('INSERT INTO donations(donor_id,organization_id,units_donated,donation_date,confirmed_by) VALUES ($1,$2,1,CURRENT_DATE-$3::integer,$4)', [donor.id, institutions[1], days, actor.id]);
    }
    const requestIds: number[] = [];
    for (const [index, priority] of ['Emergency', 'Urgent', 'Normal'].entries()) {
      const request = (await client.query(`INSERT INTO blood_requests(organization_id,blood_group,required_units,priority,radius_km,created_by)
        VALUES ($1,'O+',$2,$3,25,$4) RETURNING id`, [institutions[index === 1 ? 1 : 0], index + 1, priority, actor.id])).rows[0];
      requestIds.push(request.id);
      await dispatchMatches(client, request.id);
    }
    for (const [index, title, message] of [
      [0, 'DEMO: Welcome to the test workspace', 'Synthetic account, institutions, stocks and donation history are loaded. No clinical information is real.'],
      [1, 'DEMO: Try the donor workflows', 'Open Requests to accept a nearby O+ request, notify the coordinator, or cancel your mission. Stock confirmation is performed through the staff API.'],
    ] as const) {
      await client.query(`INSERT INTO notifications(donor_id,title,message,kind,category,dedupe_key) VALUES ($1,$2,$3,'profile_synced','system',$4)`, [donor.id, title, message, `local-preview:v1:${index}`]);
    }
    const metadata = { donorEmail: 'donor.test@example.com', donorId: donor.id, institutionIds: institutions, requestIds, staffAccounts };
    await client.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata) VALUES ($1,'LOCAL_PREVIEW_DATA_CREATED','user',$2,$3)`, [actor.id, donor.id, JSON.stringify(metadata)]);
    return { alreadyPresent: false, ...metadata, staffPassword: password, ...(donorCreated ? { donorPassword: password } : {}) };
  });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) seedPreview().catch(error => {
  console.error('Preview seed failed:', error.code || error.message); process.exitCode = 1;
}).finally(() => pool.end());
