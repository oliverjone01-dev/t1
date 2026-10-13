# Тест 2 «Выход из «Усиления»» (tools/tests/tests.json, boost_plus_exit): замер 13.10.
# База 22-28.09 (до выхода 29.09), после 30.09-10.10. Тест 10 товаров, контроль 46.
# Цена покупателя - витрина = предельная (prices_daily.price) × site_to_seller (gap_daily). Итог по правилу:
# предельная × заказы в день. Показы в поиске, заказы без отмен. Пропуск дня - пропуск. Запуск: python3 -I test2_close.py
import os,json,collections as C,statistics as S
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
D=ROOT+'analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
T=[x for x in json.load(open(ROOT+'analytics-mvp/tools/tests/tests.json'))['тесты'] if x['id']=='boost_plus_exit'][0]
grp={'тест':T['тест'],'  из них с рекламой':T['роли']['test_ad'],'  из них соседи':T['роли']['test_sibling'],'контроль':T['контроль']}
U=C.defaultdict(set)
for a in L('acts_daily.ndjson'):
    if 'усил' in a['title']: U[a['date']].add(a['art'])
for g in ('тест','контроль'): print(g,'в «Усилении» 28.09: %d, 30.09: %d, 11.10: %d из %d'%(sum(a in U['2026-09-28'] for a in grp[g]),sum(a in U['2026-09-30'] for a in grp[g]),sum(a in U['2026-10-11'] for a in grp[g]),len(grp[g])))
P={(p['d'],p['offer']):p['price'] for p in L('prices_daily.ndjson') if p['d']>='2026-09-23'}
G={(g['date'],g['art']):g['site_to_seller'] for g in L('gap_daily.ndjson')}
off=json.load(open(D+'sku_offer.json'))
V=C.Counter(); O=C.Counter(); vd=set()
for r in L('sku_views.ndjson'):
    if r['date']>='2026-09-20': V[(r['date'],off.get(str(r['sku'])))]+=r.get('vsearch') or 0; vd.add(r['date'])
for o in L('orders_daily.ndjson'):
    if o['status']!='cancelled': O[(o['d'],o['offer'])]+=1
pre=['2026-09-%02d'%i for i in range(22,29)]; post=['2026-09-30']+['2026-10-%02d'%i for i in range(1,11)]
pre=[d for d in pre if d in vd]; post=[d for d in post if d in vd]
def med(arts,dd,f):
    v=[S.median(x) for x in ([f(d,a) for d in dd if f(d,a) is not None] for a in arts) if x]; return S.median(v) if v else float('nan')
fp=lambda d,a:P.get((d,a)); fs=lambda d,a:P[(d,a)]*G[(d,a)] if (d,a) in P and (d,a) in G else None
print('дней: база %d, после %d'%(len(pre),len(post)))
for g,arts in grp.items():
    a=med(arts,pre,fp); b=med(arts,post,fp); c=med(arts,pre,fs); e=med(arts,post,fs)
    vs=[sum(V[(d,x)] for x in arts for d in dd)/len(dd) for dd in (pre,post)]
    os_=[sum(O[(d,x)] for x in arts for d in dd) for dd in (pre,post)]
    m=[sum(P.get((d,x),0)*O[(d,x)] for x in arts for d in dd)/len(dd) for dd in (pre,post)]
    print('%-20s предельная %+.1f%% | витрина %+.1f%% | показы в поиске в день %.0f -> %.0f (%+.0f%%) | заказы %d за %d дн. -> %d за %d дн. | предельная×заказы в день %.0f -> %.0f тыс. ₽'%(g,(b/a-1)*100,(e/c-1)*100,vs[0],vs[1],(vs[1]/vs[0]-1)*100,os_[0],len(pre),os_[1],len(post),m[0]/1e3,m[1]/1e3))
# По дням: витрина рекламных тестовых (вышли 29.09) и контроля, к медиане 22-28.09; заказы и показы по дням.
ad=T['роли']['test_ad']; days=sorted({d for d,_ in P if d>='2026-09-23'})
base={a:S.median([fs(d,a) for d in pre if fs(d,a)]) for a in ad+T['контроль'] if [fs(d,a) for d in pre if fs(d,a)]}
print('день  | витрина 5 вышедших к базе (медиана) | контроль | заказы 5 вышедших | показы 5 вышедших')
for d in days:
    x=[fs(d,a)/base[a] for a in ad if a in base and fs(d,a)]; y=[fs(d,a)/base[a] for a in T['контроль'] if a in base and fs(d,a)]
    if x and y: print(d[5:],'%+5.0f%% %+5.0f%%'%((S.median(x)-1)*100,(S.median(y)-1)*100),sum(O[(d,a)] for a in ad),sum(V[(d,a)] for a in ad) if d in vd else '-')
print('вышли из каких акций (30.09):',{a:sorted(t[:20] for t in [x['title'] for x in L('acts_daily.ndjson') if x['date']=='2026-09-30' and x['art']==a]) for a in ad})
