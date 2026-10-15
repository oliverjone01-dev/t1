# ФЕНИКС iter3 (e063381). B4: спидометр «Карточки на пути» против статусов таблицы 1 на одной сборке.
# Фикстуры поверх закреплённых data/ (копия 4f2409c): orders_daily = копия + синтетические заказы главного товара каждой карточки
# с 15.10 по день last (Пуассон, темп порог/14 x f, f карточки случайный 0,6..1,4; сид фиксирован), status delivered, t 12:00 UTC.
# Ещё фикстура «ровно в путь»: каждый день у карточки ровно столько, чтобы накопленное = round(порог x n/14) - граница >= против >.
# Печатает пары <dir>:<today> для render7.mts (today = last + 1 день). python3 -I b4_fixture.py
import json, os, shutil, random, math, datetime as dt
SC = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/'
SRC = SC + 'p5/data_4f2409c/analytics-mvp/data/'
OUTD = SC + 'p6/'
P = json.load(open(SRC + 'plan_2026-10-15_v3.json', encoding='utf-8'))
G = json.load(open(SRC + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
D = lambda s: dt.date.fromisoformat(s)
rng = lambda a, b: [(D(a) + dt.timedelta(days=k)).isoformat() for k in range((D(b) - D(a)).days + 1)]
def pois(lam, R):
    L, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= R.random()
        if p <= L: return k
        k += 1
def make(name, per_card):
    dst = OUTD + 'fx_' + name + '/'
    if os.path.isdir(dst): shutil.rmtree(dst)
    os.makedirs(dst)
    for f in os.listdir(SRC):
        if f != 'orders_daily.ndjson': os.symlink(SRC + f, dst + f)
    shutil.copy(SRC + 'orders_daily.ndjson', dst + 'orders_daily.ndjson')
    n = 0
    with open(dst + 'orders_daily.ndjson', 'a', encoding='utf-8') as fh:
        for c, rows in per_card:
            for d, u in rows:
                if u <= 0: continue
                n += 1
                fh.write(json.dumps({'order': f'FX-{name}-{n}', 'd': d, 't': d + 'T12:00:00Z', 'status': 'delivered', 'scheme': 'FBO',
                                     'sku': off2sku[c['main_art']], 'offer': c['main_art'], 'units': u, 'revenue': 0}, ensure_ascii=False) + '\n')
    return dst.rstrip('/')
pairs = []
LASTS = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-20', '2026-10-22', '2026-10-24', '2026-10-26', '2026-10-28', '2026-10-30']
for seed in (1, 2, 3):
    R = random.Random(20261015 + seed)
    mult = [0.6 + 0.8 * R.random() for _ in P['cards']]
    full = [[(d, pois(c['threshold'] / 14 * m, R)) for d in rng('2026-10-15', '2026-10-30')] for c, m in zip(P['cards'], mult)]
    for last in LASTS:
        nm = f'b4s{seed}_{last[5:].replace("-", "")}'
        dst = make(nm, [(c, [(d, u) for d, u in rows if d <= last]) for c, rows in zip(P['cards'], full)])
        pairs.append(f'{dst}:{(D(last) + dt.timedelta(days=1)).isoformat()}')
# ровно в путь: накопленное к дню n = round(порог x n / 14)
ex = []
for c in P['cards']:
    acc, rows = 0, []
    for k, d in enumerate(rng('2026-10-15', '2026-10-28')):
        want = round(c['threshold'] * (k + 1) / 14); rows.append((d, want - acc)); acc = want
    ex.append((c, rows))
for last in ('2026-10-17', '2026-10-21', '2026-10-24', '2026-10-28'):
    dst = make(f'b4path_{last[5:].replace("-", "")}', [(c, [(d, u) for d, u in rows if d <= last]) for c, rows in ex])
    pairs.append(f'{dst}:{(D(last) + dt.timedelta(days=1)).isoformat()}')
open(OUTD + 'b4_pairs.txt', 'w', encoding='utf-8').write(' '.join(pairs))
print(len(pairs), 'пар ->', OUTD + 'b4_pairs.txt')
