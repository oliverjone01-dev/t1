# ФЕНИКС итерация 2 (OZON v5 @ 6a8dd1c), forecast.py и pilot.json автора:
#  a) прогноз исполнения «Предлагаю» на первые 2 недели: цена у 17 (без 9 в карточках теста 4), на минимум только KONUX,
#     прочие идущие кампании на своём бюджете - против строки «Вариант 1 рекомендуемый» (26 цен, весь клик сразу)
#  b) правило отката «через 2 недели заказы карточек упали к магазину»: вероятность отката при разной правде (Пуассон)
#  c) «3 угла из 216»: для какого варианта; сетка для рекомендуемого В1б
import sys, json, math, itertools
sys.path.insert(0, '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v5')
import forecast as F
pil = json.load(open('/tmp/ozon-v5/pilot.json')); wait = set(pil['wait'])
def runx(sc, price_skus, keep_ids):
    eps, k, xf = F.EPS[sc], F.K_CLK[sc], F.XFER[sc]; prof = 0
    for sku, r in F.rows.items():
        u = F.U[sku] / F.WEEKS
        if not u: continue
        p = r['p0']; steal = 0
        if sku in price_skus:
            p = r['p0'] * (1 - F.lst[sku]['step'] / 100); u1 = u * (p / r['p0']) ** eps; steal = (u1 - u) * xf; u = u1
        prof += u * F.pi(r, p, 0.05, r['s']) - steal * F.pi(r, r['p0'], 0.05, r['s'])
    sp, lost, lost_pi = F.clicks(keep_ids, k)
    return (prof - sp - lost_pi) * F.H
active = {cid for cid, c in F.camp.items() if F.active(c)}
konux = {cid for cid in active if F.camp[cid]['off'] == 'GGT-35-5-1-100-180'}
p17 = {s for s, o in F.lst.items() if o['art'] not in wait}
for sc in F.SCN:
    v0 = F.run('В0', sc)['prof']
    print(f"a) {sc:8}: строка «рекомендуемый» {(F.run('В1б', sc)['prof'] - v0)/1e3:+.0f}; исполнение 2 нед (17 цен + KONUX на минимум) "
          f"{(runx(sc, p17, active - konux) - v0)/1e3:+.0f}; из него KONUX {(runx(sc, set(), active - konux) - v0)/1e3:+.0f}")
T2, C2 = pil['T'] / 2, pil['C'] / 2; se = math.sqrt(2 / T2 + 2 / C2)
Phi = lambda x: 0.5 * (1 + math.erf(x / math.sqrt(2)))
print(f'b) 2 нед: опыт {T2:.0f}, контроль {C2:.1f}; se {se:.3f}; надёжно виден спад {math.exp(-2.8 * se) - 1:+.0%}')
for lab, eff in (('0%', 0.0), ('+23%', 0.23), ('+46%', 0.46), ('-20%', -0.20)):
    print(f'   правда {lab:5}: откат («упали к магазину») {Phi(-math.log(1 + eff) / se):.0%}')
S0 = dict(F.EPS), dict(F.K_CLK), dict(F.D9), dict(F.XFER), dict(F.M9)
for var in ('В1', 'В1б'):
    cnt = {0.0: 0, 0.095: 0}
    for e, k, d9, xf, m9 in itertools.product((0.0, -1.0, -2.0, -3.6), (0.0, 0.5, 1.0), (0.0, -0.02, -0.04), (0.0, 0.25, 0.5), (0.0, 0.095)):
        F.EPS['средний'], F.K_CLK['средний'], F.D9['средний'], F.XFER['средний'], F.M9['средний'] = e, k, d9, xf, m9
        if F.run(var, 'средний')['prof'] - F.run('В2', 'средний')['prof'] <= 0: cnt[m9] += 1
    F.EPS, F.K_CLK, F.D9, F.XFER, F.M9 = [dict(x) for x in S0]
    print(f'c) {var}: В2 не хуже в {cnt[0.0]} из 108 углов без канала показов и в {cnt[0.095]} из 108 при m9 +9,5%')
