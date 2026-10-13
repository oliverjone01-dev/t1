# ФЕНИКС iter2, п.17: 9 «скачков без смены ставки» по 07.09 - через сколько дней после смены и в какую сторону.
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]  # перенесено из пробы ФЕНИКСА iter2
import json, collections as C, statistics as S, math, datetime as dt
D = ROOT+'analytics-mvp/data/'
R = ROOT+'analytics-mvp/tools/tests/cpo_history.psv'
L = lambda f: [json.loads(l) for l in open(D + f)]
sh = lambda d, k: (dt.date.fromisoformat(d) + dt.timedelta(k)).isoformat()
H = C.defaultdict(dict)
for r in L('coinv_daily.ndjson'):
    if r.get('observed') and r.get('site_listed'):
        H[r['sku']][r['date']] = r['site_listed']
SP = C.defaultdict(C.Counter)
for r in L('ads_sku_daily.ndjson'):
    SP[r['sku']][r['d']] += r['sp']
days = sorted({d for s in H.values() for d in s})
clean = lambda s, d: sum(SP[s][sh(d, -k)] for k in range(0, 8)) == 0
mv = {}
for a, b in zip(days, days[1:]):
    v = [math.log(H[s][b] / H[s][a]) for s in H if a in H[s] and b in H[s] and clean(s, b)]
    if len(v) > 50:
        mv[b] = S.median(v)
log = [l.strip().split('|') for l in open(R)][1:]
print('журнал: первая запись', log[0][0], 'последняя', log[-1][0], 'записей', len(log))
ch = sorted({ts[:10] for ts, c, u in log})
pc = lambda x: '%+.1f%%' % ((math.exp(x) - 1) * 100)
free = [d for d in sorted(mv) if d <= '2026-09-07' and abs(mv[d]) > 0.02 and not any(sh(d, k) in ch for k in (0, -1))]
print('свободных дней:', len(free))
rev = 0; lag24 = 0
for d in free:
    prev = max(c for c in ch if c < d)
    lag = (dt.date.fromisoformat(d) - dt.date.fromisoformat(prev)).days
    # сдвиг магазина за день смены и следующий
    jump = sum(mv.get(sh(prev, k), 0) for k in (0, 1))
    opp = (jump > 0) != (mv[d] > 0)
    rev += opp; lag24 += 2 <= lag <= 4
    print('  %s сдвиг %s; последняя смена ставки %s (%d дн. назад), сдвиг за день смены и следующий %s; %s' % (
        d, pc(mv[d]), prev, lag, pc(jump), 'обратный знак' if opp else 'тот же знак'))
print('через 2-4 дня после смены: %d из %d; знак обратный сдвигу при смене: %d из %d' % (lag24, len(free), rev, len(free)))
# база: доля всех дней по 07.09 (с mv), лежащих через 2-4 дня после смены
alld = [d for d in mv if d <= '2026-09-07' and not any(sh(d, k) in ch for k in (0, -1))]
base = sum(1 for d in alld if any(sh(d, -k) in ch for k in (2, 3, 4)))
print('база: дней без смены в тот же/предыдущий день %d, из них через 2-4 дня после смены %d' % (len(alld), base))
