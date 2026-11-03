#!/usr/bin/env python3
"""Generate self-contained, reproducible, entirely simulated BloodLink CSV fixtures.
No input donor records, credentials, or internet access are read by this generator.
Python 3.9+ standard library only. All dates UTC. Seeded for reproducibility.
"""
import argparse, csv, json, math, random
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

SNAPSHOT=datetime(2026,11,3,0,0,tzinfo=timezone.utc)
PROVENANCE='SYNTHETIC_TEST_DATA_NOT_REAL'
# Approximate town centers, manually curated for simulation, not legal district polygons.
# province, district, town, latitude, longitude
PLACES=[
('Western','Colombo','Colombo',6.93548,79.84868),('Western','Colombo','Maharagama',6.8480,79.9265),('Western','Colombo','Moratuwa',6.7730,79.8816),
('Western','Gampaha','Gampaha',7.0917,79.9997),('Western','Gampaha','Negombo',7.2083,79.8358),('Western','Gampaha','Ja-Ela',7.0744,79.8919),
('Western','Kalutara','Kalutara',6.5854,79.9607),('Western','Kalutara','Panadura',6.7132,79.9026),
('Central','Kandy','Kandy',7.2906,80.6336),('Central','Kandy','Gampola',7.1643,80.5762),
('Central','Matale','Matale',7.4675,80.6234),('Central','Matale','Dambulla',7.8600,80.6517),
('Central','Nuwara Eliya','Nuwara Eliya',6.9497,80.7891),('Central','Nuwara Eliya','Hatton',6.8916,80.5955),
('Southern','Galle','Galle',6.0461,80.2103),('Southern','Galle','Ambalangoda',6.2355,80.0538),
('Southern','Matara','Matara',5.9485,80.5353),('Southern','Matara','Weligama',5.9730,80.4297),
('Southern','Hambantota','Hambantota',6.1241,81.1185),('Southern','Hambantota','Tangalle',6.0234,80.7974),
('Northern','Jaffna','Jaffna',9.6684,80.0074),('Northern','Jaffna','Point Pedro',9.8167,80.2333),
('Northern','Kilinochchi','Kilinochchi',9.3803,80.3770),
('Northern','Mannar','Mannar',8.9779,79.9042),
('Northern','Vavuniya','Vavuniya',8.7514,80.4971),
('Northern','Mullaitivu','Mullaitivu',9.2671,80.8142),
('Eastern','Batticaloa','Batticaloa',7.7102,81.6924),('Eastern','Batticaloa','Kattankudy',7.6833,81.7333),
('Eastern','Ampara','Ampara',7.2917,81.6747),('Eastern','Ampara','Kalmunai',7.4090,81.8347),
('Eastern','Trincomalee','Trincomalee',8.5778,81.2289),('Eastern','Trincomalee','Kinniya',8.4978,81.1807),
('North Western','Kurunegala','Kurunegala',7.4863,80.3647),('North Western','Kurunegala','Kuliyapitiya',7.4688,80.0401),
('North Western','Puttalam','Puttalam',8.0362,79.8283),('North Western','Puttalam','Chilaw',7.5758,79.7953),
('North Central','Anuradhapura','Anuradhapura',8.3114,80.4037),('North Central','Anuradhapura','Kekirawa',8.0400,80.5980),
('North Central','Polonnaruwa','Polonnaruwa',7.9403,81.0188),('North Central','Polonnaruwa','Hingurakgoda',8.0367,80.9486),
('Uva','Badulla','Badulla',6.9934,81.0550),('Uva','Badulla','Bandarawela',6.8288,80.9857),
('Uva','Monaragala','Monaragala',6.8714,81.3487),('Uva','Monaragala','Wellawaya',6.7371,81.1034),
('Sabaragamuwa','Ratnapura','Ratnapura',6.6828,80.3992),('Sabaragamuwa','Ratnapura','Balangoda',6.6464,80.7047),
('Sabaragamuwa','Kegalle','Kegalle',7.2513,80.3464),('Sabaragamuwa','Kegalle','Mawanella',7.2536,80.4467),
]
GIVEN=['Nethmi','Dinuka','Amasha','Dulani','Sahan','Kavisha','Ishara','Tharindu','Shenali','Lahiru','Yasiru','Sanduni','Janith','Piumi','Nimasha','Ravindu','Sithumi','Dinesh','Hasini','Malith','Ayesha','Fathima','Mohamed','Ahamed','Zahra','Rizwan','Nusra','Imran','Ameen','Farhana','Arun','Kavitha','Niroshan','Tharshini','Sivakumar','Shalini','Priya','Sanjayan','Yalini','Kishore','Dilshan','Roshan','Sachini','Nipuna','Lakshani','Dhanushka','Rehana','Nawaz']
FAMILY=['Perera','Silva','Fernando','Jayasinghe','Wijesinghe','Herath','Bandara','Rathnayake','Gunasekara','Abeysekara','Ekanayake','Senanayake','Karunaratne','Dissanayake','Samarasinghe','Weerasinghe','Amarasinghe','De Silva','Mohideen','Hussain','Ismail','Rahman','Fazil','Nazar','Kumar','Rajan','Selvarajah','Kanagaratnam','Sivarajah','Tharmalingam','Nadarajah','Subramaniam','Balasubramaniam','Ibrahim','Manoharan','Wickramasinghe','Pathirana','Madushanka','De Alwis','Nirmalan']
GROUPS=['A+','A-','B+','B-','AB+','AB-','O+','O-']
# Aggregates only from supplied 10k-row sample; no original row data retained.
GROUP_WEIGHTS=[1238,1236,1282,1290,1219,1284,1240,1211]

