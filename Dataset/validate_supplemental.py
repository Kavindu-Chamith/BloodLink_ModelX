#!/usr/bin/env python3
"""File-level BloodLink supplemental checks; requires no DB or external services."""
from pathlib import Path
import argparse, csv, json, hashlib, collections
from datetime import datetime, timezone
from generate_supplemental import read_csv, hash_file, PROVENANCE, distance_km, URGENCY_MAP

def dt(s):return datetime.fromisoformat(s.replace('Z','+00:00'))

def validate(source,out,reminder_days=56):
    donors=read_csv(source/'donors.csv'); institutions=read_csv(source/'institutions.csv'); requests=read_csv(source/'blood_requests.csv'); events=read_csv(source/'donation_history.csv'); responses=read_csv(source/'donor_responses.csv'); stocks=read_csv(source/'blood_stocks.csv')
    details=read_csv(out/'request_details.csv'); decisions=read_csv(out/'request_import_decisions.csv'); links=read_csv(out/'donation_institution_links.csv'); staff=read_csv(out/'institution_staff.csv')
    manifest=json.loads((out/'supplement_manifest.json').read_text())
    min_units,max_units=manifest['units_range']
    failures=[]; checks=collections.Counter(); flags=collections.Counter(); examples=collections.defaultdict(list)
    def check(yes,rule,description=''):
        checks[rule]+=1
        if not yes:
            if len(failures)<100:failures.append({'rule':rule,'description':str(description)[:180]})
            flags['validation_failures_total']+=1
    def flag(name,key):
        flags[name]+=1
        if len(examples[name])<12:examples[name].append(key)
    def unique(rows,key,table):
        check(len(rows)==len(set(x[key] for x in rows)),f'{table}_unique_{key}')
    d={x['donor_id']:x for x in donors};i={x['institution_id']:x for x in institutions};q={x['request_id']:x for x in requests};e={x['donation_event_id']:x for x in events}
    unique(donors,'donor_id','original_donors'); unique(institutions,'institution_id','original_institutions');unique(requests,'request_id','original_requests');unique(events,'donation_event_id','original_donations');unique(responses,'response_id','original_responses');unique(details,'request_id','supplement_requests');unique(decisions,'request_id','supplement_decisions');unique(links,'donation_event_id','supplement_links');unique(staff,'source_staff_id','supplement_staff');unique(staff,'institution_id','supplement_staff');unique(staff,'email','supplement_staff')
    check(len(details)==len(requests)==333,'request_row_count');check(len(links)==len(events)==71097,'donation_row_count');check(len(staff)==len(institutions)==48,'staff_row_count');check(len(decisions)==len(requests),'decisions_row_count')
    check({x['request_id'] for x in details}==set(q),'exact_request_coverage');check({x['request_id'] for x in decisions}==set(q),'exact_decisions_coverage');check({x['donation_event_id'] for x in links}==set(e),'exact_donation_coverage');check({x['institution_id'] for x in staff}==set(i),'exact_institution_staff_coverage')
    now=datetime.now(timezone.utc)
    for x in details:
        rid=x['request_id'];check(rid in q,'request_id_foreign_key',rid)
        check(x['required_units'].isdigit() and min_units<=int(x['required_units'])<=max_units,'required_units_valid',rid)
        check(x['generation_method']==f'seeded_independent_uniform_integer_{min_units}_to_{max_units}','required_units_method',rid)
        check('patient' not in x['reason'].lower() and 'patient' not in x['department'].lower(),'no_patient_details',rid)
        check(x['data_provenance']==PROVENANCE and x['is_simulated']=='true','request_provenance',rid)
    for x in decisions:
        rid=x['request_id'];src=q.get(rid)
        check(bool(src),'decision_request_fk',rid)
        if not src:continue
        for a,b in [('source_status','status'),('source_urgency','urgency'),('source_created_at','created_at'),('source_expires_at','expires_at')]:check(x[a]==src[b],'preserve_source_'+b,rid)
        check(x['app_urgency_demo_convention']==URGENCY_MAP[src['urgency']],'urgency_demo_map',rid)
        check(x['preserve_source_status']=='true','preserve_status_flag',rid)
        c=dt(src['created_at']);end=dt(src['expires_at'])
        check(c<end,'request_timestamp_order',rid)
        if src['status']=='active' and end<=now:flag('active_source_requests_now_expired',rid)
        if src['status']=='closed':flag('closed_source_requests_require_review',rid)
        if src['status']=='expired' and end>now:flag('source_expired_but_future_expiry',rid)
        check(x['data_provenance']==PROVENANCE and x['is_simulated']=='true','decision_provenance',rid)
    for x in links:
        eid=x['donation_event_id'];ev=e.get(eid)
        check(bool(ev),'donation_fk',eid)
        if not ev:continue
        check(x['donor_id']==ev['donor_id'] and x['donor_id'] in d,'donation_donor_fk',eid)
        check(x['institution_id'] in i,'donation_institution_fk',eid)
        if x['institution_id'] not in i or x['donor_id'] not in d:continue
        dd=d[x['donor_id']];ii=i[x['institution_id']]
        delta=distance_km(dd['latitude'],dd['longitude'],ii['latitude'],ii['longitude'])
        check(abs(delta-float(x['assignment_distance_km']))<=0.0011,'distance_haversine_correct',eid)
        nearest=sorted(distance_km(dd['latitude'],dd['longitude'],a['latitude'],a['longitude']) for a in institutions)[:3]
        check(delta<=nearest[-1]+0.00001,'assigned_within_top_3',eid)
        check(dt(ev['donation_date']+'T00:00:00Z')<=dt('2026-11-03T23:59:59Z'),'donation_date_not_after_snapshot_day',eid)
        check(int(ev['reported_units'])>0,'positive_original_donation_units',eid)
        check(x['data_provenance']==PROVENANCE and x['is_simulated']=='true','link_provenance',eid)
    for x in staff:
        iid=x['institution_id'];ins=i.get(iid)
        check(bool(ins),'staff_institution_fk',iid)
        if not ins:continue
        bank=ins['institution_type']=='mock_blood_bank'
        check(x['role']==('bloodbank_staff' if bank else 'hospital_staff'),'staff_role_mapping',iid)
        check(x['is_bank_account']==('true' if bank else 'false'),'bank_account_constraint_intent',iid)
        check(x['source_staff_id']=='STAFF-'+iid,'staff_id_mapping',iid)
        check(x['email'].endswith('@example.invalid') and x['email']==x['email'].lower(),'staff_safe_email',iid)
        check(x['must_change_password']=='true','staff_password_change',iid)
        check(x['data_provenance']==PROVENANCE and x['is_simulated']=='true','staff_provenance',iid)
        check(not any(k.lower() in ('password','password_hash','temporary_password','plain_password') for k in x),'no_password_columns',iid)
    # Examine source event inconsistencies without mutating original records.
    donor_events=collections.defaultdict(list)
    for row in events:donor_events[row['donor_id']].append(dt(row['donation_date']+'T00:00:00Z'))
    for donor_id,ds in donor_events.items():
        ds.sort()
        for a,b in zip(ds,ds[1:]):
            if (b-a).days < reminder_days:flag('history_interval_shorter_than_configurable_demo_reminder', donor_id)
    for x in responses:
        rid=x['request_id'];did=x['donor_id'];check(rid in q and did in d,'source_response_foreign_keys',x['response_id'])
        if rid not in q:continue
        sent=dt(x['notification_sent_at']);created=dt(q[rid]['created_at']); expiry=dt(q[rid]['expires_at'])
        check(created<=sent,'source_notification_after_request',x['response_id'])
        if sent>expiry:flag('source_notification_after_expiry',x['response_id'])
        if x['response_status']=='no_response':check(not x['responded_at'],'no_response_should_have_null_responded_at',x['response_id'])
        else:
            check(bool(x['responded_at']),'answered_response_timestamp_present',x['response_id'])
            if x['responded_at']:check(dt(x['responded_at'])>=sent,'response_after_notification',x['response_id'])
        if x['notification_delivery']=='simulated_delivered':flags['simulated_delivery_not_real_provider_receipt']+=1
        if x['response_status']=='accepted':
            if x['responded_at'] and dt(x['responded_at'])>expiry:flag('accepted_response_after_expiry',x['response_id'])
    # Detect donor accepted requests that overlap in request time windows; investigate at application import.
    by_donor=collections.defaultdict(list)
    for x in responses:
        if x['response_status']=='accepted' and x['request_id'] in q and x['responded_at']:
            req=q[x['request_id']];by_donor[x['donor_id']].append((dt(x['responded_at']),dt(req['expires_at']),x['request_id']))
    for did,items in by_donor.items():
        items.sort()
        for j, (accepted,expires,rid) in enumerate(items):
            for next_accepted,next_expires,next_rid in items[j+1:]:
                if next_accepted<expires:flag('potential_multiple_active_accepted_missions',f'{did}:{rid}:{next_rid}')
    # Unchanged stock and all other original input files.
    for name,sha in manifest['baseline_input_sha256'].items():check(hash_file(source/name)==sha,'synthetic_baseline_hash_unchanged',name)
    for name,sha in manifest['supplemental_csv_sha256'].items():check(hash_file(out/name)==sha,'supplemental_file_hash_matches_manifest',name)
    # Existing identities not edited (original source protected).
    check(all(k.lower() not in ('password','password_hash','temporary_password','plain_password') for rows in [details,links,staff,decisions] for x in rows[:1] for k in x),'no_password_field_any_supplement')
    check(len(stocks)==384,'original_stock_count_unchanged')
    # Program cannot assert database contents, migrations, rollback, notification safety, or idempotence.
    result={'status':'PASS_FILE_LEVEL' if not failures else 'FAIL_FILE_LEVEL','checked_at_utc':now.isoformat(timespec='seconds'),'source_snapshot_utc':'2026-11-03T00:00:00Z',
      'counts':{'request_details':len(details),'request_import_decisions':len(decisions),'donation_institution_links':len(links),'institution_staff':len(staff),'original_blood_stocks':len(stocks)},
      'checks_passed':sum(checks.values())-flags['validation_failures_total'],'checks_failed':flags['validation_failures_total'],
      'check_categories':dict(sorted(checks.items())), 'source_flags_needing_import_policy_or_review':dict(sorted((k,v) for k,v in flags.items() if k!='validation_failures_total')),
      'source_flag_examples':dict(examples),'failures':failures, 'configured_reminder_interval_days_for_FLAGGING_ONLY':reminder_days,
      'explicitly_not_run':['PostgreSQL importer','existing application mapping and account checks','database constraints','transaction/rollback','second importer execution','production guard','API filtering/matching/coverage','real notification dispatch controls','active mission constraint in application'],
      'notes':['No changes made to original source CSVs or original manifest.','Original data temporal flags are not rewritten.','Stock unchanged; historical donations never credited to stock.','Staff roles are candidate mappings, not confirmed against application schema.','Request urgency demo map is nonclinical.','Status closed cannot be inferred fulfilled.']}
    (out/'validation_report.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':result['status'],'passed':result['checks_passed'],'failed':result['checks_failed'],'flags':result['source_flags_needing_import_policy_or_review']}, indent=2))
    if failures:raise SystemExit(1)

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,default=Path(__file__).resolve().parent);ap.add_argument('--out',type=Path,default=Path(__file__).resolve().parent);ap.add_argument('--reminder-days',type=int,default=56)
    a=ap.parse_args();validate(a.source,a.out,a.reminder_days)
