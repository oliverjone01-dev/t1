# Тест 4 (снижение предельной на 10%, старт 07.10): что стало с ценой, разрывом, показами, заходами и заказами.
# Сравнение: 7 наблюдаемых дней до старта против дней с 07.10; показы и заказы - доля в магазине (вычитает общий фон).
# Запуск: python3 -I test4_status.py
import os,json,collections as C,statistics as S
ROOT=os.path.abspath(__file__).split('knowledge/')[0]; D=ROOT+'analytics-mvp/data/'
T=json.load(open(ROOT+'analytics-mvp/tools/tests/tests.json'))['тесты_цены'][0]
ARTS=T['тест']; EXC=T['исключены']; START=T['старт']
P=C.defaultdict(dict); G=C.defaultdict(dict); SKU={}
for l in open(D+'prices_daily.ndjson'):
    r=json.loads(l)
    if r.get('price'): P[r['offer']][r['d']]=r['price']
for l in open(D+'gap_daily.ndjson'):
    r=json.loads(l); G[r['art']][r['date']]=r['site_to_seller']; SKU[r['art']]=r['sku']
gd=sorted({d for a in G for d in G[a]})
med={d:S.median(1-G[a][d] for a in G if d in G[a]) for d in gd}
V=C.defaultdict(lambda:C.defaultdict(C.Counter)); TOT=C.defaultdict(C.Counter)
for l in open(D+'sku_views.ndjson'):
    r=json.loads(l)
    for k in ('vsearch','pdp','units'): V[r['sku']][r['date']][k]+=r.get(k) or 0; TOT[r['date']][k]+=r.get(k) or 0
vd=sorted(TOT)
pre_g=[d for d in gd if d<START][-7:]; post_g=[d for d in gd if d>=START]
pre_v=[d for d in vd if d<START][-7:]; post_v=[d for d in vd if d>=START]
print('цены/разрыв: база %s..%s, после %s..%s (%d дн.)'%(pre_g[0],pre_g[-1],post_g[0],post_g[-1],len(post_g)))
print('показы/заказы: база %s..%s, после %s..%s (%d дн.)'%(pre_v[0],pre_v[-1],post_v[0],post_v[-1],len(post_v)))
def share(a,days,k):
    s=SKU.get(a); t=sum(TOT[d][k] for d in days); return sum(V[s][d][k] for d in days)/t if t else 0
print('\n%-20s %-6s %9s %9s %7s %8s %8s | %7s | %8s %8s | %s'%('товар','чистый','пред.до','пред.после','цена','витр.до','витр.после','разрыв к контролю','показы','заходы','заказы до/после'))
tot=C.defaultdict(list)
for a in ARTS:
    p0=S.median(P[a][d] for d in pre_g if d in P[a]); p1=P[a][max(d for d in P[a])]
    s0=S.median(G[a][d]*P[a][d] for d in pre_g if d in G[a] and d in P[a])
    l=[d for d in post_g if d in G[a] and d in P[a]]; s1=G[a][l[-1]]*P[a][l[-1]] if l else float('nan')
    g0=S.median((1-G[a][d])-med[d] for d in pre_g if d in G[a]); g1=S.median((1-G[a][d])-med[d] for d in post_g if d in G[a])
    sh=lambda k:(share(a,post_v,k)/share(a,pre_v,k)-1)*100 if share(a,pre_v,k) else float('nan')
    u0=sum(V[SKU[a]][d]['units'] for d in pre_v); u1=sum(V[SKU[a]][d]['units'] for d in post_v)
    clean='да' if a not in EXC else 'нет'
    print('%-20s %-6s %9.0f %9.0f %+6.1f%% %8.0f %8.0f | %+6.1fп | %+7.0f%% %+7.0f%% | %d / %d'%(a,clean,p0,p1,(p1/p0-1)*100,s0,s1,(g1-g0)*100,sh('vsearch'),sh('pdp'),u0,u1))
    tot[clean].append((a,u0,u1))
for c in ('да','нет'):
    arts=[x[0] for x in tot[c]]
    f=lambda days,k:sum(V[SKU[a]][d][k] for a in arts for d in days)/max(1,sum(TOT[d][k] for d in days))
    print('группа чистый=%s (%d тов.): доля показов в поиске %+.0f%%, заходов %+.0f%%, заказы %d -> %d'%(c,len(arts),(f(post_v,'vsearch')/f(pre_v,'vsearch')-1)*100,(f(post_v,'pdp')/f(pre_v,'pdp')-1)*100,sum(x[1] for x in tot[c]),sum(x[2] for x in tot[c])))
print('магазин: заказов в день до %.1f, после %.1f'%(sum(TOT[d]['units'] for d in pre_v)/len(pre_v),sum(TOT[d]['units'] for d in post_v)/len(post_v)))
