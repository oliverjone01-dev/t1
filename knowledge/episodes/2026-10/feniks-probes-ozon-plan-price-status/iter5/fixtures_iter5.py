# ФЕНИКС iter5 (381f11d5). Все фикстуры серии заново поверх data/ коммита 381f11d5 (живых данных периода нет: заказы и реклама по 14.10).
# Семейства iter4 (приёмка G1 по букве - те же фикстуры, что дали 62 из 111):
#   g1_m{11,08}_{1017..1031} - заказы главного товара карточек, накопленное ceil(m x порог x n / 14) (g1_fixture.py iter4);
#   w6_x{15,13,10,08}_*      - реклама: кампания FX6 r x ставка 47 815,4 в день с 15.10 (w6_fixture.py iter3);
#   b4s{1,2,3}_* и b4path_*  - «на пути» против таблицы 1 (b4_fixture.py iter3);  below1, exact, nov - окно (w5_fixture.py iter2).
# Новые (сборки 16.10 и 17.10 - первые с фактом периода; Codex P2 по узкой зоне):
#   e{1,2}_{y,g,r} - n = 1 или 2 дня данных; заказы на главных товарах карточек: y - 80% плана карточек на дату, g - 110%, r - 50%;
#   выручка на штуку подобрана так, что оборот к плану на дату 85% / 112% / 50%; реклама FX6 x1,1 / x0,9 / x1,3 к ставке.
# Пишет только в scratch/p8/fx. Печатает пары <dir>:<today> в p8/pairs_*.txt. python3 -I fixtures_iter5.py
import json, os, shutil, math, random, datetime as dt
SC = '/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/'
SRC = SC + 'p8/data_381f11d5/analytics-mvp/data/'
OUT = SC + 'p8/fx/'
os.makedirs(OUT, exist_ok=True)
P = json.load(open(SRC + 'plan_2026-10-15_v3.json', encoding='utf-8'))
G = json.load(open(SRC + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
RATE = (283110 + 51598) / 7
D = lambda s: dt.date.fromisoformat(s)
rng = lambda a, b: [(D(a) + dt.timedelta(days=k)).isoformat() for k in range((D(b) - D(a)).days + 1)]
nxt = lambda s: (D(s) + dt.timedelta(days=1)).isoformat()


def make(name, orders=None, ads=None):
    """orders: [(card, d, units, revenue_per_unit)], ads: [(d, sp)] -> каталог со ссылками на data/ и копиями правленых файлов."""
    dst = OUT + 'fx_' + name + '/'
    if os.path.isdir(dst): shutil.rmtree(dst)
    os.makedirs(dst)
    for f in os.listdir(SRC):
        if (f == 'orders_daily.ndjson' and orders) or (f == 'ads_daily.ndjson' and ads): continue
        os.symlink(SRC + f, dst + f)
    if orders:
        shutil.copy(SRC + 'orders_daily.ndjson', dst + 'orders_daily.ndjson')
        with open(dst + 'orders_daily.ndjson', 'a', encoding='utf-8') as fh:
            for k, (c, d, u, rev) in enumerate(orders, start=1):
                if u <= 0: continue
                fh.write(json.dumps({'order': f'FX-{name}-{k}', 'd': d, 't': d + 'T12:00:00Z', 'status': 'delivered', 'scheme': 'FBO',
                                     'sku': off2sku[c['main_art']], 'offer': c['main_art'], 'units': u, 'revenue': rev * u}, ensure_ascii=False) + '\n')
    if ads:
        shutil.copy(SRC + 'ads_daily.ndjson', dst + 'ads_daily.ndjson')
        with open(dst + 'ads_daily.ndjson', 'a', encoding='utf-8') as fh:
            for d, sp in ads:
                fh.write(json.dumps({'d': d, 'id': 'FX6', 'sp': round(sp, 2), 'cl': 100}) + '\n')
    return dst.rstrip('/')


pairs = {'g1': [], 'b4': [], 'w5': [], 'early': []}
# g1 (iter4)
for m in (1.1, 0.8):
    for last in ('2026-10-17', '2026-10-20', '2026-10-24', '2026-10-27', '2026-10-31'):
        rows = []
        for c in P['cards']:
            acc = 0
            for n, d in enumerate(rng('2026-10-15', last), start=1):
                want = math.ceil(m * c['threshold'] * n / 14 - 1e-9); rows.append((c, d, want - acc, 1000)); acc = want
        pairs['g1'].append(make(f'g1_m{str(m).replace(".", "")}_{last[5:].replace("-", "")}', orders=rows) + ':' + nxt(last))
# w6 (iter3)
for r, last in ((1.5, '2026-10-15'), (1.5, '2026-10-20'), (1.5, '2026-10-21'), (1.5, '2026-10-28'), (1.3, '2026-10-28'), (1.3, '2026-10-31'), (1.0, '2026-10-28'), (0.8, '2026-10-28')):
    pairs['g1'].append(make(f'w6_x{str(r).replace(".", "")}_{last[5:].replace("-", "")}', ads=[(d, r * RATE) for d in rng('2026-10-15', last)]) + ':' + nxt(last))


# b4 (iter3)
def pois(lam, R):
    L, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= R.random()
        if p <= L: return k
        k += 1


LASTS = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-20', '2026-10-22', '2026-10-24', '2026-10-26', '2026-10-28', '2026-10-30']
for seed in (1, 2, 3):
    R = random.Random(20261015 + seed)
    mult = [0.6 + 0.8 * R.random() for _ in P['cards']]
    full = [[(d, pois(c['threshold'] / 14 * m, R)) for d in rng('2026-10-15', '2026-10-30')] for c, m in zip(P['cards'], mult)]
    for last in LASTS:
        rows = [(c, d, u, 0) for c, rr in zip(P['cards'], full) for d, u in rr if d <= last]
        pairs['b4'].append(make(f'b4s{seed}_{last[5:].replace("-", "")}', orders=rows) + ':' + nxt(last))
ex = []
for c in P['cards']:
    acc = 0
    for k, d in enumerate(rng('2026-10-15', '2026-10-28')):
        want = round(c['threshold'] * (k + 1) / 14); ex.append((c, d, want - acc, 0)); acc = want
for last in ('2026-10-17', '2026-10-21', '2026-10-24', '2026-10-28'):
    pairs['b4'].append(make(f'b4path_{last[5:].replace("-", "")}', orders=[x for x in ex if x[1] <= last]) + ':' + nxt(last))


# w5 (iter2)
def spread(total, ds):
    out, acc = [], 0.0
    for k, d in enumerate(ds):
        want = round(total * (k + 1) / len(ds)); out.append((d, want - round(acc))); acc = want
    return [(d, u) for d, u in out if u > 0]


W = rng('2026-10-15', '2026-10-28')
pairs['w5'].append(make('below1', orders=[(c, d, u, 0) for c in P['cards'] for d, u in spread(c['threshold'] - 1, W)]) + ':2026-10-29')
pairs['w5'].append(make('exact', orders=[(c, d, u, 0) for c in P['cards'] for d, u in spread(c['threshold'], W)]) + ':2026-10-29')
pairs['w5'].append(make('nov', orders=[(c, d, u, 0) for c in P['cards'] for d, u in spread(c['threshold'], W) + spread(c['threshold'] / 14 * 6, rng('2026-10-29', '2026-11-03'))]) + ':2026-11-04')

# early: n = 1 (сборка 16.10) и 2 (17.10). Карточки: план 10 в день; магазин 9,7 / 19,4; оборот 0,67 / 1,35 млн; реклама 47 815 / 95 631.
TURN_TD = {1: 0.67, 2: 1.35}
for n in (1, 2):
    ds = rng('2026-10-15', '2026-10-15' if n == 1 else '2026-10-16')
    for st, share, tshare, ar in (('y', 0.8, 0.85, 1.1), ('g', 1.1, 1.12, 0.9), ('r', 0.5, 0.5, 1.3)):
        units = round(10 * n * share)                         # штук на главных товарах карточек за n дней
        rev = TURN_TD[n] * tshare * 1e6 / units                # выручка на штуку -> оборот к плану на дату = tshare
        rows, left = [], units
        for i, d in enumerate(ds):                            # штуки по дням и карточкам по кругу
            k = units // n + (1 if i < units % n else 0)
            for j in range(k):
                rows.append((P['cards'][j % len(P['cards'])], d, 1, round(rev)))
        pairs['early'].append(make(f'e{n}_{st}', orders=rows, ads=[(d, ar * RATE) for d in ds]) + ':' + nxt(ds[-1]))
for k, v in pairs.items():
    open(SC + f'p8/pairs_{k}.txt', 'w', encoding='utf-8').write(' '.join(v))
    print(k, len(v), 'пар ->', SC + f'p8/pairs_{k}.txt')
