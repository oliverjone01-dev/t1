# Проба ФЕНИКСА: «карточка KUVINO растёт, KONUX не растёт» - против общего тренда магазина в те же окна
# (заказы без отмен, orders_daily), плюс грубая пуассоновская погрешность.
import json, math, datetime as dt, collections as C
D = '/home/user/t1-v4/analytics-mvp/data/'
OD = [json.loads(l) for l in open(D + 'orders_daily.ndjson')]
CG = json.load(open(D + 'card_groups.json'))['groups']
card = {x['offer']: g['main'] for g in CG for x in g['skus']}
members = C.defaultdict(set)
for g in CG:
    for x in g['skus']:
        members[g['main']].add(x['offer'])
sh = lambda d, k: (dt.date.fromisoformat(d) + dt.timedelta(k)).isoformat()
nd = lambda f, t: (dt.date.fromisoformat(t) - dt.date.fromisoformat(f)).days + 1


def units(arts, f, t):
    return sum(x['units'] for x in OD if (arts is None or x['offer'] in arts) and f <= x['d'] <= t and x['status'] != 'cancelled')


for name, art, f, t in (('KONUX', 'GGT-35-5-1-100-180', '2026-09-22', '2026-10-10'), ('KUVINO', 'GGM-18-2-2', '2026-10-01', '2026-10-10')):
    arts = members[card[art]]
    pf, pt = sh(f, -14), sh(f, -1)
    c0, c1 = units(arts, pf, pt), units(arts, f, t)
    s0, s1 = units(None, pf, pt), units(None, f, t)
    w0, w1 = c0 / 14 * 7, c1 / nd(f, t) * 7
    g_card = w1 / w0 - 1
    g_shop = (s1 / nd(f, t)) / (s0 / 14) - 1
    se = math.sqrt(1 / max(c0, 1) + 1 / max(c1, 1))
    print('%s: карточка %d шт за 14 дн. (%.1f/нед) -> %d шт за %d дн. (%.1f/нед), %+.0f%%; магазин %+.0f%% (%d -> %d шт); карточка к магазину %+.0f%%; пуассон SE лог-отношения ~%.0f%%' % (
        name, c0, w0, c1, nd(f, t), w1, g_card * 100, g_shop * 100, s0, s1, ((1 + g_card) / (1 + g_shop) - 1) * 100, se * 100))
    # «до теста» как в Word: с 07.09
    c07 = units(arts, '2026-09-07', sh(f, -1))
    print('   с 07.09 до старта: %d шт за %d дн. = %.1f/нед' % (c07, nd('2026-09-07', sh(f, -1)), c07 / nd('2026-09-07', sh(f, -1)) * 7))
