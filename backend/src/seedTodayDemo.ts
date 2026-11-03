import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { hashPassword } from './services/password.service';
dotenv.config();

/** A separate current-time scenario; never changes historical dataset timestamps. */
export async function seedTodayDemo(database:Pool) {
  const client=await database.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bloodlink-today-demo-v1'))");
    const prior=(await client.query("SELECT metadata FROM audit_logs WHERE action='SYNTHETIC_TODAY_DEMO_CREATED' ORDER BY id LIMIT 1")).rows[0];
    if(prior){await client.query('COMMIT');return {alreadyCreated:true,...prior.metadata};}
    const organization=(await client.query(`SELECT o.*,u.id staff_id,u.email staff_email FROM bloodlink_dataset.institution_map m
      JOIN organizations o ON o.id=m.organization_id JOIN users u ON u.organization_id=o.id AND u.is_bank_account
      ORDER BY m.institution_id LIMIT 1`)).rows[0];
    if(!organization)throw new Error('Import the supplementary staff accounts first');
    const email='demo.today.donor@example.invalid',password=`Demo!${crypto.randomBytes(18).toString('base64url')}9a`;
    const user=(await client.query(`INSERT INTO users(email,password_hash,role,created_at)
      VALUES($1,$2,'donor',NOW()-INTERVAL '2 years') RETURNING id`,[email,await hashPassword(password)])).rows[0];
    await client.query(`INSERT INTO donor_profiles(user_id,full_name,blood_group,blood_group_verified,district,latitude,longitude,
      is_available,consent_status,consent_recorded_at,availability_updated_at,last_donation_date,is_simulated,created_at)
      VALUES($1,'DEMO Today Donor','O+',true,$2,$3,$4,true,'granted',NOW(),NOW(),CURRENT_DATE-180,true,NOW()-INTERVAL '2 years')`,
    [user.id,organization.district,organization.latitude,organization.longitude]);
    const doc=new PDFDocument();const chunks:Buffer[]=[];
    const bytes=new Promise<Buffer>((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
    doc.fontSize(18).text('SYNTHETIC DEMO DOCUMENT - NOT MEDICAL EVIDENCE').moveDown();
    doc.fontSize(12).text('Fictional BloodLink workflow fixture. Donor: DEMO Today Donor. Stated group: O+. No medical testing or real document verification occurred.');doc.end();
    const documentId=crypto.randomUUID();
    await client.query(`INSERT INTO verification_documents(id,owner_id,file_name,mime_type,content)
      VALUES($1,$2,'SYNTHETIC-DEMO-NOT-MEDICAL-EVIDENCE.pdf','application/pdf',$3)`,[documentId,user.id,await bytes]);
    await client.query(`INSERT INTO donor_verifications(donor_id,document_url,claimed_blood_group,status,reviewed_at)
      VALUES($1,$2,'O+','approved',NOW())`,[user.id,`/api/documents/${documentId}`]);
    for(const days of [360,180])await client.query(`INSERT INTO donations(donor_id,organization_id,units_donated,donation_date,is_simulated)
      VALUES($1,$2,1,CURRENT_DATE-$3::integer,true)`,[user.id,organization.id,days]);
    const request=(await client.query(`INSERT INTO blood_requests(organization_id,blood_group,required_units,priority,radius_km,status,
      created_by,approval_status,review_reason,reason,department,expires_at,outreach_target,is_simulated)
      VALUES($1,'O+',1,'Emergency',25,'Active',$2,'Approved','Synthetic local scenario; no real review',
      'DEMO current-day outreach workflow','DEMO Coordination Desk',NOW()+INTERVAL '48 hours',5,true) RETURNING id,expires_at`,[organization.id,organization.staff_id])).rows[0];
    const notification=(await client.query(`INSERT INTO notifications(donor_id,title,message,kind,category)
      VALUES($1,'DEMO private follow-up','Your demo institution has sent a synthetic message.','health_advisory','doctor') RETURNING id`,[user.id])).rows[0];
    await client.query(`INSERT INTO health_alerts(organization_id,donor_id,sent_by,subject,message,notification_id)
      VALUES($1,$2,$3,'DEMO follow-up message','Synthetic workflow fixture only. No clinical information or medical advice.',$4)`,[organization.id,user.id,organization.staff_id,notification.id]);
    const metadata={donorId:user.id,donorEmail:email,staffEmail:organization.staff_email,organizationId:organization.id,requestId:request.id,expiresAt:request.expires_at};
    await client.query("INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('SYNTHETIC_TODAY_DEMO_CREATED','user',$1,$2)",[user.id,metadata]);
    await client.query('COMMIT');return {...metadata,donorPassword:password};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

if(require.main===module){
  let database:Pool|undefined;
  (async()=>{
    const runtime=new URL(process.env.DATABASE_URL||''),owner=new URL(process.env.MIGRATION_DATABASE_URL||runtime.toString());
    if(process.env.NODE_ENV!=='development'||!['localhost','127.0.0.1','[::1]'].includes(owner.hostname)||runtime.host!==owner.host||runtime.pathname!==owner.pathname)throw new Error('Requires the same local development database');
    const output=path.resolve(__dirname,'../../.qa-private/dataset-import/today-demo-credentials.json');
    // Reserve the credential file before making changes; never overwrite an existing secret.
    database=new Pool({connectionString:owner.toString()});
    const prior=(await database.query("SELECT 1 FROM audit_logs WHERE action='SYNTHETIC_TODAY_DEMO_CREATED' LIMIT 1")).rowCount;
    if(!prior && fs.existsSync(output))throw new Error('Existing credential file preserved; review it before creating a new demo');
    let descriptor:number|undefined;
    if(!fs.existsSync(output))descriptor=fs.openSync(output,'wx',0o600);
    try{
      const result=await seedTodayDemo(database);
      if('donorPassword' in result){if(descriptor===undefined)throw new Error('Credential file already exists');fs.writeFileSync(descriptor,JSON.stringify(result,null,2));}
      const {donorPassword,...safe}=result;console.log(JSON.stringify(safe,null,2));
    }finally{if(descriptor!==undefined)fs.closeSync(descriptor);}
  })().catch(e=>{console.error('Today demo failed:',e.message);process.exitCode=1;}).finally(async()=>database?.end());
}
