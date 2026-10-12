# Тест 3: заказы пар без отмен и доля рекламы (ДРР = расход / выручка заказов по рекламе, ads_daily om) по 10.10
import json
D='/home/user/t1/analytics-mvp/data/'
od=[json.loads(l) for l in open(D+'orders_daily.ndjson')]
ads=[json.loads(l) for l in open(D+'ads_daily.ndjson')]
def o(a,f,t): return sum(x['units'] for x in od if x['offer']==a and f<=x['d']<=t and x['status']!='cancelled')
P=[('KONUX','GGT-35-5-1-100-180','GGT-35-2-3-100-180','2026-09-22','2026-10-10','37675958'),('KUVINO','GGM-18-2-2','GGM-18-2-1','2026-10-01','2026-10-10','39931246')]
import datetime as dt
for n,b,s,f,t,cid in P:
  d=(dt.date.fromisoformat(t)-dt.date.fromisoformat(f)).days+1
  sp=sum(x['sp'] for x in ads if x['id']==cid and f<=x['d']<=t);om=sum(x['om'] for x in ads if x['id']==cid and f<=x['d']<=t)
  print(n,d,'дн; заказы без отмен большая',o(b,f,t),'малая',o(s,f,t),'в нед %.1f / %.1f'%(o(b,f,t)/d*7,o(s,f,t)/d*7),'ДРР %.1f%%'%(100*sp/om if om else -1))
T2=json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))['тесты'][1]['роли']
for k in ('test_ad','test_sibling'):
  print(k,'заказы/день без отмен 22-28.09 %.2f  29.09-10.10 %.2f'%(sum(o(a,'2026-09-22','2026-09-28') for a in T2[k])/7,sum(o(a,'2026-09-29','2026-10-10') for a in T2[k])/12))
