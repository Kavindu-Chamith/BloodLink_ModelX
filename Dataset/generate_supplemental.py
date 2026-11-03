#!/usr/bin/env python3
"""Generate synthetic, non-clinical supplement WITHOUT changing BloodLink source CSVs.
Python 3.10+; standard library only. No repository/database/network calls.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, math, random
from pathlib import Path
from datetime import datetime, timezone

PROVENANCE = 'SYNTHETIC_TEST_DATA_NOT_REAL'
SEED = 20261104
SNAPSHOT = '2026-11-03T00:00:00Z'
REQUEST_DEPARTMENTS = ('Donor Coordination Desk', 'Community Outreach Unit', 'Blood Collection Scheduling', 'Volunteer Coordination Desk')
REQUEST_REASONS = ('Mock outreach coverage exercise', 'Simulated routine donor recruitment', 'Synthetic volunteer-response drill', 'Demo coordination capacity check')
FIRST = ('Nimali', 'Aruni', 'Tharushi', 'Kasun', 'Chamara', 'Sanjana', 'Isuru', 'Hasini', 'Dilshan', 'Amaya', 'Ravindu', 'Fathima', 'Ahamed', 'Nivetha', 'Praveen', 'Kavitha', 'Shanika', 'Dinuka', 'Yasmin', 'Thilina')
LAST = ('Perera', 'Fernando', 'Silva', 'Jayawardena', 'Wickramasinghe', 'Mohamed', 'Rajendran', 'Ramanathan', 'Karunaratne', 'Pathirana', 'Samarasinghe', 'Nadarajah', 'Hameed', 'Ratnayake', 'Abeysekara')
URGENCY_MAP = {'routine':'Normal', 'priority':'Urgent', 'urgent':'Emergency'}


def read_csv(path):
    with open(path, newline='', encoding='utf-8-sig') as f: return list(csv.DictReader(f))

def write_csv(path, fields, rows):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator='\n')
        w.writeheader(); w.writerows(rows)

def distance_km(a, b, c, d):
    a,b,c,d = [math.radians(float(x)) for x in (a,b,c,d)]
    dl, dg = c-a,d-b
    h = math.sin(dl/2)**2 + math.cos(a)*math.cos(c)*math.sin(dg/2)**2
    return 6371.0088*2*math.asin(min(1., math.sqrt(h)))

def hash_file(path):
    h=hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda:f.read(1048576),b''):h.update(chunk)
    return h.hexdigest()

def row_rng(key):
    digest = hashlib.sha256(f'{SEED}:{key}'.encode()).digest()
    return random.Random(int.from_bytes(digest[:8], 'big'))

def generate(source, out, min_units, max_units):
    out.mkdir(parents=True, exist_ok=True)
    names = ['donors.csv','institutions.csv','blood_requests.csv','donor_responses.csv','donation_history.csv','blood_stocks.csv','locations_reference.csv']
    missing=[name for name in names if not (source/name).is_file()]
    if missing:raise FileNotFoundError(f'Missing original files: {missing}')
    donors = read_csv(source/'donors.csv'); institutions=read_csv(source/'institutions.csv')
    requests=read_csv(source/'blood_requests.csv'); events=read_csv(source/'donation_history.csv')
    if len(set(x['donor_id'] for x in donors)) != len(donors): raise ValueError('Original donor IDs not unique')
    if len(set(x['institution_id'] for x in institutions)) != len(institutions):raise ValueError('Original institution IDs not unique')
    if len(set(x['request_id'] for x in requests)) != len(requests):raise ValueError('Original request IDs not unique')
    if len(set(x['donation_event_id'] for x in events)) != len(events):raise ValueError('Original donation event IDs not unique')
    if not 1 <= min_units <= max_units <= 999:raise ValueError('Invalid positive required_units range')
    dmap={x['donor_id']:x for x in donors}
    req_rows=[]; decision_rows=[]
    for x in requests:
        r=row_rng('request:'+x['request_id'])
        req_rows.append({'request_id':x['request_id'], 'required_units':r.randint(min_units,max_units),
           'reason':r.choice(REQUEST_REASONS),'department':r.choice(REQUEST_DEPARTMENTS),
           'generation_method':f'seeded_independent_uniform_integer_{min_units}_to_{max_units}',
           'data_provenance':PROVENANCE,'is_simulated':'true'})
        decision_rows.append({'request_id':x['request_id'],'source_status':x['status'],
            'source_urgency':x['urgency'],'app_urgency_demo_convention':URGENCY_MAP.get(x['urgency'],'UNMAPPED'),
            'source_created_at':x['created_at'],'source_expires_at':x['expires_at'],
            'operational_status_guidance':'evaluate_expiry_at_import_for_active' if x['status']=='active' else ('Cancelled_due_to_expiry' if x['status']=='expired' else 'REVIEW_CLOSED_NOT_PROVEN_FULFILLED'),
            'preserve_source_status':'true','data_provenance':PROVENANCE,'is_simulated':'true'})
    write_csv(out/'request_details.csv', ['request_id','required_units','reason','department','generation_method','data_provenance','is_simulated'],req_rows)
    write_csv(out/'request_import_decisions.csv',['request_id','source_status','source_urgency','app_urgency_demo_convention','source_created_at','source_expires_at','operational_status_guidance','preserve_source_status','data_provenance','is_simulated'],decision_rows)

    # Distances based on present simulated donor coordinates and simulated institution positions.
    # Seeded selection among 3 nearest institutions; donor's historical residences unknown.
    nearest={}
    for donor_id, d in dmap.items():
        nearest[donor_id]=sorted([(distance_km(d['latitude'],d['longitude'],i['latitude'],i['longitude']),i['institution_id']) for i in institutions], key=lambda z:(z[0],z[1]))[:3]
    link_rows=[]
    weights=(0.65,0.25,0.10)
    for ev in events:
        donor_id=ev['donor_id']
        if donor_id not in nearest:raise ValueError(f'Orphan source donation event: {ev["donation_event_id"]}')
        r=row_rng('donation:'+ev['donation_event_id'])
        choices=nearest[donor_id]
        idx=r.choices(range(len(choices)), weights=weights[:len(choices)], k=1)[0]
        dist, ins=choices[idx]
        link_rows.append({'donation_event_id':ev['donation_event_id'],'donor_id':donor_id,
           'institution_id':ins,'assignment_method':'seeded_weighted_choice_among_3_nearest_current_simulated_sites',
           'assignment_distance_km':f'{dist:.3f}', 'data_provenance':PROVENANCE,'is_simulated':'true'})
    write_csv(out/'donation_institution_links.csv',['donation_event_id','donor_id','institution_id','assignment_method','assignment_distance_km','data_provenance','is_simulated'],link_rows)

    staff=[]
    for inst in institutions:
        id_=inst['institution_id']; r=row_rng('staff:'+id_)
        bank=inst['institution_type']=='mock_blood_bank'
        if not bank and inst['institution_type']!='mock_hospital': raise ValueError('Unexpected institution type')
        staff.append({'source_staff_id':f'STAFF-{id_}', 'institution_id':id_,
            'fictional_full_name':f'{r.choice(FIRST)} {r.choice(LAST)}',
            'email':f'bloodlink.staff.{id_.lower()}@example.invalid',
            'role':'bloodbank_staff' if bank else 'hospital_staff',
            'is_bank_account':'true' if bank else 'false',
            'must_change_password':'true', 'data_provenance':PROVENANCE, 'is_simulated':'true'})
    write_csv(out/'institution_staff.csv',['source_staff_id','institution_id','fictional_full_name','email','role','is_bank_account','must_change_password','data_provenance','is_simulated'],staff)

    manifest={'package':'BloodLink synthetic supplementary fixtures','data_provenance':PROVENANCE,
      'original_snapshot_utc':SNAPSHOT,'generation_seed':SEED,'generated_at_utc':datetime.now(timezone.utc).isoformat(timespec='seconds'),
      'units_range':[min_units,max_units], 'historical_site_assignment':'weighted among three nearest current simulated institutions; not actual historical residence or hospital',
      'original_input_sha256':{n:hash_file(source/n) for n in names},
      'supplemental_csv_sha256':{p.name:hash_file(p) for p in sorted(out.glob('*.csv'))},
      'generated_row_counts':{'request_details':len(req_rows),'request_import_decisions':len(decision_rows),'donation_institution_links':len(link_rows),'institution_staff':len(staff)},
      'fixed_source_data_modified':False, 'actual_user_credentials_generated':False}
    (out/'supplement_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest['generated_row_counts'],indent=2))

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--source',type=Path,default=Path(__file__).resolve().parents[2]/'bloodlink_synthetic_dataset');a.add_argument('--out',type=Path,default=Path(__file__).resolve().parent);a.add_argument('--min-units',type=int,default=1);a.add_argument('--max-units',type=int,default=6)
    x=a.parse_args();generate(x.source,x.out,x.min_units,x.max_units)
