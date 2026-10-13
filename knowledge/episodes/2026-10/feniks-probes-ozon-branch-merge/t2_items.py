# Проба ФЕНИКСА, тест 2 «Выход из Усиления»: по каждому товару отношение «после / база» для предельной и витрины,
# затем медиана по группе (а не отношение медиан уровней, как в test2_close.py). База 22-28.09, после 30.09-11.10.
import json, collections as C, statistics as S
D = '/home/user/t1-v4/analytics-mvp/data/'
R = '/home/user/t1-v4/analytics-mvp/tools/tests/tests.json'
T = [x for x in json.load(open(R))['тесты'] if x['id'] == 'boost_plus_exit'][0]
L = lambda f: [json.loads(l) for l in open(D + f)]
P = {(p['d'], p['offer']): p['price'] for p in L('prices_daily.ndjson') if p['d'] >= '2026-09-23'}
G = {(g['date'], g['art']): g['site_to_seller'] for g in L('gap_daily.ndjson')}
U = C.defaultdict(set)
for a in L('acts_daily.ndjson'):
    if 'усил' in a['title'].lower():
        U[a['date']].add(a['art'])
pre = ['2026-09-%02d' % i for i in range(22, 29)]
post = ['2026-09-30'] + ['2026-10-%02d' % i for i in range(1, 12)]
groups = {'вышли (test_ad)': T['роли']['test_ad'], 'соседи (test_sibling)': T['роли']['test_sibling'], 'контроль': T['контроль']}


def med(a, days, f):
    v = [f(d, a) for d in days if f(d, a) is not None]
    return S.median(v) if v else None


fp = lambda d, a: P.get((d, a))
fs = lambda d, a: P[(d, a)] * G[(d, a)] if (d, a) in P and (d, a) in G else None
fr = lambda d, a: G.get((d, a))
for g, arts in groups.items():
    rp, rs, rr = [], [], []
    print('==', g, len(arts))
    for a in arts:
        p0, p1 = med(a, pre, fp), med(a, post, fp)
        s0, s1 = med(a, pre, fs), med(a, post, fs)
        r0, r1 = med(a, pre, fr), med(a, post, fr)
        if None in (p0, p1, s0, s1):
            print('  %-20s нет данных' % a)
            continue
        rp.append(p1 / p0 - 1); rs.append(s1 / s0 - 1); rr.append(r1 - r0)
        if len(arts) <= 10:
            inU = ''.join('У' if a in U[d] else '.' for d in pre + post)
            print('  %-20s предельная %+6.1f%% витрина %+6.1f%% витрина/предельная %+5.1f п. | Усиление по дням %s' % (a, (p1 / p0 - 1) * 100, (s1 / s0 - 1) * 100, (r1 - r0) * 100, inU))
    print('  МЕДИАНА по товарам: предельная %+.1f%%, витрина %+.1f%%, доля витрины %+.1f п. (n=%d)' % (S.median(rp) * 100, S.median(rs) * 100, S.median(rr) * 100, len(rp)))
