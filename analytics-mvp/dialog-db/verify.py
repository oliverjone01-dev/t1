import json,time,urllib.request,urllib.parse,hashlib
from pathlib import Path
raw=Path('/srv/gg/www/current/dialog/index.html').read_text();start=raw.index('const DATA = ')+13
d,_=json.JSONDecoder().raw_decode(raw[start:]);deals=d['scoring']['deals']
def api(route,**p):
 t=time.perf_counter();r=urllib.request.urlopen('http://127.0.0.1:18764/api/'+route+'?'+urllib.parse.urlencode(p));body=r.read();return json.loads(body),len(body),round((time.perf_counter()-t)*1000)
r,size,ms=api('summary');assert r['department']['total']==len(deals);assert r['department']['budget']==sum(x.get('budget') or 0 for x in deals)
print('summary',{'bytes':size,'ms':ms,'deals':r['department']['total']})
for m in r['managers']:
 subset=[x for x in deals if x['mgr']==m['manager']];assert m['total']==len(subset);assert m['budget']==sum(x.get('budget') or 0 for x in subset)
for oc in ['open','won','lost']:
 a,_,_=api('summary',outcome=oc);assert a['department']['total']==len([x for x in deals if x.get('outcome','open')==oc])
for key in [deals[0]['key'],deals[-1]['key']]:
 a,_,_=api('deal',key=key);assert a['deal']==next(x for x in deals if x['key']==key)
 a,size,ms=api('events',key=key);assert len(a['items'])<=100;print('events',{'bytes':size,'ms':ms,'total':a['total']})
a,size,ms=api('deals',limit=40,sort='budget');assert len(a['items'])==40;assert all(a['items'][i].get('budget',0)>=a['items'][i+1].get('budget',0) for i in range(39));print('deals',{'bytes':size,'ms':ms})
a,size,ms=api('summary',mode='events',**{'from':'2026-10-01','to':'2026-10-12'});print('period',{'deals':a['department']['total'],'bytes':size,'ms':ms})
print('PASS: exact deal records, counts, budgets, managers, outcomes and pagination')