def stamp(dt): return dt.isoformat(timespec='seconds').replace('+00:00','Z')
def date(dt): return dt.date().isoformat()
def write_csv(path, rows, fields):
    with open(path,'w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction='raise'); w.writeheader();w.writerows(rows)
def random_time(rng,start,end):
    seconds=int((end-start).total_seconds())
    return start+timedelta(seconds=rng.randrange(max(1,seconds+1)))
def distance_km(a,b,c,d):
    p1,p2=math.radians(a),math.radians(c);dp=p2-p1;dl=math.radians(d-b)
    q=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 6371.0088*2*math.asin(min(1,math.sqrt(q)))
def offset(rng,lat,lon):
    # Approx. 0-2.0 km displacement; center is reference town, not a home address.
    radius=2.0*math.sqrt(rng.random()); angle=2*math.pi*rng.random()
    return round(lat+radius*math.cos(angle)/111.2,6),round(lon+radius*math.sin(angle)/(111.2*math.cos(math.radians(lat))),6)

def generate(out,n,seed):
    rng=random.Random(seed);out.mkdir(parents=True,exist_ok=True)
    locs=[{'location_id':f'LOC{i:03d}','country':'Sri Lanka','province':province,'district':district,'city':city,'center_latitude':f'{lat:.6f}','center_longitude':f'{lon:.6f}','coordinate_quality':'approximate_reference_town_center','data_provenance':PROVENANCE} for i,(province,district,city,lat,lon) in enumerate(PLACES,1)]
    write_csv(out/'locations_reference.csv',locs,list(locs[0]))
    # Guarantee every district represented, then assign  rest with mildly urban weighted distribution.
    districts=sorted({p[1] for p in PLACES}); bydistrict=defaultdict(list)
    for p in PLACES:bydistrict[p[1]].append(p)
    assignments=[rng.choice(bydistrict[d]) for d in districts]
    major={'Colombo':4,'Gampaha':4,'Kandy':2.5,'Galle':2.2,'Kurunegala':2,'Ratnapura':1.7,'Kalutara':1.7,'Jaffna':1.5,'Matara':1.5}
    weights=[major.get(p[1],1) for p in PLACES]
    assignments+=rng.choices(PLACES,weights,k=n-len(assignments)); rng.shuffle(assignments)
    donor_rows=[]; histories=[]
    for i,(province,district,city,clat,clon) in enumerate(assignments,1):
        did=f'BLD{i:06d}'; lat,lon=offset(rng,clat,clon)
        created=random_time(rng,datetime(2019,1,1,tzinfo=timezone.utc),SNAPSHOT-timedelta(days=2))
        last_update=random_time(rng,created,SNAPSHOT)
        # Deliberately include stale profiles; 70% recent updates where account age allows.
        if rng.random()<.70:
            last_update=random_time(rng,max(created,SNAPSHOT-timedelta(days=28)),SNAPSHOT)
        group=rng.choices(GROUPS,GROUP_WEIGHTS,k=1)[0]
        available=rng.random()<.5085
        consent=rng.choices(['granted','withdrawn','not_provided'],[.79,.08,.13])[0]
        consent_time=random_time(rng,created,last_update) if consent in ('granted','withdrawn') else None
        verification=rng.choices(['verified','pending','rejected','unverified'],[.67,.14,.05,.14])[0]
        # Synthetic history is consistent with interval reminders, NOT a medical clearance.
        max_events=min(30,int((SNAPSHOT-created).days//70)+1)
        count=rng.randint(0,max_events) if rng.random()<.74 else 0
        donation_dates=[]
        if count:
            span=(SNAPSHOT-created).days
            # pick separated dates (at least 56 days); first date no earlier than registration.
            remaining=span-56*(count-1)
            if remaining<0:count=0
            else:
                gaps=sorted(rng.sample(range(remaining+1),count)) if remaining+1>=count else sorted(rng.choices(range(remaining+1),k=count))
                donation_dates=[created.date()+timedelta(days=56*j+gaps[j]) for j in range(count)]
        count=len(donation_dates)
        last_donation=donation_dates[-1].isoformat() if count else ''
        first_donation=donation_dates[0].isoformat() if count else ''
        months=round((SNAPSHOT.date()-donation_dates[0]).days/30.4375) if count else 0
        # One reported collection unit per synthetic donation event, not a medical/stock fact.
        first=GIVEN[rng.randrange(len(GIVEN))]; last=FAMILY[rng.randrange(len(FAMILY))]
        row={'donor_id':did,'fictional_name':first+' '+last,'test_email':f'bloodlink.donor{i:06d}@example.invalid','test_contact':f'TEST-LK-{i:06d}','country':'Sri Lanka','province':province,'district':district,'city':city,'latitude':f'{lat:.6f}','longitude':f'{lon:.6f}','coordinate_quality':'simulated_within_2km_of_city_center','blood_group':group,'blood_group_verification':verification,'availability':'Yes' if available else 'No','availability_updated_at':stamp(last_update),'availability_freshness_days':(SNAPSHOT-last_update).days,'consent_status':consent,'consent_recorded_at':stamp(consent_time) if consent_time else '','number_of_donations':count,'pints_donated':count,'first_donation_date':first_donation,'last_donation_date':last_donation,'months_since_first_donation':months,'created_at':stamp(created),'data_provenance':PROVENANCE}
        donor_rows.append(row)
        for j,dd in enumerate(donation_dates,1):histories.append({'donation_event_id':f'{did}-E{j:02d}','donor_id':did,'donation_date':dd.isoformat(),'reported_units':1,'event_status':'simulated_history','data_provenance':PROVENANCE})
    write_csv(out/'donors.csv',donor_rows,list(donor_rows[0]));write_csv(out/'donation_history.csv',histories,['donation_event_id','donor_id','donation_date','reported_units','event_status','data_provenance'])
    # Mock institutions do not purport to represent real official accounts or live stock.
    institutions=[]
    for j,p in enumerate(PLACES,1):
        province,district,city,lat,lon=p
        institutions.append({'institution_id':f'INS{j:03d}','institution_name':f'BloodLink Mock Coordination Centre {j:03d} ({city})','institution_type':rng.choice(['mock_hospital','mock_blood_bank']),'province':province,'district':district,'city':city,'latitude':f'{lat:.6f}','longitude':f'{lon:.6f}','staff_authorization':'verified_simulated','data_provenance':PROVENANCE})
    write_csv(out/'institutions.csv',institutions,list(institutions[0]))
    # Time-limited requests; some are ongoing at the frozen snapshot.
    requests=[];req_times={};request_count=max(125,n//30)
    for j in range(1,request_count+1):
        ins=rng.choice(institutions);active_candidate=j%9==0
        start=random_time(rng,SNAPSHOT-timedelta(hours=30),SNAPSHOT-timedelta(minutes=20)) if active_candidate else random_time(rng,SNAPSHOT-timedelta(days=65),SNAPSHOT-timedelta(days=3))
        expiry=start+timedelta(hours=rng.randrange(3,49))
        status='active' if expiry>SNAPSHOT and start<=SNAPSHOT else 'expired'
        if status=='expired' and rng.random()<.18:status='closed'
        rid=f'REQ{j:05d}';req_times[rid]=(start,expiry)
        requests.append({'request_id':rid,'institution_id':ins['institution_id'],'requested_blood_group':rng.choices(GROUPS,GROUP_WEIGHTS)[0],'urgency':rng.choice(['routine','priority','urgent']),'outreach_target':rng.randint(3,20),'radius_km':rng.choice([10,25,50]),'created_at':stamp(start),'expires_at':stamp(expiry),'status':status,'verified_institution_request':'simulated_verified','data_provenance':PROVENANCE})
    write_csv(out/'blood_requests.csv',requests,list(requests[0]))
    # Responses must reference real request and donor IDs, respect timestamps, uniqueness and matching rules.
    donor_by_group=defaultdict(list)
    for d in donor_rows:
        if d['consent_status']=='granted' and d['blood_group_verification']=='verified' and d['availability']=='Yes' and int(d['availability_freshness_days'])<=30:
            donor_by_group[d['blood_group']].append(d)
    ins_index={d['institution_id']:d for d in institutions};responses=[];response_id=0
    for request in requests:
        ins=ins_index[request['institution_id']];start,expiry=req_times[request['request_id']]
        eligible=[d for d in donor_by_group[request['requested_blood_group']] if distance_km(float(d['latitude']),float(d['longitude']),float(ins['latitude']),float(ins['longitude']))<=int(request['radius_km']) and not(d['last_donation_date'] and (start.date()-datetime.fromisoformat(d['last_donation_date']).date()).days<90) and datetime.fromisoformat(d['created_at'].replace('Z','+00:00'))<=start and datetime.fromisoformat(d['availability_updated_at'].replace('Z','+00:00'))<=start]
        rng.shuffle(eligible)
        for d in eligible[:rng.randrange(0,min(12,len(eligible))+1)]:
            # Notification and response are simulated event facts; no real messages sent.
            sent=start+timedelta(minutes=rng.randint(1,15));end=min(expiry,SNAPSHOT)
            if sent>=end:continue
            state=rng.choices(['accepted','declined','no_response'],[.35,.25,.40])[0]
            responded=random_time(rng,sent,end) if state!='no_response' else None
            response_id+=1
            responses.append({'response_id':f'RSP{response_id:06d}','request_id':request['request_id'],'donor_id':d['donor_id'],'notification_sent_at':stamp(sent),'response_status':state,'responded_at':stamp(responded) if responded else '','notification_delivery':'simulated_delivered','distance_km':f"{distance_km(float(d['latitude']),float(d['longitude']),float(ins['latitude']),float(ins['longitude'])):.3f}",'data_provenance':PROVENANCE})
    write_csv(out/'donor_responses.csv',responses,['response_id','request_id','donor_id','notification_sent_at','response_status','responded_at','notification_delivery','distance_km','data_provenance'])
    stock_rows=[];stock_id=0
    for ins in institutions:
        for group in GROUPS:
            stock_id+=1;units=rng.randrange(0,55)
            level='critical' if units<7 else 'low' if units<18 else 'normal'
            stock_rows.append({'stock_record_id':f'STK{stock_id:05d}','institution_id':ins['institution_id'],'blood_group':group,'simulated_units':units,'stock_status':level,'recorded_at':stamp(SNAPSHOT-timedelta(hours=rng.randint(0,72))),'data_provenance':PROVENANCE})
    write_csv(out/'blood_stocks.csv',stock_rows,list(stock_rows[0]))
    manifest={'dataset_name':'BloodLink Synthetic Test Fixtures','data_provenance':PROVENANCE,'snapshot_utc':stamp(SNAPSHOT),'random_seed':seed,'requested_donors':n,'generated_counts':{'donors':len(donor_rows),'locations_reference':len(locs),'donation_history':len(histories),'institutions':len(institutions),'blood_requests':len(requests),'donor_responses':len(responses),'blood_stocks':len(stock_rows)},'source_reference':'Original uploaded sample examined for schema and aggregate blood-group/availability patterns ONLY; no source rows or personal attributes were reused.','matching_scope':'Exact same blood group for outreach simulations only; never clinical transfusion compatibility or medical eligibility','geography':'Curated approximate city centers; simulated donor coordinates lie within 2 km of reference town centers; no district polygon/geocoding validation','license_note':'Original dataset licensing remains unverified; generator uses only aggregate counts, not original donor records.'}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    return manifest

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='.',help='Output directory');parser.add_argument('--count',type=int,default=10000);parser.add_argument('--seed',type=int,default=20261103);args=parser.parse_args()
    if args.count<25:parser.error('--count must be >= 25 to cover all districts')
    print(json.dumps(generate(Path(args.output),args.count,args.seed),indent=2))
