# Сколько показов даёт ставка за заказ 5 / 7 / 9% (ads_daily 28753239: vw показы, sp расход), 15.06-12.10.
# Ставка дня - действующая в 12:00 UTC по cpo_history.psv (после 07.09 - 5%, журнал кончается 07.09).
# Поправка на день недели (по пятницам ставили 9, по понедельникам 7): лог-регрессия vw ~ ставка + день недели.
# Запуск: python3 -I cpo_rate_shows.py
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import json,collections as C,statistics as S,datetime as dt,math
import numpy as np
D=ROOT+'analytics-mvp/data/'
R={r['d']:r for r in map(json.loads,open(D+'ads_daily.ndjson')) if r['id']=='28753239'}
O=C.Counter(); REV=C.Counter()
for o in map(json.loads,open(D+'orders_daily.ndjson')):
    if o['status']!='cancelled': O[o['d']]+=1; REV[o['d']]+=o['revenue']
log=[l.strip().split('|') for l in open(ROOT+'analytics-mvp/tools/tests/cpo_history.psv')][1:]
def rate(d):
    t=d+'T12:00'; r=None
    for ts,c,u in log:
        if ts<=t: r=None if c=='OFF' else int(float((c.split('>')[-1] if '>' in c else c.split()[-1]).rstrip('%')))
    return r
rows=[]
d=dt.date(2026,6,16)
END=dt.date(2026,9,7) if 'journal' in __import__('sys').argv else dt.date(2026,10,12)
while d<=END:
    s=d.isoformat(); r=rate(s); x=R.get(s)
    if r and x and x['vw']>0 and s not in ('2026-08-27','2026-08-28','2026-09-04'): rows.append((s,r,d.weekday(),x['vw'],x['sp'],O[s]))
    d+=dt.timedelta(1)
for r in (5,7,9):
    g=[x for x in rows if x[1]==r]
    print('ставка %d%%: дней %d, показы рекламы за заказ медиана %d в день, заказы магазина %.1f в день, выходных дней %d%%'%(r,len(g),S.median(x[3] for x in g),S.mean(x[5] for x in g),100*sum(x[2]>=5 for x in g)/len(g)))
X=np.array([[1,x[1]]+[1 if x[2]==k else 0 for k in range(1,7)] for x in rows],float); y=np.log([x[3] for x in rows])
b=np.linalg.lstsq(X,y,rcond=None)[0]; e=y-X@b; s2=e@e/(len(y)-X.shape[1]); se=math.sqrt(s2*np.linalg.inv(X.T@X)[1,1])
print('регрессия: +1 п. ставки -> показы %+.1f%% (95%% ДИ %+.1f..%+.1f), n=%d'%((math.exp(b[1])-1)*100,(math.exp(b[1]-2*se)-1)*100,(math.exp(b[1]+2*se)-1)*100,len(y)))
# только июнь-август (до выключения), 7 vs 9 в те же дни недели
g7=[x for x in rows if x[0]<'2026-08-27' and x[1]==7]; g9=[x for x in rows if x[0]<'2026-08-27' and x[1]==9]
for wd in range(7):
    a=[x[3] for x in g7 if x[2]==wd]; c=[x[3] for x in g9 if x[2]==wd]
    if a and c: print('  день недели %d: 7%% медиана %d (n=%d), 9%% медиана %d (n=%d)'%(wd,S.median(a),len(a),S.median(c),len(c)))
mo=C.defaultdict(lambda:[0,0])
for s,x in R.items():
    if '2026-06-01'<=s<='2026-10-12': mo[s[:7]][0]+=x['sp']
for s,v in REV.items():
    if s[:7] in mo: mo[s[:7]][1]+=v
print('расход за заказ / выручка заказов без отмен по месяцам:',' '.join('%s %.1f%%'%(m,100*a/b) for m,(a,b) in sorted(mo.items()) if b))
