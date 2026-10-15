# ФЕНИКС iter2, проба Q05: знаменатель стоп-правила «доля товара в показах поиска магазина».
# Сколько показов поиска магазина дают 7 кампаний, которые 15.10 уходят на минимум, и насколько вырастет доля всех остальных товаров.
import sys, json, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import forecast as F
import plan7 as P
cut = P.EXP - P.LAD_IDS
tot = C.Counter()
for l in open(F.D + 'sku_views.ndjson'):
    r = json.loads(l); tot[r['date']] += r.get('vsearch', 0) or 0
vw = C.Counter(); sp = C.Counter()
for l in open(F.D + 'ads_daily.ndjson'):
    a = json.loads(l)
    if a['id'] in cut: vw[a['d']] += a.get('vw', 0); sp[a['d']] += a.get('sp', 0)
for d in ('2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'):
    rest = tot[d] - vw[d]
    print(d, 'показы поиска магазина', tot[d], '| показы 7 кампаний', vw[d], f'({vw[d]/tot[d]:.0%})', '| после уреза (степень 0,81 к расходу) доля остальных x',
          round(tot[d] / (tot[d] - vw[d] * (1 - (2000 / 7 / max(1, sp[d])) ** 0.81 if sp[d] > 2000 / 7 * 7 else 0)), 2))
d4 = ['2026-10-09', '2026-10-10', '2026-10-11']
share = sum(vw[d] for d in d4) / sum(tot[d] for d in d4)
print(f'09-11.10: 7 кампаний = {share:.0%} показов поиска магазина; если убрать их целиком, доля любого другого товара вырастет в {1/(1-share):.2f} раза')
