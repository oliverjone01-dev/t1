# Показы рекламы за клик по кампаниям 22.09-07.10 (ads_daily: sp расход, vw показы рекламы, cl клики).
# Модель: log показы = a + b*log расход + c*log цена клика. Запуск: python3 -I shows_model.py
import os,json,collections as C,math
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import numpy as np
R=[json.loads(l) for l in open(ROOT+'analytics-mvp/data/ads_daily.ndjson')]
agg=C.defaultdict(C.Counter); off={}
for r in R:
    if '2026-09-22'<=r['d']<='2026-10-07' and r['sp']>0:
        a=agg[r['id']]; a['sp']+=r['sp']; a['vw']+=r['vw']; a['cl']+=r['cl']; a['days']+=1; off[r['id']]=r['off']
rows=[]
for i,a in agg.items():
    if not a['vw'] or not a['cl'] or i=='28753239': continue
    k=7/a['days']; rows.append((i,off[i],a['sp']*k,a['vw']*k,a['sp']/a['cl'],a['cl']/a['vw']*100,a['sp']/a['vw']*1000))
rows=[r for r in rows if r[2]>500]
for r in sorted(rows,key=lambda r:-r[2]): print('%-9s %-24s расход/нед %7.0f показы/нед %7.0f клик %5.1f ₽ CTR %4.2f%% ₽/1000 %5.0f'%r)
ls=np.log([r[2] for r in rows]); lv=np.log([r[3] for r in rows]); lc=np.log([r[4] for r in rows])
X=np.c_[np.ones(len(rows)),ls,lc]; b=np.linalg.lstsq(X,lv,rcond=None)[0]; p=X@b
print('n=%d  log показы = %.2f + %.2f*log расход %+.2f*log цена клика, R2=%.2f'%(len(rows),*b,1-((lv-p)**2).sum()/((lv-lv.mean())**2).sum()))
print('медиана CTR %.2f%%'%np.median([r[5] for r in rows]))
print('бюджет x2 при той же цене клика: показы %+.0f%%; цена клика x2 при том же бюджете: показы %+.0f%%'%((2**b[1]-1)*100,(2**b[2]-1)*100))
