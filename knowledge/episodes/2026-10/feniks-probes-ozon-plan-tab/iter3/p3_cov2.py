# iter3, N2: покрытие по месяцам и в окне 62 дней (как в ad-sku-daily.ts WINDOW), без допуска.
# python3 -I p3_cov2.py
import json, collections, datetime as dt
DD = '/home/user/t1/analytics-mvp/data/'
def nd(f):
    out = []
    for l in open(DD + f, encoding='utf-8'):
        l = l.strip()
        if l:
            try: out.append(json.loads(l))
            except Exception: pass
    return out
CPO = '28753239'
ad = nd('ads_daily.ndjson'); asd = nd('ads_sku_daily.ndjson'); state = json.load(open(DD + 'ads_sku_state.json'))
def minus1(s): return (dt.date.fromisoformat(s) - dt.timedelta(days=1)).isoformat()
camp = collections.defaultdict(float); sku = collections.defaultdict(float); n = collections.Counter()
for r in ad:
    if str(r['id']) != CPO: camp[(str(r['id']), r['d'])] += float(r.get('sp') or 0)
for r in asd:
    sku[(str(r['cid']), r['d'])] += float(r.get('sp') or 0); n[(str(r['cid']), r['d'])] += 1
month = collections.defaultdict(lambda: [0, 0, 0])
bad_recent = []
for (c, d), v in camp.items():
    if v <= 0 or d < '2026-07-03' or d > '2026-10-12': continue
    if not (state.get(c) and minus1(state[c]) >= d): continue
    g = sku.get((c, d), 0.0); m = d[:7]; month[m][0] += 1
    if g < 0.95 * v: month[m][1] += 1
    if g == 0: month[m][2] += 1
    if d >= '2026-08-14' and g < 0.95 * v: bad_recent.append((d, c, v, g, n.get((c, d), 0), state.get(c)))
for m in sorted(month): print(m, 'собранных кампания-дней', month[m][0], '< 95%:', month[m][1], 'из них 0 строк:', month[m][2])
print('после 14.08 (окно 62 дня от 13.10):', len(bad_recent))
for b in sorted(bad_recent)[:40]:
    print('  ', b[0], b[1], 'ads_daily', b[2], 'по товарам', b[3], 'строк', b[4], 'state', b[5], f'{b[3] / b[2]:.1%}')
# распределение покрытия в окне 08.10-12.10 по кампаниям (минимум)
mins = sorted((sku.get((c, d), 0.0) / v, c, d, v) for (c, d), v in camp.items() if v > 0 and '2026-10-08' <= d <= '2026-10-12')
print('08-12.10: минимальное покрытие по кампания-дню:', [(f'{x[0]:.3f}', x[1], x[2], x[3]) for x in mins[:6]])
print('08-12.10: максимальное:', [(f'{x[0]:.3f}', x[1], x[2], x[3]) for x in mins[-3:]])
