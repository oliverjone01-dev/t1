import csv,json,hashlib,re
from pathlib import Path
from datetime import datetime,timedelta
from decimal import Decimal,ROUND_HALF_UP
root=Path(__file__).resolve().parents[4]
raw=Path('/Users/gengroup/Documents/ozon/data-cabinet/fbs_tariff_2026-10-28.psv')
rows=list(csv.DictReader(raw.open(),delimiter='|'))
c=json.loads((root/'analytics-mvp/katya/problems/fbs-estimate-cohort-2026-10-28.json').read_text())
dt=lambda s:datetime.fromisoformat(re.sub(r'\.(\d+)Z$',lambda m:'.'+m[1].ljust(6,'0')+'Z',s).replace('Z','+00:00'))
day=lambda s:(dt(s)+timedelta(hours=3)).date().isoformat()
assert len(rows)==len({r['posting'] for r in rows})==180
assert hashlib.sha256(raw.read_bytes()).hexdigest()==c['source_sha256']
daily={r['posting'] for r in rows if r['cutoff'] and 23<=(dt(r['cutoff'])-dt(r['created'])).total_seconds()/3600<=26}
assert daily==set(c['daily']) and len(daily)==74
assert set(c['other'])=={r['posting'] for r in rows}-daily
q=lambda v:int(v.quantize(Decimal(1),rounding=ROUND_HALF_UP))
results={}
for start,end in [('2026-09-01','2026-09-30'),('2026-10-18','2026-10-21'),('2026-10-01','2026-10-28')]:
 selected=[r for r in rows if r['posting'] in daily and start<=day(r['created'])<=end]
 eligible=[]; excluded=[]; waiting=[]
 for r in selected:
  if any(x in r['status'].lower() for x in ['cancel','return']):excluded.append(r);continue
  if not r['fact_transferred']:waiting.append(r);continue
  h=(dt(r['fact_transferred'])-dt(r['created'])).total_seconds()/3600
  if h<0 or day(r['fact_transferred'])>'2026-10-28':waiting.append(r);continue
  clock=-300 if h<=12 else -200 if h<=24 else 0 if h<=36 else 100 if h<=48 else 200
  actual=bool(r['fact_type']); rate=q(Decimal(r['fact_rate'] or 0)*10000)*(-1 if r['fact_type']=='discount' else 1) if actual else clock
  amount=q(Decimal(r['price'])*100)
  eligible.append(dict(order=r['posting'],hours=h,actual=actual,bps=rate,amount=amount,effect=q(Decimal(amount)*rate/10000),clock=q(Decimal(amount)*clock/10000),best=q(Decimal(amount)*300/10000),mismatch=actual and rate!=clock))
 sums=lambda key:sum(r[key] for r in eligible)/100 if eligible else None
 net=sums('effect');best=sums('best')
 out=dict(selected=len(selected),included=len(eligible),confirmed=sum(r['actual'] for r in eligible),estimated=sum(not r['actual'] for r in eligible),excluded=len(excluded),waiting=len(waiting),net=net,best=best,gap=round(best+net,2) if eligible else None,clock=sums('clock'),actualNet=sum(r['effect'] for r in eligible if r['actual'])/100 if any(r['actual'] for r in eligible) else None,mismatches=[r for r in eligible if r['mismatch']])
 results[start+'/'+end]=out
print(json.dumps(results,ensure_ascii=False,indent=2))
(root/'knowledge/episodes/2026-10/fbs-estimate-180/feniks-raw-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
