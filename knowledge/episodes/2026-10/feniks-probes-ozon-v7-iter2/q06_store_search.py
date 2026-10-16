# ФЕНИКС iter2, проба Q06: показы поиска магазина по дням 28.09-11.10 и вклад 7 кампаний (запуск 08.10):
# прибавились ли их показы к поиску магазина (естественный опыт запуска) - тогда урез 15.10 уберёт их из знаменателя стоп-правила.
import sys, json, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import forecast as F
import plan7 as P
cut = P.EXP - P.LAD_IDS
tot = C.Counter(); n16 = C.Counter()
for l in open(F.D + 'sku_views.ndjson'):
    r = json.loads(l)
    tot[r['date']] += r.get('vsearch', 0) or 0
    if r['sku'] in P.NOW: n16[r['date']] += r.get('vsearch', 0) or 0
vw = C.Counter()
for l in open(F.D + 'ads_daily.ndjson'):
    a = json.loads(l)
    if a['id'] in cut: vw[a['d']] += a.get('vw', 0)
print('день | поиск магазина | показы 7 кампаний | поиск без них | поиск 16 артикулов 15.10 | доля 16 в магазине | доля 16 без 7 кампаний')
for d in sorted(x for x in tot if '2026-09-28' <= x <= '2026-10-11'):
    print(d, tot[d], vw[d], tot[d] - vw[d], n16[d], f'{n16[d]/tot[d]:.2%}', f'{n16[d]/(tot[d]-vw[d]):.2%}')
