import json,collections as C,math
import numpy as np
D='/home/user/t1/analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
V=C.defaultdict(dict); tot=C.Counter()
for v in L('sku_views.ndjson'):
    if v['date']>='2026-09-01': V[v['sku']][v['date']]=v; tot[v['date']]+=v['vsearch']
print('store vsearch by day:',[(d[5:],tot[d]) for d in sorted(tot)[-14:]])
B=L('boost_daily.ndjson')
ads=C.Counter()
for r in L('ads_sku_daily.ndjson'):
    if r['d']>='2026-08-25': ads[r['sku']]+=r['sp']
# 29.09 exits: still in prices/gap after?
A=L('acts_daily.ndjson'); ds=sorted({a['date'] for a in A})
mem=C.defaultdict(set)
for a in A: mem[(a['date'],a['art'])].add(a['title'])
ex=[art for art in {a['art'] for a in A} if any('Эластичный' in t for t in mem[('2026-09-28',art)]) and not mem[('2026-09-29',art)]]
P=C.Counter(p['offer'] for p in L('prices_daily.ndjson') if p['d']>'2026-09-29')
print('29.09 full exits (no promo at all):',len(ex),'with prices after:',sum(1 for a in ex if P[a]))
# FE regression
END='2026-10-09'
rows=[(b['sku'],b['date'],b['boost'],b['parts'].get('boosting_motivation',0)) for b in B if b['date']<=END and ads[b['sku']]==0 and b['date'] in V.get(b['sku'],{})]
skus=sorted({r[0] for r in rows}); days=sorted({r[1] for r in rows})
# keep skus with boost variation
var=C.defaultdict(list)
for s,d,bt,m in rows: var[s].append(bt)
mv=[s for s in skus if max(var[s])-min(var[s])>0.15 and sum(V[s][d]['vsearch'] for d in V[s] if d<=END)>200]
print('no-ad skus',len(skus),'with boost change >0.15:',len(mv))
for name,idx in (('boost',2),('motivation',3)):
  R=[r for r in rows if r[0] in mv]
  y=np.array([math.log1p(V[r[0]][r[1]]['vsearch']) for r in R]); x=np.array([r[idx] for r in R])
  si={s:i for i,s in enumerate(mv)}; di={d:i for i,d in enumerate(days)}
  X=np.zeros((len(R),1+len(mv)+len(days)-1)); X[:,0]=x
  for k,r in enumerate(R):
      X[k,1+si[r[0]]]=1
      if di[r[1]]>0: X[k,len(mv)+di[r[1]]]=1
  b,res,_,_=np.linalg.lstsq(X,y,rcond=None)
  e=y-X@b; n,p=X.shape
  # cluster-robust SE by sku
  XtXi=np.linalg.pinv(X.T@X); meat=np.zeros((p,p))
  for s in mv:
      ix=[k for k,r in enumerate(R) if r[0]==s]; g=X[ix].T@e[ix]; meat+=np.outer(g,g)
  se=math.sqrt((XtXi@meat@XtXi)[0,0])
  print(f'{name}: coef {b[0]:.2f} (se {se:.2f}) -> +0.4 boost = {math.expm1(0.4*b[0])*100:+.0f}% показов [{math.expm1(0.4*(b[0]-2*se))*100:+.0f}..{math.expm1(0.4*(b[0]+2*se))*100:+.0f}], n_obs {n}, n_sku {len(mv)}')
