# Тест 3 «большая ставка и бюджет против минимальных» - итог на закрытие (Иван 13.10 «можно закрывать»).
# Независимый пересчёт таблицы дашборда (build-tests.ts bidVerdictPair) + деньги: доп. заказы × (44% предельной - себестоимость)
# против доп. расхода. ДРР здесь = расход / (заказы × предельная) по заказам из sku_views, не из кабинета.
# Запуск: python3 -I test3_close.py
import os,json,collections as C,statistics as S
ROOT=os.path.abspath(__file__).split('knowledge/')[0]; D=ROOT+'analytics-mvp/data/'
T=json.load(open(ROOT+'analytics-mvp/tools/tests/tests.json'))['тесты_ставок'][0]
SKU={};G=C.defaultdict(dict);P=C.defaultdict(dict)
for l in open(D+'gap_daily.ndjson'):
    r=json.loads(l); SKU[r['art']]=r['sku']; G[r['art']][r['date']]=1-r['site_to_seller']
for l in open(D+'prices_daily.ndjson'):
    r=json.loads(l)
    if r.get('price'): P[r['offer']][r['d']]=r['price']
COGS=json.load(open(D+'sku_cogs.json'))
V=C.defaultdict(C.Counter); SP=C.defaultdict(float)
for l in open(D+'sku_views.ndjson'):
    r=json.loads(l)
    for k in ('vsearch','pdp','cart','units'): V[(r['sku'],r['date'])][k]+=r.get(k) or 0
for l in open(D+'ads_sku_daily.ndjson'):
    r=json.loads(l); SP[(r['sku'],r['d'])]+=r['sp']
LAST=max(d for (_,d) in V)
days=lambda a,b:[d for d in sorted({d for (_,d) in V}) if a<=d<=b]
KEEP=0.44
for p in T['пары']:
    out={}
    for side in ('большая','малая'):
        s=p[side]; a=s['артикул']; k=SKU[a]
        fr=s.get('с') or p['старт']; to=s.get('по') or LAST
        dd=days(fr,to); n=len(dd)
        tot={x:sum(V[(k,d)][x] for d in dd) for x in ('vsearch','pdp','cart','units')}
        sp=sum(SP[(k,d)] for d in dd)
        price=S.median(v for d,v in P[a].items() if fr<=d<=to) if any(fr<=d<=to for d in P[a]) else max(P[a].items())[1]
        gap=S.median(v for d,v in G[a].items() if fr<=d<=to)*100
        out[side]=dict(n=n,wk=lambda x,n=n:x/n*7,price=price,gap=gap,sp=sp,cogs=COGS.get(k),**tot)
    B,M=out['большая'],out['малая']
    print('\n==',p['название'])
    for nm,x in (('большая',B),('малая',M)):
        drr=x['sp']/(x['units']*x['price'])*100 if x['units'] else None
        print('  %-8s %d дн: показы/нед %.0f, корзины/нед %.0f, заказы/нед %.1f (всего %d), расход/нед %.0f, корзин на 1000 ₽ %.1f, соинвест %.1f%%, предельная %.0f, ДРР по заказам %s'%(
            nm,x['n'],x['wk'](x['vsearch']),x['wk'](x['cart']),x['wk'](x['units']),x['units'],x['wk'](x['sp']),x['cart']/x['sp']*1000 if x['sp'] else 0,x['gap'],x['price'],'%.1f%%'%drr if drr else '-'))
    dO=B['wk'](B['units'])-M['wk'](M['units']); dS=B['wk'](B['sp'])-M['wk'](M['sp'])
    unit=KEEP*B['price']-(B['cogs'] or 0)
    print('  доп. заказов в неделю %+.1f, доп. расход %+.0f ₽/нед; с заказа до логистики ~%.0f ₽ (44%% предельной - себестоимость %s) -> итог %+.0f ₽/нед'%(dO,dS,unit,B['cogs'],dO*unit-dS))
