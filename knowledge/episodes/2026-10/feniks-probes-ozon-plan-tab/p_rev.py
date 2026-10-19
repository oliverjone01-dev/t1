# Проба оборота: revenue orders_daily по периодам (смена смысла цены 23.09) и смещение к цели «плохо».
import json
DD = '/home/user/t1/analytics-mvp/data/'
P = json.load(open(DD + 'plan_2026-10-15.json'))
od = []
for l in open(DD + 'orders_daily.ndjson', encoding='utf-8'):
    l = l.strip()
    if l: od.append(json.loads(l))
def agg(a, b):
    u = r = 0; days = set()
    for o in od:
        if o['status'] != 'cancelled' and a <= o['d'] <= b:
            u += float(o['units']); r += float(o['revenue'] or 0)
    import datetime as dt
    n = (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days + 1
    return u, r, n
for a, b in [('2026-09-14', '2026-09-22'), ('2026-09-23', '2026-10-11'), ('2026-09-14', '2026-10-11'), ('2026-10-01', '2026-10-13')]:
    u, r, n = agg(a, b)
    print(f'{a}..{b}: {n} дн, шт {u:.0f} ({u/n:.2f}/дн), оборот {r/1e6:.2f} млн ({r/n/1e6:.3f}/дн), на шт {r/u:,.0f}')
g = P['goal']['turn_mln']['oct']; gu = P['goal']['units']['oct']
u, r, n = agg('2026-09-14', '2026-10-11')
print('оборот базы в день / путь «плохо» в день =', round((r / n / 1e6) / (g['lo'] / 31), 4))
print('шт базы в день / путь «плохо» в день =', round((u / n) / (gu['lo'] / 31), 4))
u2, r2, n2 = agg('2026-09-23', '2026-10-11')
print('оборот 23.09-11.10 в день / путь «плохо» в день =', round((r2 / n2 / 1e6) / (g['lo'] / 31), 4))
print('шт 23.09-11.10 в день / путь «плохо» в день =', round((u2 / n2) / (gu['lo'] / 31), 4))
