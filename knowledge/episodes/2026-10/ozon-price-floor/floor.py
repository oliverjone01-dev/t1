# Пол цены по товару: до какой нашей цены (предельной) можно опуститься без акции, с дешёвой рекламой за клик,
# чтобы прибыль по «Отчету» (build-katya: К выплате - реклама - С/С - наша доставка + доставка покупателя
# - АДМ 30% от (К выплате - реклама) - налог 15% от платежа покупателя) оставалась >= 0 / >= 10% рентабельности.
# Запуск: python3 -I floor.py
import json,collections as C,statistics as S
D='/home/user/t1/analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
CPO=0.05; ADM=0.30; TAX=0.15; ADS_PP=0.065; CPC_WK=1500; RENT=0.10
cogs=json.load(open(D+'sku_cogs.json'))
O=L('orders_daily.ndjson')
ship={x['order']:x for x in L('delivery_orders.ndjson')}
bd={x['order']:x['bd'] for x in L('buyer_delivery_orders.ndjson')}
# доля сборов OZON и чистая доставка по товару (доставленные с 01.06)
fee=C.defaultdict(lambda:[0,0]); sn=C.defaultdict(list)
for o in O:
    if o['status']!='delivered' or o['revenue']<=0 or o['d']<'2026-06-01': continue
    f=fee[o['sku']]; f[0]+=o['payout']; f[1]+=o['revenue']
    k=o['order'] if o['order'] in ship else o['order'].rsplit('-',1)[0]
    s=ship.get(o['order']) or ship.get(o['order']+'-1')
    if s: sn[o['sku']].append((s['ship']-(bd.get(o['order'].rsplit('-',1)[0]) or bd.get(o['order']) or s.get('deliv') or 0))/max(o['units'],1))
allf=[sum(v[0] for v in fee.values()),sum(v[1] for v in fee.values())]
store_keep=allf[0]/allf[1]; store_sn=S.median([x for v in sn.values() for x in v])
# заказы без отмен за 60 дней
od=C.Counter(o['sku'] for o in O if o['status']!='cancelled' and o['d']>='2026-08-12')
for o in O:
    if o['status']!='cancelled' and o['d']>='2026-08-12': pass
units=C.Counter()
for o in O:
    if o['status']!='cancelled' and o['d']>='2026-08-12': units[o['sku']]+=o['units']
# текущая цена и доля, которую платит покупатель
P={}; 
for p in L('prices_daily.ndjson'): P[p['offer']]=(p['d'],p['price'])
G={}
for g in L('gap_daily.ndjson'): G[g['sku']]=(g['date'],g['site_to_seller'],g['art'])
ads=set(r['sku'] for r in L('ads_sku_daily.ndjson') if r['d']>='2026-10-01' and r['sp']>0)
rows=[]
for sku,u in units.items():
    if sku not in G or sku not in cogs: continue
    art=G[sku][2]; 
    if art not in P: continue
    p0=P[art][1]; s=G[sku][1]
    s_ads=s if sku in ads else max(s-ADS_PP,0.2)          # дешёвая реклама: доплата OZON +6,5 п.
    keep=fee[sku][0]/fee[sku][1] if fee[sku][1]>0 else store_keep
    shipn=S.median(sn[sku]) if sn[sku] else store_sn
    wk=u/60*7; cpc_o=CPC_WK/wk  # сценарий: у всех товаров только дешёвая реклама 1 500 ₽/нед (дорогие переводятся на неё)
    def profit(p,cpc=cpc_o,sh=s_ads):
        base=p*keep-CPO*p-cpc
        return base-cogs[sku]-shipn-ADM*base-TAX*p*sh, base
    k=0.70*(keep-CPO)-TAX*s_ads
    fixed=cogs[sku]+shipn+0.70*cpc_o
    p_zero=fixed/k if k>0 else None
    # рентабельность = прибыль / (К выплате - реклама); прибыль >= RENT*base
    k10=k-RENT*(keep-CPO); fixed10=fixed-RENT*cpc_o
    p_10=fixed10/k10 if k10>0 else None
    pr0,b0=profit(p0)  # при текущей цене и дешёвой рекламе
    rows.append(dict(sku=sku,art=art,p0=p0,u60=u,wk=wk,keep=keep,cogs=cogs[sku],shipn=shipn,s=s,ads=sku in ads,
        pr_now=pr0,rent_now=pr0/b0 if b0 else 0,cpc_o=cpc_o,p_zero=p_zero,p_10=p_10))
