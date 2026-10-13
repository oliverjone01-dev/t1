# ФЕНИКС iter2, п.19: короткие паузы 1-4 дня в июле-августе - сколько их «сразу после запуска» и что с надбавкой.
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]  # перенесено из пробы ФЕНИКСА iter2
import json, collections as C, statistics as S, math, datetime as dt
D = ROOT+'analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
sh = lambda d, k: (dt.date.fromisoformat(d) + dt.timedelta(k)).isoformat()
H = C.defaultdict(dict); a2s = {}
for r in L('coinv_daily.ndjson'):
    a2s[r['art']] = r['sku']
    if r.get('observed') and r.get('site_listed'):
        H[r['sku']][r['date']] = r['site_listed']
s2a = {v: k for k, v in a2s.items()}
SP = C.defaultdict(C.Counter)
for r in L('ads_sku_daily.ndjson'):
    SP[r['sku']][r['d']] += r['sp']
days = sorted({d for s in H.values() for d in s})
adv = lambda s, d: SP[s][d] > 0
store = {}
for a, b in zip(days, days[1:]):
    v = [math.log(H[s][b] / H[s][a]) for s in H if a in H[s] and b in H[s] and not adv(s, a) and not adv(s, b) and not adv(s, sh(b, -2))]
    if len(v) > 50:
        store[b] = S.median(v)
def exc(s, d0, d1):
    if d0 not in H[s] or d1 not in H[s]:
        return None
    return math.log(H[s][d1] / H[s][d0]) - sum(store.get(x, 0) for x in days if d0 < x <= d1)
pc = lambda x: '%+.1f%%' % ((math.exp(x) - 1) * 100) if x is not None else '  -  '
n = 0; after_launch = []
for s in SP:
    if s not in H:
        continue
    on = sorted(x for x in SP[s] if SP[s][x] > 0)
    for a, b in zip(on, on[1:]):
        gap = (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days - 1
        if 1 <= gap <= 4 and '2026-07-05' <= a <= '2026-08-31':
            n += 1
            starts = [d for d in on if d <= a and not any(SP[s][sh(d, -k)] > 0 for k in range(1, 6))]
            if not starts:
                continue
            st = starts[-1]
            base = sh(st, -1)
            lv = [exc(s, base, sh(b, k)) for k in (0, 2, 4, 6)]
            run = (dt.date.fromisoformat(a) - dt.date.fromisoformat(st)).days + 1
            if run <= 3:
                after_launch.append((s2a.get(s, s), st, a, gap, lv))
print('коротких пауз 1-4 дня, расход до 05.07-31.08: %d' % n)
print('из них «сразу после запуска» (прогон до паузы 1-3 дня): %d' % len(after_launch))
for art, st, a, gap, lv in sorted(after_launch, key=lambda x: x[1]):
    print('  %-22s старт %s, пауза после %s на %d дн.; цена к магазину от дня до старта: при включении %s, +2 дн. %s, +4 дн. %s, +6 дн. %s' % (art, st, a, gap, *[pc(x) for x in lv]))
