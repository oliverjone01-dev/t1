import json, math, collections as C, datetime as dt
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
ad = L('ads_daily.ndjson')
CPO = '28753239'
# current click pace: last 7 / last 4 days of ads_daily vs 4-week average 14.09-11.10
day = C.Counter()
for a in ad:
    if a['id'] != CPO: day[a['d']] += a['sp']
for A, B in (('2026-09-14', '2026-10-11'), ('2026-10-05', '2026-10-11'), ('2026-10-08', '2026-10-11')):
    ds = [d for d in day if A <= d <= B]; n = (dt.date.fromisoformat(B) - dt.date.fromisoformat(A)).days + 1
    s = sum(day[d] for d in ds)
    print(f'click spend {A}..{B}: {s:,.0f} over {n} days = {s / n * 30.4 / 1e3:,.0f} thousand per month'.replace(',', ' '))
# weekend vs weekday CPO with Poisson CI on ad orders, both windows 01.07 and 03.07
for A in ('2026-07-01', '2026-07-03'):
    B = '2026-10-11'
    sp = C.Counter(); o = C.Counter(); cl = C.Counter()
    for a in ad:
        if A <= a['d'] <= B and a['id'] != CPO:
            we = dt.date.fromisoformat(a['d']).weekday() >= 5
            sp[we] += a['sp']; o[we] += a.get('o', 0); cl[we] += a.get('cl', 0)
    cpo_we, cpo_wd = sp[True] / o[True], sp[False] / o[False]
    r = cpo_we / cpo_wd
    se = math.sqrt(1 / o[True] + 1 / o[False])
    lo, hi = r * math.exp(-1.96 * se), r * math.exp(1.96 * se)
    print(f'{A}..{B}: ad orders weekend {o[True]} weekday {o[False]}; CPO weekend {cpo_we:,.0f} weekday {cpo_wd:,.0f}; ratio {r:.3f} 95% CI {lo:.2f}-{hi:.2f}; '
          f'orders per 1000 clicks {1000 * o[True] / cl[True]:.2f} / {1000 * o[False] / cl[False]:.2f}'.replace(',', ' '))
# concentration of a weekly budget into 2 days under the model's own power 0.81 applied per day
E = 0.81
print(f'2 days x 5000 vs 7 days x 1428.6 under spend^0.81 per day: ratio {(2 * 5000 ** E) / (7 * (10000 / 7) ** E):.3f}')
# KUVINO test 3 (01.10-12.10) card orders and the own-share estimate with Poisson CI (doc_data.py:48-55 formula)
g = json.load(open(D + 'card_groups.json'))['groups']
offs = next({s['offer'] for s in gr['skus']} for gr in g if any(s['offer'] == 'GGM-18-2-2' for s in gr['skus']))
od = L('orders_daily.ndjson')
n = sum(o['units'] for o in od if '2026-10-01' <= o['d'] <= '2026-10-12' and o['status'] != 'cancelled' and o.get('offer') in offs)
days = 12; rate = n / days * 7; se = math.sqrt(n) / days * 7
print(f'KUVINO card 01-12.10: {n} orders in {days} days = {rate:.1f}/wk (95% CI {rate - 1.96 * se:.1f}-{rate + 1.96 * se:.1f}); '
      f'own share by doc_data formula (b1 - 8.0*1.13)/2.25: point {(rate - 9.04) / 2.25:+.0%}, CI {(rate - 1.96 * se - 9.04) / 2.25:+.0%}..{(rate + 1.96 * se - 9.04) / 2.25:+.0%}')
