# ФЕНИКС iter3, PR #478 @ 528604a. Колонки цены (priceColumns: 14.10 + каждый день смены цены любого артикула плана).
# Сколько колонок даст живая история prices_daily: за прошлые окна по 14 дней (сколько дней со сменой хотя бы у одного
# из 25 артикулов) и мелкие смены (меньше 1%) - шум ли это. Плюс пропуски и нули цены. python3 -I v2_pricecols.py
import json, collections, subprocess, datetime as dt

R = '/home/user/t1'
v2 = json.loads(subprocess.run(['git', '-C', R, 'show', '528604a:analytics-mvp/data/plan_2026-10-15_v2.json'], capture_output=True, text=True, check=True).stdout)
arts = {p['art'] for p in v2['price']}
h = collections.defaultdict(dict)
bad = collections.Counter()
for l in open(R + '/analytics-mvp/data/prices_daily.ndjson', encoding='utf-8'):
    if not l.strip():
        continue
    r = json.loads(l)
    if r.get('offer') not in arts:
        continue
    try:
        p = float(r.get('price'))
    except (TypeError, ValueError):
        bad['не число'] += 1
        continue
    if p <= 0:
        bad['<= 0'] += 1
    h[r['offer']][r['d']] = p
print('артикулов в плане', len(arts), '| с историей цен', len(h), '| без истории', sorted(arts - set(h)), '| плохие цены', dict(bad))
days = sorted({d for x in h.values() for d in x})
print('история с', days[0], 'по', days[-1], '| дней', len(days))


def cols(base, end):
    out, small = {base}, 0
    for x in h.values():
        ks = sorted(x)
        prev = next((x[k] for k in reversed(ks) if k <= base), None)
        for d in [k for k in ks if base < k <= end]:
            v = x[d]
            if prev is not None and v != prev:
                out.add(d)
                if abs(v / prev - 1) < 0.01:
                    small += 1
            prev = v
    return len(out), small


for base in ('2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-01'):
    end = (dt.date.fromisoformat(base) + dt.timedelta(14)).isoformat()
    n, small = cols(base, end)
    print(f'окно {base[5:]}..{end[5:]}: колонок цены {n} (база + {n - 1} дней со сменой), смен меньше 1%: {small}')
n, small = cols('2026-10-14', days[-1])
print(f'живое сейчас (14.10..{days[-1][5:]}): колонок {n}, смен меньше 1%: {small}')
