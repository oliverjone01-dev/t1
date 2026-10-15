# ФЕНИКС, раздел 5 «Цена». S1: история снимков цен и скидки - пропуски дней (сценарий «срез не пришёл»),
# шум цены артикулов плана до 14.10 (сколько раз цена менялась сама, без плана: акции продавца в price).
# python3 -I s1_snapshots.py <dataDir>
import json, sys, datetime as dt, collections
D = sys.argv[1]
P = json.load(open(D + '/plan_2026-10-15_v3.json')); arts = {p['art'] for p in P['price']}
ds = collections.Counter(); gds = collections.Counter(); hist = collections.defaultdict(dict)
for l in open(D + '/prices_daily.ndjson'):
    r = json.loads(l); ds[r['d']] += 1
    if r['offer'] in arts: hist[r['offer']][r['d']] = r['price']
for l in open(D + '/gap_daily.ndjson'):
    gds[json.loads(l)['date']] += 1
def gaps(c):
    k = sorted(c); out = []
    for a, b in zip(k, k[1:]):
        n = (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days
        if n != 1: out.append(f"{a} -> {b} (нет {n - 1} дн.)")
    return {'первый': k[0], 'последний': k[-1], 'дней': len(k), 'пропуски': out}
print('prices_daily:', gaps(ds))
print('gap_daily:   ', gaps(gds))
# шум: смены цены артикулов плана до 14.10 включительно (план ещё не действовал)
ch = []; small = 0
for a, h in hist.items():
    ks = sorted(k for k in h if k <= '2026-10-14')
    for x, y in zip(ks, ks[1:]):
        if h[x] != h[y]:
            r = (h[y] / h[x] - 1) * 100; ch.append((a, y, round(r, 2)))
            if abs(r) < 5: small += 1
print('смен цены у 25 артикулов плана до 14.10:', len(ch), '| из них по модулю меньше 5%:', small)
for a, y, r in sorted(ch, key=lambda z: z[1])[-12:]:
    print('  ', y, a, f'{r:+.2f}%')
print('дней истории до 14.10 у артикулов плана:', sorted(collections.Counter(len([k for k in h if k <= '2026-10-14']) for h in hist.values()).items()))
