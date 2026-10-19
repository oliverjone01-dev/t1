# ФЕНИКС проба P3 (OZON v5): модельные атаки на forecast.py автора (импорт модулем, логика не меняется)
#  a) карточки теста 4 против 26 снижаемых
#  b) база В0 держит кампании, остановленные до 10.10, на среднем расходе 4 недель: сколько из «+148 / +297» уже случилось
#  c) чувствительность «доля списания 100%»: автор меняет SH и у 5%, и у 9%; честно - только у 9%
#  d) канал показов ставки 9% (справка п.16: заказы магазина -2,8% на +1 п., 95% ДИ -7,6..+2,3)
#  e) сетка углов допущений в объявленных диапазонах: где В2 >= В1
#  f) рекомендованная конфигурация пилота (KUVINO держим, KONUX на минимум) и её худший угол против В0
import sys, json, itertools
sys.path.insert(0, '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v5')
import forecast as F
R = '/home/user/t1/'
t = json.load(open(R + 'analytics-mvp/tools/tests/tests.json'))
t4 = t['тесты_цены'][0]['тест']; excl = set(t['тесты_цены'][0]['исключены'])
cg = json.load(open(R + 'analytics-mvp/data/card_groups.json'))['groups']
off2g = {s['offer']: g['model'] for g in cg for s in g['skus']}
T = {o['art'] for o in F.lst.values()}
print('a) тест 4: чистые (не исключены):', [a for a in t4 if a not in excl])
for a in t4:
    g = off2g.get(a); nb = sorted(x for x in T if off2g.get(x) == g) if g else []
    print('   ', a, 'чистый' if a not in excl else 'исключён', '| из 26 в той же карточке:', nb)
stopped = {k: c for k, c in F.camp.items() if not F.active(c)}
w_stop = sum(c['sp'] for c in stopped.values()) / F.WEEKS
print(f'\nb) кампаний за клик {len(F.camp)}, идут на 10-11.10 {sum(F.active(c) for c in F.camp.values())}, остановлены раньше {len(stopped)}')
print(f'   расход остановленных в базе В0: {w_stop:,.0f} ₽/нед ({w_stop / F.clk0:.0%} клика «сейчас»)'.replace(',', ' '))
for sc in F.SCN:
    k = F.K_CLK[sc]
    lost_pi = sum(c['o'] / F.WEEKS * k * F.camp_pi(c)[0] for c in stopped.values())
    already = (w_stop - lost_pi) * 2
    tot = F.run('Вк', sc)['prof'] - F.run('В0', sc)['prof']
    print(f'   {sc:8}: «клик до минимума» {tot / 1000:+.0f} тыс., уже случилось (остановленные) {already / 1000:+.0f}, действие варианта {(tot - already) / 1000:+.0f}')
sp_now = sum(c['sp'] for c in F.camp.values() if F.active(c)) / F.WEEKS
print(f'   клик «сейчас» по идущим кампаниям: {sp_now * 2 / 1000:.0f} тыс. за 2 нед против {F.clk0 * 2 / 1000:.0f} тыс. в таблице')
def run2(var, sc, eps=None, sh9=None, vis=0.0, keep_ids=None):
    """копия F.run с ручками: sh9 - доля списания только у 9%; vis - сдвиг заказов магазина от показов ставки 9%;
       keep_ids - свой набор кампаний на текущем бюджете; var 'П' - цена как В1, клик по keep_ids"""
    eps = F.EPS[sc] if eps is None else eps; k, d9, xf = F.K_CLK[sc], F.D9[sc], F.XFER[sc]
    prof = 0
    for sku, r in F.rows.items():
        u = F.U[sku] / F.WEEKS
        if not u: continue
        p, s, nom = r['p0'], r['s'], 0.05; steal = 0
        if var in ('В1', 'В1б', 'П') and sku in F.lst:
            p = r['p0'] * (1 - F.lst[sku]['step'] / 100); u1 = u * (p / r['p0']) ** eps
            steal = (u1 - u) * xf; u = u1
        if var == 'В2':
            nom = 0.09; s = r['s'] * (1 + d9); u *= (1 + d9) ** eps * (1 + vis)
        p0pi = F.pi(r, r['p0'], 0.05, r['s'])
        if var == 'В2' and sh9 is not None:
            pr = r['keep'] * p - nom * sh9 * p - r['cogs'] - r['shipn'] - F.TAX * p * s * F.PAY
        else:
            pr = F.pi(r, p, nom, s)
        prof += u * pr - steal * p0pi
    keep = set(F.camp) if var == 'В0' else (keep_ids if keep_ids is not None else (F.SEL if var == 'В1' else set()))
    sp, lost, lost_pi = F.clicks(keep, k)
    return (prof - sp - lost_pi) * F.H
