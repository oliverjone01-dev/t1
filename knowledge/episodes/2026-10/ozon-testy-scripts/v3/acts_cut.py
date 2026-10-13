# Тезис 7: «Максимальный бустинг» (и «Усиление») опускают предельную цену ниже цены «Эластичного».
# Предельная = prices_daily.price с 23.09 (сверено: = цена витрины / site_to_seller, = цена «Эластичного»
# у товаров только в нём). Срез = 1 - предельная / цена «Эластичного». Деньги = срез в ₽ x проданные штуки
# (без отмен) за 23.09-11.10, пересчёт на 30 дней. Рубли по товарам не печатаем. Запуск: python3 -I acts_cut.py
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import json,collections as C,statistics as S
D=ROOT+'analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
P={(p['d'],p['offer']):p['price'] for p in L('prices_daily.ndjson') if p['d']>='2026-09-23'}
A=C.defaultdict(dict)
for a in L('acts_daily.ndjson'):
    t='E' if 'Эластичный' in a['title'] else 'U' if 'усил' in a['title'] else 'M' if a['title'].startswith('Максимальный') else None
    if t:
        try: A[(a['date'],a['art'])][t]=float(a['value'])
        except: A[(a['date'],a['art'])][t]=None
SP=C.Counter()
off=json.load(open(D+'sku_offer.json'))
for r in L('ads_sku_daily.ndjson'):
    if r['d']>='2026-09-01': SP[off.get(r['sku'],r['sku'])]+=r['sp']
U=C.Counter()
for o in L('orders_daily.ndjson'):
    if o['status']!='cancelled' and '2026-09-23'<=o['d']<='2026-10-11': U[(o['d'],o['offer'])]+=o['units']
days=sorted({d for d,a in A})
inMU=C.defaultdict(set); cut=C.defaultdict(list); rub=C.Counter(); rubna=C.Counter()
for (d,a),v in A.items():
    if 'M' in v or 'U' in v: inMU[a].add(d)
    if (d,a) in P and v.get('E'):
        c=1-P[(d,a)]/v['E']
        if 'M' in v or 'U' in v: cut[a].append(c)
        rub[a]+=max(c,0)*v['E']*U[(d,a)]
ndays=len(days)
arts=sorted(inMU)
mc={a:S.median(cut[a]) for a in arts if cut[a]}
big=[a for a in mc if mc[a]>0.01]
print('дней снимков %d (%s-%s); товаров в «Максимальном»/«Усилении» хоть раз: %d, из них с ценой «Эластичного»: %d'%(ndays,days[0],days[-1],len(arts),len(mc)))
print('предельная ниже «Эластичного» >1%%: %d товаров, медиана среза %.1f%%, максимум %.1f%%'%(len(big),100*S.median(mc[a] for a in big),100*max(mc[a] for a in big)))
tot=sum(rub[a] for a in arts); noad=[a for a in arts if SP[a]==0]
print('потеря цены по проданным штукам за %d дней: %.0f тыс. ₽, на 30 дней %.0f тыс. ₽; из них товары без рекламы за клик с 01.09: %.0f тыс. на 30 дней (%d товаров с потерей >0)'%(ndays,tot/1e3,tot/1e3*30/ndays,sum(rub[a] for a in noad)/1e3*30/ndays,sum(1 for a in noad if rub[a]>0)))
su=sum(U[(d,a)] for d,a in U if a in arts); print('проданных штук этих товаров за период:',su)
for t in ('M','U'):
    n=C.Counter(d for (d,a),v in A.items() if t in v); print('товаров в',{'M':'«Максимальном бустинге»','U':'«Усилении»'}[t],'по дням:',' '.join('%s:%d'%(d[5:],n[d]) for d in days))
print('товары из списка Ивана: срез к «Эластичному» (медиана по дням в акции), штук продано 23.09-11.10, расход за клик с 01.09 >0')
for a in ('GGM-01-1','GGM-23-3-1','GGM-23-2-1','GGM-16-1-2','GGM-01-2','GGM-02-1-2','GGL-02-M-2'):
    print('  %-12s в акции дней %2d, срез %s, штук %d, реклама %s'%(a,len(inMU[a]),'%.1f%%'%(100*mc[a]) if a in mc else '-',sum(U[(d,a)] for d in days),'да' if SP[a] else 'нет'))
