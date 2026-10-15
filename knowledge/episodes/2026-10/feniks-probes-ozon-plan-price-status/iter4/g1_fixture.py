# ФЕНИКС iter4 (ba5b560). G1: цвет зоны под стрелкой против статуса на спидометрах периода 15-31.10.
# Фикстуры поверх закреплённых data/ (копия 4f2409c): заказы главного товара каждой карточки с 15.10 по last, накопленное к дню n =
# ceil(m x порог x n / 14): m = 1,1 (идём с запасом 10%) и 0,8 (отстаём на 20%). Реклама - фикстуры w6 из iter3 (p6/fx_w6_*).
# Печатает пары <dir>:<today> для render8.mts (today = last + 1). python3 -I g1_fixture.py
import json, os, shutil, math, datetime as dt
SC = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/'
SRC = SC + 'p5/data_4f2409c/analytics-mvp/data/'
OUTD = SC + 'p7/'
P = json.load(open(SRC + 'plan_2026-10-15_v3.json', encoding='utf-8'))
G = json.load(open(SRC + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
D = lambda s: dt.date.fromisoformat(s)
rng = lambda a, b: [(D(a) + dt.timedelta(days=k)).isoformat() for k in range((D(b) - D(a)).days + 1)]
pairs = []
for m in (1.1, 0.8):
    for last in ('2026-10-17', '2026-10-20', '2026-10-24', '2026-10-27', '2026-10-31'):
        nm = f'g1_m{str(m).replace(".", "")}_{last[5:].replace("-", "")}'
        dst = OUTD + 'fx_' + nm + '/'
        if os.path.isdir(dst): shutil.rmtree(dst)
        os.makedirs(dst)
        for f in os.listdir(SRC):
            if f != 'orders_daily.ndjson': os.symlink(SRC + f, dst + f)
        shutil.copy(SRC + 'orders_daily.ndjson', dst + 'orders_daily.ndjson')
        k = 0
        with open(dst + 'orders_daily.ndjson', 'a', encoding='utf-8') as fh:
            for c in P['cards']:
                acc = 0
                for n, d in enumerate(rng('2026-10-15', last), start=1):
                    want = math.ceil(m * c['threshold'] * n / 14 - 1e-9); u = want - acc; acc = want
                    if u <= 0: continue
                    k += 1
                    fh.write(json.dumps({'order': f'FX-{nm}-{k}', 'd': d, 't': d + 'T12:00:00Z', 'status': 'delivered', 'scheme': 'FBO',
                                         'sku': off2sku[c['main_art']], 'offer': c['main_art'], 'units': u, 'revenue': 1000 * u}, ensure_ascii=False) + '\n')
        pairs.append(f'{dst.rstrip("/")}:{(D(last) + dt.timedelta(days=1)).isoformat()}')
w6 = SC + 'p6/'
for nm, today in (('w6_x15_1015', '2026-10-16'), ('w6_x15_1020', '2026-10-21'), ('w6_x15_1021', '2026-10-22'), ('w6_x15_1028', '2026-10-29'),
                  ('w6_x13_1028', '2026-10-29'), ('w6_x13_1031', '2026-11-01'), ('w6_x10_1028', '2026-10-29'), ('w6_x08_1028', '2026-10-29')):
    pairs.append(f'{w6}fx_{nm}:{today}')
open(OUTD + 'g1_pairs.txt', 'w', encoding='utf-8').write(' '.join(pairs))
print(len(pairs), 'пар ->', OUTD + 'g1_pairs.txt')
