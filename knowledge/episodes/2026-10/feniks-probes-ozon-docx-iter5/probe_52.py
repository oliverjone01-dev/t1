"""Проба K10 «52 ₽ даёт то же»: доплата (gap_pct) к медиане магазина по товарам каждой новой кампании 08.10.
Источник: ads_sku_daily (товары кампании, расход), gap_daily (разрыв), sku_offer (артикул)."""
import json, collections, statistics as st
D = '/home/user/t1/analytics-mvp/data/'
offer = json.load(open(D + 'sku_offer.json'))
NEW = {'44920406': 'GGT-47-3-5-90 44р', '44988191': '3-5-E-16080 44р', '44988572': 'GGT-48-5-1 33р',
       '44989034': 'O-18090 52р', '44989441': 'GGT-E-16080 12р', '44990352': 'GGT-O-20090 12р',
       '44988949': 'E-16080 small 11.5р', '44990317': 'GGT-O-18090 small 11.9р'}
skus = collections.defaultdict(lambda: collections.Counter()); before = collections.Counter()
for l in open(D + 'ads_sku_daily.ndjson'):
    x = json.loads(l); a = offer.get(x['sku'], x['sku'])
    if x['cid'] in NEW and x['d'] >= '2026-10-08' and x['sp'] > 0:
        skus[x['cid']][a] += x['sp']
    if '2026-09-24' <= x['d'] <= '2026-10-07' and x['sp'] > 0:
        before[a] += x['sp']
gap = collections.defaultdict(dict)
for l in open(D + 'gap_daily.ndjson'):
    x = json.loads(l)
    if x['date'] >= '2026-10-03' and x.get('gap_pct') is not None:
        gap[x['date']][x['art']] = x['gap_pct']
ds = sorted(gap); med = {d: st.median(gap[d].values()) for d in ds}
print('last gap date', ds[-1], 'store median', {d[5:]: round(med[d], 1) for d in ds})
for c, lab in NEW.items():
    print('===', c, lab)
    for a, s in skus[c].most_common():
        rel = {d: gap[d][a] - med[d] for d in ds if a in gap[d]}
        b = [rel[d] for d in ds if d <= '2026-10-08' and d in rel]
        af = [rel[d] for d in ds if d >= '2026-10-10' and d in rel]
        sh = (st.mean(af) - st.mean(b)) if b and af else float('nan')
        print(f"  {a:24} sp={s:6.0f} before_sp(24.09-07.10)={before[a]:6d}  rel: " +
              ' '.join(f"{d[8:]}:{rel[d]:+.1f}" for d in ds if d in rel) + f"  shift(10-11 vs 03-08) {sh:+.1f}")