for sc in F.SCN:
    base = F.run('В2', sc)['prof'] - F.run('Вк', sc)['prof']
    honest = run2('В2', sc, sh9=1.0) - run2('Вк', sc)
    F.SH, sh_keep = 1.0, F.SH; author = F.run('В2', sc)['prof'] - F.run('Вк', sc)['prof']; F.SH = sh_keep
    print(f'c) {sc:8}: ставка 9% при 0,82 {base / 1000:+.0f}; при 100% по-авторски (и у 5%) {author / 1000:+.0f}; только у 9% {honest / 1000:+.0f} тыс.')
vis_pt, vis_hi, vis_lo = 0.972 ** 4 - 1, 1.023 ** 4 - 1, 0.924 ** 4 - 1
print(f'\nd) заказы магазина при 9% против 5% (справка п.16, x4 п.): точка {vis_pt:+.1%}, 95% ДИ {vis_lo:+.1%}..{vis_hi:+.1%}')
for sc in F.SCN:
    v1 = run2('В1', sc)
    print(f'   {sc:8}: В1-В2 без канала {(v1 - run2("В2", sc)) / 1000:+.0f}; точка {(v1 - run2("В2", sc, vis=vis_pt)) / 1000:+.0f}; верх ДИ {(v1 - run2("В2", sc, vis=vis_hi)) / 1000:+.0f} тыс.')
for sc in F.SCN:
    lo, hi = 0.0, 0.5
    for _ in range(40):
        m = (lo + hi) / 2
        if run2('В1', sc) - run2('В2', sc, vis=m) > 0: lo = m
        else: hi = m
    print(f'   {sc:8}: В2 = В1, если ставка 9% добавит заказов магазина {lo:+.1%}')
SCN0 = dict(F.EPS), dict(F.K_CLK), dict(F.D9), dict(F.XFER)
worse = []; n = 0
for e, k, d9, xf, vis in itertools.product((0.0, -1.0, -2.0, -3.6), (0.0, 0.5, 1.0), (0.0, -0.02, -0.04), (0.0, 0.25, 0.5), (0.0, vis_hi)):
    F.EPS['средний'], F.K_CLK['средний'], F.D9['средний'], F.XFER['средний'] = e, k, d9, xf
    d = run2('В1', 'средний') - run2('В2', 'средний', vis=vis); n += 1
    if d <= 0: worse.append((round(d / 1000), e, k, d9, xf, round(vis, 3)))
F.EPS, F.K_CLK, F.D9, F.XFER = [dict(x) for x in SCN0]
print(f'\ne) углов {n}: В2 >= В1 в {len(worse)}; без канала показов: {[w for w in worse if w[5] == 0]}')
kuv = {cid for cid in F.SEL if F.camp[cid]['off'] == 'GGM-18-2-2'}
print('\nf) пилот: на текущем бюджете', [F.camp[c]['off'] for c in kuv])
for sc in F.SCN:
    print(f'   {sc:8}: пилот - В0 {(run2("П", sc, keep_ids=kuv) - run2("В0", sc)) / 1000:+.0f}; В1 - В0 {(run2("В1", sc) - run2("В0", sc)) / 1000:+.0f}; '
          f'пилот - В2 {(run2("П", sc, keep_ids=kuv) - run2("В2", sc)) / 1000:+.0f} тыс.')
res = []
for e, k, xf in itertools.product((0.0, -1.0, -2.0, -3.6), (0.0, 0.5, 1.0), (0.0, 0.25, 0.5)):
    F.EPS['средний'], F.K_CLK['средний'], F.XFER['средний'] = e, k, xf
    res.append(((run2('П', 'средний', keep_ids=kuv) - run2('В0', 'средний')) / 1000, e, k, xf))
F.EPS, F.K_CLK, F.D9, F.XFER = [dict(x) for x in SCN0]
m = min(res)
print('   худший угол пилот - В0: %+.0f тыс. (ε %s, k %s, переток %s)' % m)
