import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import { loadDataset, parseCSV } from './importDataset';
import { hashPassword } from './services/password.service';
import { donationIntervalDays } from './services/coordination.service';

const root = path.resolve(__dirname, '../../Dataset');
const kinds = { request: 'blood_requests', donation: 'donations', response: 'notifications', staff: 'users' } as const;
const fail = (message: string): never => { throw new Error(message); };
const requireValue = (condition: unknown, message: string) => { if (!condition) fail(message); };
type Row = Record<string,string>;

export function loadSupplement(directory = root) {
  const base = loadDataset(directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory,'supplement_manifest.json'),'utf8'));
  const hash = crypto.createHash('sha256').update('bloodlink-supplement-v1');
  for (const [name, expected] of Object.entries(manifest.baseline_input_sha256)) {
    requireValue(/^[a-z_]+\.csv$/.test(name),'Invalid source filename');
    const bytes=fs.readFileSync(path.join(directory,name));
    requireValue(crypto.createHash('sha256').update(bytes).digest('hex')===expected,`Source changed: ${name}`);
  }
  const tables:Record<string,Row[]>={};
  for (const table of ['request_details','request_import_decisions','donation_institution_links','institution_staff']) {
    const name=table+'.csv', bytes=fs.readFileSync(path.join(directory,name));
    requireValue(crypto.createHash('sha256').update(bytes).digest('hex')===manifest.supplemental_csv_sha256[name],`Supplement checksum mismatch: ${name}`);
    hash.update(name).update(bytes);tables[table]=parseCSV(bytes.toString('utf8'));
    requireValue(tables[table].every(r=>r.is_simulated==='true' && r.data_provenance==='SYNTHETIC_TEST_DATA_NOT_REAL'),'Missing synthetic provenance');
  }
  const exactCoverage=(rows:Row[], key:string, originals:Row[], originalKey=key)=> {
    const ids=new Set(rows.map(r=>r[key]));
    requireValue(ids.size===rows.length && rows.length===originals.length && originals.every(r=>ids.has(r[originalKey])),`Incomplete/duplicate ${key} coverage`);
  };
  exactCoverage(tables.request_details,'request_id',base.tables.blood_requests);
  exactCoverage(tables.request_import_decisions,'request_id',base.tables.blood_requests);
  exactCoverage(tables.donation_institution_links,'donation_event_id',base.tables.donation_history);
  exactCoverage(tables.institution_staff,'institution_id',base.tables.institutions);
  const eventDonors=new Map(base.tables.donation_history.map(r=>[r.donation_event_id,r.donor_id]));
  const institutionIds=new Set(base.tables.institutions.map(r=>r.institution_id));
  for (const r of tables.donation_institution_links) requireValue(eventDonors.get(r.donation_event_id)===r.donor_id && institutionIds.has(r.institution_id),'Invalid donation link');
  for (const r of tables.request_details) requireValue(/^\d+$/.test(r.required_units) && Number(r.required_units)>0 && Number(r.required_units)<=1000,'Invalid required units');
  const institutions=new Map(base.tables.institutions.map(r=>[r.institution_id,r]));
  requireValue(new Set(tables.institution_staff.map(r=>r.email)).size===tables.institution_staff.length,'Duplicate staff emails');
  for (const r of tables.institution_staff) {
    const bank=institutions.get(r.institution_id)?.institution_type==='mock_blood_bank';
    requireValue(/^bloodlink\.staff\.ins\d+@example\.invalid$/.test(r.email) && r.role===(bank?'bloodbank_staff':'hospital_staff')
      && r.is_bank_account===(bank?'true':'false'),'Invalid staff role or reserved email');
  }
  return { base, manifest, tables, id:hash.digest('hex') };
}

type Supplement=ReturnType<typeof loadSupplement>;
type Credentials={email:string;password:string;role:string;institutionId:string}[];
async function chunks<T>(rows:T[],work:(r:T[])=>Promise<unknown>) { for(let i=0;i<rows.length;i+=1000)await work(rows.slice(i,i+1000)); }