json.dump(rows,open('/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json','w'),ensure_ascii=False)
print('товаров',len(rows),'доля к выплате магазин %.3f, чистая доставка медиана %.0f ₽'%(store_keep,store_sn))
print('рентабельность при текущей цене и дешёвой рекламе 1 500 ₽/нед: медиана %.0f%%, отрицательная у %d'%(S.median(r['rent_now'] for r in rows)*100,sum(r['pr_now']<0 for r in rows)))
def cut(r,p): return (1-p/r['p0'])*100 if p else None
z=[cut(r,r['p_zero']) for r in rows]; t=[cut(r,r['p_10']) for r in rows]
for name,arr in (('до нуля прибыли',z),('до 10% рентабельности',t)):
    a=sorted(x for x in arr if x is not None)
    print(f'запас снижения цены {name}: медиана {S.median(a):.0f}%, квартили {a[len(a)//4]:.0f}%..{a[3*len(a)//4]:.0f}%; снижать некуда (<=0) у {sum(x<=0 for x in a)} из {len(a)}')
# по скорости продаж
for lo,hi,lab in ((0,0.5,'<0,5 шт/нед'),(0.5,1.5,'0,5-1,5'),(1.5,99,'>1,5')):
    rr=[r for r in rows if lo<=r['wk']<hi]
    if not rr: continue
    print(f'{lab:12} n={len(rr):3} заказов 60д {sum(r["u60"] for r in rr):4}  реклама на заказ медиана {S.median(r["cpc_o"] for r in rr):6.0f} ₽  запас до 0: медиана {S.median(cut(r,r["p_zero"]) for r in rr):5.0f}%  до 10%: {S.median(cut(r,r["p_10"]) for r in rr):5.0f}%')
# --- сценарий: дешёвая реклама утраивает заказы товара (тест 1: 0,57 -> 1,83 в день) ---
print('\nесли реклама утроит заказы (как в тесте 1):')
for lo,hi,lab in ((0,0.5,'<0,5 шт/нед'),(0.5,1.5,'0,5-1,5'),(1.5,99,'>1,5')):
    rr=[r for r in rows if lo<=r['wk']<hi]
    zz=[]
    for r in rr:
        cpc=r['cpc_o']/3; s_ads=r['s'] if r['ads'] else max(r['s']-ADS_PP,0.2)
        k=0.70*(r['keep']-CPO)-TAX*s_ads; fx=r['cogs']+r['shipn']+0.70*cpc
        zz.append((1-fx/k/r['p0'])*100 if k>0 else None)
    zz=[x for x in zz if x is not None]
    print(f'  {lab:12} запас до нуля прибыли медиана {S.median(zz):.0f}%')
# --- сколько заказов нужно сверху, чтобы прибыль за неделю не упала при снижении цены ---
print('\nнужный рост заказов, чтобы прибыль не упала (товары с прибылью сейчас, без рекламы на заказ):')
for cutp in (0.05,0.10,0.20):
    need=[]
    for r in rows:
        s=r['s']; k=0.70*(r['keep']-CPO)-TAX*s; fx=r['cogs']+r['shipn']
        pr0=r['p0']*k-fx; pr1=r['p0']*(1-cutp)*k-fx
        if pr0>0: need.append(pr0/pr1 if pr1>0 else float('inf'))
    fin=sorted(x for x in need if x!=float('inf'))
    print(f'  цена -{int(cutp*100)}%: медиана +{(S.median(fin)-1)*100:.0f}% заказов, четверть товаров +{(fin[3*len(fin)//4]-1)*100:.0f}% и больше, в минус уходят {sum(x==float("inf") for x in need)} из {len(need)}')
