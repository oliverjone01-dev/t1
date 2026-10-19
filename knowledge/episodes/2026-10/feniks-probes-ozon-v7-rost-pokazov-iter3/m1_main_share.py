# ФЕНИКС iter3, проба M1: доля главного товара в расходе зелёных кампаний («главный товар», 08-11.10, ads_sku_daily).
# Если кампания крутит несколько товаров, бюджет 20 000 на кампанию не равен 20 000 на главный. Только расход, без прибыли.
# python3 -I -B m1_main_share.py
import sys, io, contextlib, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
with contextlib.redirect_stdout(io.StringIO()):
    import cards7 as K, forecast as F, plan7 as P
LV = 20000; mains = {c['main']: c for c in K.cards[:10]}
green = [c for c in P.ACTIVE if K.campaign_action(c, LV, 10)[0] == 'main']
by = C.defaultdict(C.Counter); by4 = C.defaultdict(C.Counter)
for x in F.L('ads_sku_daily.ndjson'):
    if x['cid'] in green:
        if '2026-10-08' <= x['d'] <= F.B: by[x['cid']][x['sku']] += x['sp'] / 4 * 7
        if F.A <= x['d'] <= F.B: by4[x['cid']][x['sku']] += x['sp']
for cid in green:
    off = F.camp[cid]['off']; m = F.art2sku.get(off)
    tot = sum(by[cid].values()); tot4 = sum(by4[cid].values())
    print(f'{cid} {off:22} темп {tot:8,.0f} ₽/нед, на главный {by[cid][m] / tot if tot else 0:5.0%}; за 4 нед на главный {by4[cid][m] / tot4 if tot4 else 0:5.0%}; товаров в кампании за 4 нед {len([s for s, v in by4[cid].items() if v > 0])}'.replace(',', ' '))
