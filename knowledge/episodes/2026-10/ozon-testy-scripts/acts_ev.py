import json,collections as C,sys,statistics as S
D='/home/user/t1/analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
A=L('acts_daily.ndjson'); ds=sorted({a['date'] for a in A})
mem=C.defaultdict(set)
for a in A: mem[(a['date'],a['art'])].add(a['title'])
def st(d,art):
    m=mem.get((d,art),set())
    return ('E' if any('Эластичный' in x for x in m) else '')+('M' if any(x.startswith('Максимальный бустинг') and 'усил' not in x for x in m) else '')+('U' if any('усил' in x for x in m) else '')
B={(b['date'],b['art']):b for b in L('boost_daily.ndjson')}
a2s={b['art']:b['sku'] for b in B.values()}
G={(g['date'],g['art']):g['gap_pct'] for g in L('gap_daily.ndjson')}
P={(p['d'],p['offer']):p['price'] for p in L('prices_daily.ndjson')}
V={(v['date'],v['sku']):v for v in L('sku_views.ndjson') if v['date']>='2026-09-01'}
O=C.Counter()
for o in L('orders_daily.ndjson'):
    if o['status']!='cancelled': O[(o['d'],o['sku'])]+=o['units']
ads=C.defaultdict(float)
for r in L('ads_sku_daily.ndjson'): ads[r['sku']]+= r['sp'] if r['d']>='2026-09-15' else 0
import datetime as dt
def days(d0,k):  # k days before (neg) / after
    d=dt.date.fromisoformat(d0); 
    return [(d+dt.timedelta(i)).isoformat() for i in (range(-k,0) if k>0 else range(1,-k+1))]
def m(art,dd):
    sku=a2s.get(art); r={}
    def av(f):
        x=[f(d) for d in dd]; x=[v for v in x if v is not None]; return sum(x)/len(x) if x else None
    r['boost']=av(lambda d:B.get((d,art),{}).get('boost'))
    r['motiv']=av(lambda d:B.get((d,art),{}).get('parts',{}).get('boosting_motivation'))
    r['gap']=av(lambda d:G.get((d,art)))
    r['price']=av(lambda d:P.get((d,art)))
    r['vsearch']=av(lambda d:V[(d,sku)]['vsearch'] if (d,sku) in V else None)
    r['cart']=av(lambda d:V[(d,sku)]['cart'] if (d,sku) in V else None)
    r['ord']=sum(O.get((d,sku),0) for d in dd)/len(dd)
    return r
arts={a['art'] for a in A}
# events: state change between consecutive acts snapshots
evs=C.defaultdict(list)
for art in arts:
    if ads[a2s.get(art)]>0: continue
    for i in range(1,len(ds)):
        s0,s1=st(ds[i-1],art),st(ds[i],art)
        if s0!=s1: evs[(ds[i],s0 or '-',s1 or '-')].append(art)
stable=[a for a in arts if len({st(d,a) for d in ds})==1 and ads[a2s.get(a)]==0]
K=int(sys.argv[1]) if len(sys.argv)>1 else 6
keys=['boost','motiv','gap','price','vsearch','cart','ord']
def grp(lst,d0):
    out={}
    for k in keys:
        b=[m(a,days(d0,K))[k] for a in lst]; f=[m(a,days(d0,-K))[k] for a in lst]
        pr=[(x,y) for x,y in zip(b,f) if x is not None and y is not None]
        out[k]=(sum(x for x,_ in pr),sum(y for _,y in pr),len(pr))
    return out
print('stable no-ads arts by state:',C.Counter(st(ds[0],a) or '-' for a in stable))
for (d0,s0,s1),lst in sorted(evs.items()):
    if len(lst)<3: continue
    ctl=[a for a in stable if st(d0,a)==s0] or [a for a in stable if st(d0,a)=='E']
    g=grp(lst,d0); c=grp(ctl,d0)
    print(f'\n{d0} {s0}->{s1} n={len(lst)} control({s0 if [a for a in stable if st(d0,a)==s0] else "E"}) n={len(ctl)}')
    for k in keys:
        (gb,ga,gn),(cb,ca,cn)=g[k],c[k]
        if not gn: continue
        rel=lambda b,a:(a/b-1)*100 if b else float('nan')
        if k in('boost','motiv','gap'):
            print(f'  {k:8} {gb/gn:8.3f} -> {ga/gn:8.3f} (n={gn}) | ctl {cb/max(cn,1):8.3f} -> {ca/max(cn,1):8.3f}')
        else:
            print(f'  {k:8} sum/day {gb:9.1f} -> {ga:9.1f} ({rel(gb,ga):+.0f}%) | ctl {cb:9.1f} -> {ca:9.1f} ({rel(cb,ca):+.0f}%)')
