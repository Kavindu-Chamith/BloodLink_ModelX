#!/usr/bin/env python3
"""Independent validation of generated BloodLink synthetic fixture CSVs."""
import csv,json,sys,math
from datetime import datetime,date,timedelta,timezone
from collections import Counter,defaultdict
from pathlib import Path

EXPECTED_DISTRICTS={'Colombo','Gampaha','Kalutara','Kandy','Matale','Nuwara Eliya','Galle','Matara','Hambantota','Jaffna','Kilinochchi','Mannar','Vavuniya','Mullaitivu','Batticaloa','Ampara','Trincomalee','Kurunegala','Puttalam','Anuradhapura','Polonnaruwa','Badulla','Monaragala','Ratnapura','Kegalle'}
PROVENANCE='SYNTHETIC_TEST_DATA_NOT_REAL'; GROUPS={'A+','A-','B+','B-','AB+','AB-','O+','O-'}
def parse(x):return datetime.fromisoformat(x.replace('Z','+00:00'))
def load(path):
    with open(path,newline='',encoding='utf-8') as f:return list(csv.DictReader(f))
def km(a,b,c,d):
    p1,p2=math.radians(a),math.radians(c);dp=p2-p1;dl=math.radians(d-b)
    x=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 6371.0088*2*math.asin(min(1,math.sqrt(x)))