export async function importSupplement(database:Pool,supplement:Supplement,apply=false,persistCredentials?:(credentials:Credentials)=>void) {
  const client=await database.connect();
  const {base,tables,id}=supplement, batch=base.id;
  try {
    await client.query(apply?'BEGIN':'BEGIN READ ONLY');
    if(apply)await client.query("SELECT pg_advisory_xact_lock(hashtext('bloodlink-supplement-v1'))");
    const original=(await client.query('SELECT id FROM bloodlink_dataset.batches WHERE id=$1',[batch])).rows[0];
    requireValue(original,'Import the matching synthetic baseline dataset first');
    requireValue((await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blood_requests' AND column_name='expires_at'")).rowCount,'Apply migration 009 first');
    if((await client.query("SELECT to_regclass('bloodlink_dataset.supplement_runs') name")).rows[0].name) {
      const previous=(await client.query('SELECT id,report FROM bloodlink_dataset.supplement_runs WHERE batch_id=$1',[batch])).rows[0];
      if(previous) {
        requireValue(previous.id===id,'This batch already has a different supplement; review before changing imported events');
        await client.query('COMMIT');return {report:{...previous.report,alreadyImported:true},credentials:[]};
      }
    }
    const donorMap=new Map<string,number>((await client.query('SELECT donor_id,user_id FROM bloodlink_dataset.donor_map WHERE batch_id=$1',[batch])).rows.map(r=>[r.donor_id,r.user_id]));
    const orgMap=new Map<string,number>((await client.query('SELECT institution_id,organization_id FROM bloodlink_dataset.institution_map WHERE batch_id=$1',[batch])).rows.map(r=>[r.institution_id,r.organization_id]));
    requireValue(donorMap.size===base.tables.donors.length && orgMap.size===base.tables.institutions.length,'Incomplete existing application maps');
    const now=new Date((await client.query('SELECT NOW() time')).rows[0].time), days=donationIntervalDays();
    const requests=new Map(base.tables.blood_requests.map(r=>[r.request_id,r]));
    const report={batchId:batch,supplementId:id,asOf:now.toISOString(),intervalPolicyDays:days,
      inserted:{requests:base.tables.blood_requests.length,donations:base.tables.donation_history.length,responses:base.tables.donor_responses.length,staff:0},
      sourceClosedArchived:base.tables.blood_requests.filter(r=>r.status==='closed').length,
      sourceActiveExpired:base.tables.blood_requests.filter(r=>r.status==='active' && Date.parse(r.expires_at)<=now.getTime()).length,
      conflictingMissions:[] as {donorId:string;keptRequest:string;closedRequest:string}[],
      intervalFlagged:0,stockStatusAligned:0,staffReused:0,
      policies:['Source closed/expired requests are operationally Cancelled; source_status preserves original meaning, never Fulfilled.',
        'Historical dates and source payloads are unchanged. Short historical intervals are flagged, not repaired or treated as clinical evidence.',
        'Earliest accepted open mission is retained; later overlapping responses remain accepted history with closed_at set.',
        'Historical donations never increase stock. Imported verification and approvals are simulated; no real reviewer is impersonated.',
        'No outbound messages or push jobs are created. Staff temporary credentials are stored only in an ignored local file.']};
    const keepMission=new Map<string,string>();
    const closedResponses=new Set<string>();
    const status=(r:Row)=>r.status==='active' && Date.parse(r.expires_at)>now.getTime() && Date.parse(r.created_at)<=now.getTime()?'Active':'Cancelled';
    const accepted=base.tables.donor_responses.filter(r=>r.response_status==='accepted').sort((a,b)=>a.responded_at.localeCompare(b.responded_at)||a.response_id.localeCompare(b.response_id));
    for(const response of accepted) {
      if(status(requests.get(response.request_id)!)!=='Active')continue;
      const kept=keepMission.get(response.donor_id);
      if(kept) { closedResponses.add(response.response_id);report.conflictingMissions.push({donorId:response.donor_id,keptRequest:kept,closedRequest:response.request_id}); }
      else keepMission.set(response.donor_id,response.request_id);
    }
    const flagged=new Set<string>(), lastDate=new Map<string,string>();
    for(const event of [...base.tables.donation_history].sort((a,b)=>a.donor_id.localeCompare(b.donor_id)||a.donation_date.localeCompare(b.donation_date))) {
      const previous=lastDate.get(event.donor_id);
      if(previous && (Date.parse(event.donation_date)-Date.parse(previous))/86400000<days)flagged.add(event.donation_event_id);
      lastDate.set(event.donor_id,event.donation_date);
    }
    report.intervalFlagged=flagged.size;
    const existingStaff=(await client.query(`SELECT u.id,u.email,u.organization_id,u.role,u.is_bank_account FROM users u
      WHERE organization_id=ANY($1::integer[]) AND status='active' AND role IN ('bloodbank_staff','hospital_staff') ORDER BY is_bank_account DESC,id`,[[...orgMap.values()]])).rows;
    for(const staff of tables.institution_staff) {
      const existing=existingStaff.find(u=>u.organization_id===orgMap.get(staff.institution_id) && (staff.is_bank_account!=='true'||u.is_bank_account));
      if(existing)report.staffReused++;else report.inserted.staff++;
    }
    if(!apply) { await client.query('COMMIT');return {report:{...report,dryRun:true},credentials:[]}; }
    await client.query(`CREATE TABLE IF NOT EXISTS bloodlink_dataset.supplement_runs(
      id text PRIMARY KEY,batch_id text NOT NULL UNIQUE REFERENCES bloodlink_dataset.batches(id),report jsonb NOT NULL,imported_at timestamptz NOT NULL DEFAULT NOW())`);
    await client.query('INSERT INTO bloodlink_dataset.supplement_runs(id,batch_id,report) VALUES($1,$2,$3)',[id,batch,report]);
    for(const [kind,table] of Object.entries(kinds))await client.query(`CREATE TABLE IF NOT EXISTS bloodlink_dataset.${kind}_map(
      batch_id text NOT NULL REFERENCES bloodlink_dataset.batches(id),source_id text NOT NULL,
      application_id integer NOT NULL UNIQUE REFERENCES public.${table}(id),payload jsonb NOT NULL,PRIMARY KEY(batch_id,source_id))`);
    const mapRow=async(kind:keyof typeof kinds,sourceId:string,appId:number,payload:unknown)=>client.query(`INSERT INTO bloodlink_dataset.${kind}_map(batch_id,source_id,application_id,payload) VALUES($1,$2,$3,$4)`,[batch,sourceId,appId,payload]);
    const credentials:Credentials=[];
    const staffMap=new Map<string,number>();
    for(const staff of tables.institution_staff) {
      const org=orgMap.get(staff.institution_id)!;
      let existing=existingStaff.find(u=>u.organization_id===org && (staff.is_bank_account!=='true'||u.is_bank_account));
      if(!existing) {
        const password=`Demo!${crypto.randomBytes(18).toString('base64url')}9a`;
        existing=(await client.query(`INSERT INTO users(email,password_hash,role,organization_id,is_bank_account,must_change_password)
          VALUES($1,$2,$3,$4,$5,true) RETURNING id`,[staff.email,await hashPassword(password),staff.role,org,staff.is_bank_account==='true'])).rows[0];
        credentials.push({email:staff.email,password,role:staff.role,institutionId:staff.institution_id});
      }
      staffMap.set(staff.institution_id,existing.id);
      await mapRow('staff',staff.source_staff_id,existing.id,staff);
    }
    await client.query('ANALYZE bloodlink_dataset.donors');
    await client.query('ANALYZE bloodlink_dataset.donor_map');
    await client.query('ANALYZE donor_profiles');
    await client.query(`UPDATE donor_profiles dp SET consent_status=s.consent_status,
      consent_recorded_at=NULLIF(s.consent_recorded_at,'')::timestamptz,availability_updated_at=s.availability_updated_at::timestamptz,
      city=s.city,province=s.province,source_verification_status=s.blood_group_verification,is_simulated=true,
      is_available=s.availability='Yes'
      FROM bloodlink_dataset.donors s JOIN bloodlink_dataset.donor_map m USING(batch_id,donor_id)
      WHERE s.batch_id=$1 AND dp.user_id=m.user_id`,[batch]);
    await client.query(`UPDATE organizations o SET is_simulated=true FROM bloodlink_dataset.institution_map m WHERE m.batch_id=$1 AND o.id=m.organization_id`,[batch]);
    // Align displayed stock categories with the application's existing 2/10 thresholds; retain original raw status and units.
    report.stockStatusAligned=(await client.query(`UPDATE blood_stocks s SET status=CASE WHEN available_units<=2 THEN 'Critical' WHEN available_units<10 THEN 'Low' ELSE 'Normal' END
      FROM bloodlink_dataset.institution_map m WHERE m.batch_id=$1 AND s.organization_id=m.organization_id
      AND s.status<>CASE WHEN available_units<=2 THEN 'Critical' WHEN available_units<10 THEN 'Low' ELSE 'Normal' END`,[batch])).rowCount||0;
    const details=new Map(tables.request_details.map(r=>[r.request_id,r]));
    const requestMap=new Map<string,number>();
    for(const r of base.tables.blood_requests) {
      const detail=details.get(r.request_id)!;
      const reason=r.status==='closed'?'Synthetic source closed; closure reason unknown; archived, not fulfilled':status(r)==='Cancelled'?'Synthetic source expired or not yet open':'Simulated institution request';
      const result=(await client.query(`INSERT INTO blood_requests(organization_id,blood_group,required_units,priority,radius_km,status,created_by,created_at,updated_at,
        approval_status,review_reason,reason,department,expires_at,outreach_target,source_status,is_simulated)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,'Approved',$9,$10,$11,$12,$13,$14,true) RETURNING id`,[
        orgMap.get(r.institution_id),r.requested_blood_group,Number(detail.required_units),({routine:'Normal',priority:'Urgent',urgent:'Emergency'} as Record<string,string>)[r.urgency],
        Number(r.radius_km),status(r),staffMap.get(r.institution_id),r.created_at,reason,detail.reason,detail.department,r.expires_at,Number(r.outreach_target),r.status])).rows[0];
      requestMap.set(r.request_id,result.id);await mapRow('request',r.request_id,result.id,{source:r,details:detail});
    }
    const links=new Map(tables.donation_institution_links.map(r=>[r.donation_event_id,r]));
    await chunks(base.tables.donation_history,async events=>{
      const records=events.map(e=>({source_id:e.donation_event_id,donor_id:donorMap.get(e.donor_id),organization_id:orgMap.get(links.get(e.donation_event_id)!.institution_id),
        units:Number(e.reported_units),date:e.donation_date,flag:flagged.has(e.donation_event_id),payload:{source:e,link:links.get(e.donation_event_id)}}));
      // Reserve explicit IDs to build deterministic mappings without per-row round trips.
      await client.query(`WITH input AS (
        SELECT x.*,nextval(pg_get_serial_sequence('public.donations','id'))::integer app_id FROM jsonb_to_recordset($2::jsonb)
        AS x(source_id text,donor_id integer,organization_id integer,units integer,date date,flag boolean,payload jsonb)),
        inserted AS (INSERT INTO donations(id,donor_id,organization_id,units_donated,donation_date,created_at,is_simulated,interval_policy_review_required)
          SELECT app_id,donor_id,organization_id,units,date,date::timestamptz,true,flag FROM input RETURNING id)
        INSERT INTO bloodlink_dataset.donation_map(batch_id,source_id,application_id,payload)
          SELECT $1,i.source_id,i.app_id,i.payload FROM input i JOIN inserted d ON d.id=i.app_id`,[batch,JSON.stringify(records)]);
    });
    for(const r of base.tables.donor_responses) {
      const source=requests.get(r.request_id)!;
      const closed=status(source)!=='Active'||closedResponses.has(r.response_id);
      const closeTime=closedResponses.has(r.response_id)?r.responded_at:Date.parse(source.expires_at)<=now.getTime()?source.expires_at:now.toISOString();
      const result=(await client.query(`INSERT INTO notifications(request_id,donor_id,title,message,response_status,responded_at,sent_at,closed_at)
        VALUES($1,$2,'DEMO blood donation request','Synthetic response history; no real notification was delivered',$3,$4,$5,$6) RETURNING id`,[
        requestMap.get(r.request_id),donorMap.get(r.donor_id),r.response_status==='no_response'?'pending':r.response_status,r.responded_at||null,r.notification_sent_at,closed?closeTime:null])).rows[0];
      await mapRow('response',r.response_id,result.id,r);
    }
    await client.query('UPDATE bloodlink_dataset.supplement_runs SET report=$2 WHERE id=$1',[id,report]);
    await client.query("INSERT INTO audit_logs(action,target_type,metadata) VALUES('SYNTHETIC_SUPPLEMENT_IMPORTED','dataset',$1)",[report]);
    for(const [kind] of Object.entries(kinds)) {
      const count=(await client.query(`SELECT count(*)::integer n FROM bloodlink_dataset.${kind}_map WHERE batch_id=$1`,[batch])).rows[0].n;
      const expected=kind==='request'?report.inserted.requests:kind==='donation'?report.inserted.donations:kind==='response'?report.inserted.responses:tables.institution_staff.length;
      requireValue(count===expected,`Import count mismatch: ${kind}`);
    }
    // A file-write failure must roll back account creation rather than strand credentials.
    if(credentials.length && persistCredentials)persistCredentials(credentials);
    await client.query('COMMIT');return {report:{...report,dryRun:false},credentials};
  } catch(error) {await client.query('ROLLBACK');throw error;} finally{client.release();}
}

if(require.main===module) {
  let database:Pool|undefined;
  (async()=>{
    const runtime=new URL(process.env.DATABASE_URL||''),owner=new URL(process.env.MIGRATION_DATABASE_URL||runtime.toString());
    requireValue(process.env.NODE_ENV==='development' && ['127.0.0.1','localhost','[::1]'].includes(owner.hostname),'Requires local development database');
    requireValue(runtime.host===owner.host&&runtime.pathname===owner.pathname,'Owner and runtime must target the same database');
    const apply=process.argv.includes('--apply');
    database=new Pool({connectionString:owner.toString(),options:'-c statement_timeout=60000 -c idle_in_transaction_session_timeout=60000'});
    const output=path.resolve(__dirname,'../../.qa-private/dataset-import');fs.mkdirSync(output,{recursive:true});
    const result=await importSupplement(database,loadSupplement(),apply,credentials=>{
      // Credentials never enter audit metadata, stdout or the dataset directory.
      fs.writeFileSync(path.join(output,'staff-credentials.json'),JSON.stringify(credentials,null,2),{mode:0o600,flag:'wx'});
    });
    fs.writeFileSync(path.join(output,apply?'supplement-import-report.json':'supplement-dry-run.json'),JSON.stringify(result.report,null,2));
    console.log(JSON.stringify(result.report,null,2));
  })().catch(e=>{console.error('Supplement import failed:',e.message);process.exitCode=1;}).finally(async()=>database?.end());
}