def validate(root):
    manifest=json.loads((root/'manifest.json').read_text());snap=parse(manifest['snapshot_utc'])
    names=['donors','locations_reference','donation_history','institutions','blood_requests','donor_responses','blood_stocks']
    d={name:load(root/(name+'.csv')) for name in names};errors=[];checks=Counter()
    def ensure(condition,msg):
        checks['total']+=1
        if not condition:
            if len(errors)<100:errors.append(msg)
        else:checks['passed']+=1
    def unique(rows,key,name):ensure(len(rows)==len({r[key] for r in rows}),f'{name}: duplicate {key}')
    for name,rows in d.items():
        ensure(len(rows)==manifest['generated_counts'][name],f'{name}: count mismatch')
        ensure(all(r.get('data_provenance')==PROVENANCE for r in rows),f'{name}: missing synthetic provenance')
    donors=d['donors'];locs=d['locations_reference'];hist=d['donation_history'];inst=d['institutions'];requests=d['blood_requests'];responses=d['donor_responses'];stocks=d['blood_stocks']
    ensure(len(donors)==10000,'expected 10000 donors');ensure(len({r['district'] for r in donors})==25,'donor district coverage !=25')
    ensure({r['district'] for r in donors}==EXPECTED_DISTRICTS,'district set inconsistent')
    ensure(len({r['province'] for r in donors})==9,'expected 9 provinces')
    for name,key in [('donors','donor_id'),('locations_reference','location_id'),('donation_history','donation_event_id'),('institutions','institution_id'),('blood_requests','request_id'),('donor_responses','response_id'),('blood_stocks','stock_record_id')]:unique(d[name],key,name)
    centers={(r['province'],r['district'],r['city']):(float(r['center_latitude']),float(r['center_longitude'])) for r in locs}
    ensure(len(centers)==len(locs),'duplicate province/district/city locs')
    ensure({r['district'] for r in locs}==EXPECTED_DISTRICTS,'reference missing district')
    don={r['donor_id']:r for r in donors};instit={r['institution_id']:r for r in inst};reqs={r['request_id']:r for r in requests}
    bydon=defaultdict(list)
    for h in hist:
        ensure(h['donor_id'] in don,'history orphan donor')
        bydon[h['donor_id']].append(h)
        ensure(h['reported_units']=='1','history reported_units not 1')
    for idx,r in enumerate(donors):
        key=(r['province'],r['district'],r['city']);ensure(key in centers,f'donor location mapping invalid: {idx}')
        if key in centers:
            a,b=centers[key];lat,lon=float(r['latitude']),float(r['longitude'])
            ensure(km(lat,lon,a,b)<=2.02,f'donor {idx}: outside 2km simulated city radius')
        ensure(r['blood_group'] in GROUPS,f'donor {idx} invalid blood group')
        ensure(r['test_email'].endswith('@example.invalid') and r['test_contact'].startswith('TEST-LK-'),f'donor {idx}: unsafe test contact')
        ensure(r['consent_status'] in {'granted','withdrawn','not_provided'},f'donor {idx}: consent invalid')
        ensure(r['blood_group_verification'] in {'verified','pending','rejected','unverified'},f'donor {idx}: verification invalid')
        ensure(r['availability'] in {'Yes','No'},f'donor {idx}: availability invalid')
        creation=parse(r['created_at']);upd=parse(r['availability_updated_at'])
        ensure(creation<=upd<=snap,f'donor {idx}: timestamp order invalid')
        ensure(int(r['availability_freshness_days'])==(snap-upd).days,f'donor {idx}: freshness mismatch')
        ct=r['consent_recorded_at']
        ensure((ct=='')==(r['consent_status']=='not_provided'),f'donor {idx}: consent timestamp inconsistent')
        if ct:ensure(creation<=parse(ct)<=upd,f'donor {idx}: consent timestamp invalid')
        dates=sorted(date.fromisoformat(h['donation_date']) for h in bydon[r['donor_id']])
        cnt=int(r['number_of_donations'])
        ensure(cnt==len(dates)==int(r['pints_donated']),f'donor {idx}: donation counts mismatch')
        ensure((not dates and not r['first_donation_date'] and not r['last_donation_date'] and int(r['months_since_first_donation'])==0) or (bool(dates) and r['first_donation_date']==dates[0].isoformat() and r['last_donation_date']==dates[-1].isoformat()),f'donor {idx}: donation range mismatch')
        if dates:
            ensure(dates[0]>=creation.date() and dates[-1]<=snap.date(),f'donor {idx}: donation event outside valid dates')
            ensure(all((y-x).days>=56 for x,y in zip(dates,dates[1:])),f'donor {idx}: donation events <56d apart')
            ensure(int(r['months_since_first_donation'])==round((snap.date()-dates[0]).days/30.4375),f'donor {idx}: months calculation wrong')
    ensure(len({r['test_email'] for r in donors})==len(donors),'duplicate email')
    ensure(len({r['test_contact'] for r in donors})==len(donors),'duplicate test contacts')
    ensure(all('password' not in r and 'email' not in r and 'name' not in r for r in donors),'unsafe legacy headers')
    for r in inst:
        ensure((r['province'],r['district'],r['city']) in centers,'institution city mapping invalid')
        ensure(r['staff_authorization']=='verified_simulated','institution authorization not explicitly simulated')
    for r in requests:
        ensure(r['institution_id'] in instit,'request institution foreign key invalid')
        ensure(r['requested_blood_group'] in GROUPS,'request invalid group')
        created,expiry=parse(r['created_at']),parse(r['expires_at'])
        ensure(created<expiry,'request invalid expiry')
        ensure(r['status']==('active' if expiry>snap else r['status']) and (r['status']!='active' or expiry>snap),'active expired request')
        ensure(r['status'] in {'active','expired','closed'},'invalid request status')
        ensure(r['verified_institution_request']=='simulated_verified','request verification label invalid')
    pairs=set()
    for r in responses:
        did,rid=r['donor_id'],r['request_id'];ensure(did in don and rid in reqs,'orphan response reference')
        pair=(rid,did);ensure(pair not in pairs,'duplicate donor response to same request');pairs.add(pair)
        if did not in don or rid not in reqs:continue
        dnr=don[did];req=reqs[rid];ins=instit[req['institution_id']]
        ensure(dnr['blood_group']==req['requested_blood_group'],'response group mismatch')
        ensure(dnr['consent_status']=='granted' and dnr['availability']=='Yes' and dnr['blood_group_verification']=='verified','response donor eligibility filter mismatch')
        ensure(int(dnr['availability_freshness_days'])<=30,'response donor availability stale')
        dist=km(float(dnr['latitude']),float(dnr['longitude']),float(ins['latitude']),float(ins['longitude']))
        ensure(dist<=int(req['radius_km']) and abs(dist-float(r['distance_km']))<.001,'response radius or distance inconsistent')
        sent=parse(r['notification_sent_at']);start=parse(req['created_at']);end=parse(req['expires_at']);update=parse(dnr['availability_updated_at'])
        ensure(start<=sent<=end and sent<=snap and update<=start,'response timing invalid')
        ensure(r['response_status'] in {'accepted','declined','no_response'},'response status invalid')
        ensure((r['response_status']=='no_response')==(r['responded_at']==''),'response timestamp missing/unexpected')
        if r['responded_at']:ensure(sent<=parse(r['responded_at'])<=min(end,snap),'response event outside request window')
        if dnr['last_donation_date']:ensure((start.date()-date.fromisoformat(dnr['last_donation_date'])).days>=90,'response donor last donation <90 days')
    stockpairs=set()
    for r in stocks:
        ensure(r['institution_id'] in instit and r['blood_group'] in GROUPS,'invalid stock institution or group')
        pair=(r['institution_id'],r['blood_group']);ensure(pair not in stockpairs,'duplicate stock snapshot');stockpairs.add(pair)
        units=int(r['simulated_units']);level='critical' if units<7 else 'low' if units<18 else 'normal'
        ensure(r['stock_status']==level,'stock status not tied to mock thresholds')
        ensure(parse(r['recorded_at'])<=snap,'stock recorded after snapshot')
    ensure(len(stocks)==len(inst)*8,'all institution-group stock pairs missing')
    counts={name:len(rows) for name,rows in d.items()}
    report={'validation_status':'PASS' if not errors else 'FAIL','executed_code':True,'validation_timestamp_utc':datetime.now(timezone.utc).isoformat(timespec='seconds'),'snapshot_utc':manifest['snapshot_utc'],'test_assertions_executed':checks['total'],'test_assertions_passed':checks['passed'],'test_assertions_failed':checks['total']-checks['passed'],'errors':errors,'generated_row_counts':counts,'distinct_districts':len({r['district'] for r in donors}),'distinct_provinces':len({r['province'] for r in donors}),'donors_per_district':dict(sorted(Counter(r['district'] for r in donors).items())),'donor_blood_groups':dict(sorted(Counter(r['blood_group'] for r in donors).items())),'donor_availability':dict(sorted(Counter(r['availability'] for r in donors).items())),'consent_states':dict(Counter(r['consent_status'] for r in donors)),'request_statuses':dict(Counter(r['status'] for r in requests)),'response_statuses':dict(Counter(r['response_status'] for r in responses)),'scope_of_validation':'CSV schema, referential integrity, cross-file timestamps, fake contacts, donation history, city reference within 2 km, district/province coverage, state labels and simulated matching rules; not geospatial boundary accuracy, legal licensing or clinical eligibility.'}
    (root/'validation_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    return report
if __name__=='__main__':
    root=Path(sys.argv[1]) if len(sys.argv)>1 else Path('.')
    result=validate(root);print(json.dumps({k:result[k] for k in ('validation_status','test_assertions_executed','test_assertions_failed','generated_row_counts','distinct_districts')},indent=2))
    sys.exit(0 if result['validation_status']=='PASS' else 1)
