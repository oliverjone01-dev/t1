# v5: прогноз прибыли магазина OZON на 2 недели, вариант 1 против варианта 2 (задача Ивана 13.10).
#  В1: ставка за заказ 5%, предельная цена снижена у 26 артикулов (list26.json), клик: выбранные кампании на текущем
#      бюджете, остальные - минимум (цена клика 8-12 ₽, бюджет 2 000 ₽/нед).
#  В2: ставка за заказ 9% на весь магазин, цены не меняем, все кампании за клик - минимум.
#  В0: как сейчас (база сравнения).
# Прибыль (ответ «2а»): заказы без отмен x [К выплате - ставка за заказ - себестоимость - наша доставка - налог 15%
#  от оплаты покупателя] - расход за клик. АДМ не вычитаем (одинаков в вариантах), строка «как в Отчете» с АДМ 30% - отдельно.
# База: заказы без отмен 14.09-11.10 (4 недели, orders_daily по дате заказа), расход за клик за те же даты (ads_daily).
# Параметры товара (доля К выплате с 01.09, себестоимость, доставка, доля витрины) - из исправленной модели пола цены
# (проба ФЕНИКСА P20, её запускает list26.py). Запуск: python3 -I list26.py <xlsx>; python3 -I forecast.py
# Выход с прибылью по артикулам - /tmp/ozon-v5/forecast.json, в репозиторий не кладётся (репо публичный).
import json, collections as C, statistics as S, math, os
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = HERE.split('knowledge/')[0]; D = ROOT + 'analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
A, B = '2026-09-14', '2026-10-11'; WEEKS = 4; H = 2            # окно базы и горизонт прогноза, недели
TAX, PAY, ADM = 0.15, 0.914, 0.30                               # налог от оплаты покупателя («Отчет»), PAY - P20
MIN_WK = 2000                                                   # минимальный клик: бюджет кампании в неделю
E_SP = 0.81                                                     # показы рекламы ~ расход^0,81 (ФЕНИКС iter6, K2)
CPO_ID = '28753239'                                             # кампания «Оплата за заказ - все товары»
EPS = {'низкий': -1.0, 'средний': -2.0, 'высокий': -3.6}        # эластичность заказов к цене витрины (elastic.py: -3,6 верх)
K_CLK = {'низкий': 0.0, 'средний': 0.5, 'высокий': 1.0}         # доля заказов из отчёта рекламы, которые свои (тест 3: ~0)
D9 = {'низкий': 0.0, 'средний': -0.02, 'высокий': -0.04}        # витрина при 9% против 5% (cpo_discount.py: +0,5...-4%)
XFER = {'низкий': 0.5, 'средний': 0.25, 'высокий': 0.0}         # доля прироста В1, перетянутая у соседей по карточке (KONUX, тест 3)
SCN = ('низкий', 'средний', 'высокий')

rows = {r['sku']: r for r in json.load(open('/tmp/feniks-floor/floor_rows_patched.json'))}
art2sku = {r['art']: r['sku'] for r in rows.values()}
lst = {o['sku']: o for o in json.load(open('/tmp/ozon-v5/list26.json')) if o['step'] > 0}
assert len(lst) == 26
# --- заказы без отмен за окно базы
U = C.Counter(); U_all = C.Counter(); rev = 0
for o in L('orders_daily.ndjson'):
    if A <= o['d'] <= B and o['status'] != 'cancelled':
        U_all[o['sku']] += o['units']; rev += o['revenue']
        if o['sku'] in rows: U[o['sku']] += o['units']
cov_u = sum(U.values()) / sum(U_all.values())
# --- доля ставки за заказ, которую реально списывают: расход кампании / (5% x оборот заказов без отмен)
ads = L('ads_daily.ndjson')
cpo_sp = sum(a['sp'] for a in ads if a['id'] == CPO_ID and A <= a['d'] <= B)
SH = cpo_sp / (0.05 * rev)
# --- кампании за клик
camp = C.defaultdict(lambda: dict(sp=0, o=0, off='', last=''))
for a in ads:
    if A <= a['d'] <= B and a['id'] != CPO_ID:
        c = camp[a['id']]; c['sp'] += a['sp']; c['o'] += a.get('o', 0); c['off'] = a['off']
        if a['sp'] > 0: c['last'] = max(c['last'], a['d'])
LAST7 = '2026-10-10'
active = lambda c: c['last'] >= LAST7                            # расход в последние 2 дня окна = кампания идёт
clk0 = sum(c['sp'] for c in camp.values()) / WEEKS

def pi(r, p, nom, s):          # прибыль с заказа без клика, ₽
    return r['keep'] * p - nom * SH * p - r['cogs'] - r['shipn'] - TAX * p * s * PAY
def pi_adm(r, p, nom, s): return pi(r, p, nom, s) - ADM * r['keep'] * p
med_pi = S.median(pi(r, r['p0'], 0.05, r['s']) for r in rows.values() if U[r['sku']])
def camp_pi(c):
    sku = art2sku.get(c['off']); return (pi(rows[sku], rows[sku]['p0'], 0.05, rows[sku]['s']), c['off']) if sku else (med_pi, c['off'] + ' (медиана магазина)')

# В1: какие кампании держим на текущем бюджете - те, что «больше продавались» по отчёту рекламы: 4+ заказа за 4 недели
SEL = {k for k, c in camp.items() if c['o'] >= 4 and active(c)}
CAND = sorted((k for k, c in camp.items() if c['o'] >= 4), key=lambda x: -camp[x]['o'])

def clicks(keep_ids, k):
    """расход за клик в неделю и потерянные заказы x прибыль, если кампании вне keep_ids урезать до минимума"""
    sp = 0; lost = 0; lost_pi = 0
    for cid, c in camp.items():
        w = c['sp'] / WEEKS
        if cid in keep_ids: sp += w; continue
        new = min(w, MIN_WK) if active(c) else 0                # остановленные не включаем ни в одном варианте
        sp += new
        dl = c['o'] / WEEKS * (1 - (new / w) ** E_SP) * k if w > 0 else 0
        lost += dl; lost_pi += dl * camp_pi(c)[0]
    return sp, lost, lost_pi

def run(var, sc, eps=None):
    eps = EPS[sc] if eps is None else eps; k, d9, xf = K_CLK[sc], D9[sc], XFER[sc]
    prof = 0; prof_adm = 0; units = 0; turn = 0; cpo = 0
    for sku, r in rows.items():
        u = U[sku] / WEEKS
        if not u: continue
        p, s, nom = r['p0'], r['s'], 0.05
        steal = 0
        if var in ('В1', 'В1б') and sku in lst:
            p = r['p0'] * (1 - lst[sku]['step'] / 100); u1 = u * (p / r['p0']) ** eps
            steal = (u1 - u) * xf; u = u1                       # перетянутые у соседей: их прибыль теряем
        if var == 'В2': nom = 0.09; s = r['s'] * (1 + d9); u *= (1 + d9) ** eps
        p0pi = pi(r, r['p0'], 0.05, r['s'])
        prof += u * pi(r, p, nom, s) - steal * p0pi; prof_adm += u * pi_adm(r, p, nom, s) - steal * pi_adm(r, r['p0'], 0.05, r['s'])
        units -= steal
        units += u; turn += u * p; cpo += u * nom * SH * p
    keep = set(camp) if var == 'В0' else (SEL if var == 'В1' else set())   # В1б - цена как в В1, клик как в В2
    sp, lost, lost_pi = clicks(keep, k)
    prof -= sp + lost_pi; prof_adm -= sp + lost_pi              # потерянные заказы клика - по прибыли без АДМ в обеих строках
    return dict(prof=prof * H, prof_adm=prof_adm * H, units=(units - lost) * H, turn=turn * H, clk=sp * H, cpo=cpo * H,
                drr=(sp + cpo) / turn, lost=lost * H)

def per_article():
    out = []
    for sku, o in lst.items():
        r = rows[sku]; u = U[sku] / WEEKS; p1 = r['p0'] * (1 - o['step'] / 100)
        a0, a1 = pi(r, r['p0'], 0.05, r['s']), pi(r, p1, 0.05, r['s'])
        need = a0 / a1 - 1 if a1 > 0 else None
        row = dict(art=o['art'], sku=sku, u_wk=u, p0=r['p0'], step=o['step'], p1=p1, vit0=r['p0'] * r['s'], vit1=p1 * r['s'],
                   pi0=a0, pi1=a1, need=need, clicks=sorted(cid for cid in SEL if art2sku.get(camp[cid]['off']) == sku))
        for sc in SCN:
            u1 = u * (1 - o['step'] / 100) ** EPS[sc]; st = (u1 - u) * XFER[sc]
            row['d_' + sc] = (u1 * a1 - u * a0 - st * a0) * H
        out.append(row)
    return sorted(out, key=lambda x: -x['u_wk'])

def cpo_articles(sc='средний'):
    out = []
    for sku, r in rows.items():
        u = U[sku] / WEEKS
        if not u: continue
        s9 = r['s'] * (1 + D9[sc]); u9 = u * (1 + D9[sc]) ** EPS[sc]
        out.append(dict(art=r['art'], u_wk=u, p0=r['p0'], extra=u * 0.04 * SH * r['p0'] * H,
                        d=(u9 * pi(r, r['p0'], 0.09, s9) - u * pi(r, r['p0'], 0.05, r['s'])) * H))
    return sorted(out, key=lambda x: x['d'])

def breakeven(a, b, sc='средний'):
    """эластичность, при которой вариант a = вариант b (остальное - средний сценарий); поиск по сетке"""
    prev = None
    for i in range(0, 801):
        e = -i / 100; d = run(a, sc, e)['prof'] - run(b, sc, e)['prof']
        if prev is not None and (d > 0) != (prev > 0): return e
        prev = d
    return None

if __name__ == '__main__':
    print(f'база {A}..{B}: заказов без отмен {sum(U_all.values())} шт, из них с себестоимостью и ценой {sum(U.values())} '
          f'({cov_u:.0%}); товаров {sum(1 for x in U.values() if x)}; оборот {rev:,.0f} ₽'.replace(',', ' '))
    print(f'ставка за заказ: расход {cpo_sp:,.0f} ₽ = {SH:.2f} от 5% оборота (списывают не со всех заказов); '
          f'клик {clk0:,.0f} ₽/нед, кампаний {len(camp)}, идут на 10-11.10: {sum(active(c) for c in camp.values())}'.replace(',', ' '))
    print('\nкандидаты на дорогой клик в В1 (4+ заказа по отчёту рекламы за 4 недели):')
    for cid in CAND:
        c = camp[cid]; w = c['sp'] / WEEKS; pp, nm = camp_pi(c)
        print(f'  {cid} {nm:22} {"идёт" if active(c) else "стоп "+c["last"][5:]:10} {w:8,.0f} ₽/нед  заказов {c["o"]/WEEKS:.2f}/нед  '
              f'₽ на заказ {c["sp"]/c["o"]:8,.0f}  прибыль заказа {pp:8,.0f}  окупается, если своих {w/(c["o"]/WEEKS*pp):.0%}'
              f'{"  -> в В1" if cid in SEL else ""}'.replace(',', ' '))
    print('\nпрогноз за 2 недели, ₽ (сценарий: эластичность / доля своих заказов клика / витрина при 9% / переток у соседей):')
    R = {}
    for sc in SCN:
        for v in ('В0', 'В1', 'В1б', 'В2'): R[(v, sc)] = run(v, sc)
        print(f' {sc:8} ε={EPS[sc]:+.1f} k={K_CLK[sc]:.1f} d9={D9[sc]:+.0%} переток={XFER[sc]:.0%}')
        for v in ('В0', 'В1', 'В1б', 'В2'):
            x = R[(v, sc)]
            print(f'   {v:3}: прибыль {x["prof"]:11,.0f}  (с АДМ {x["prof_adm"]:11,.0f})  заказов {x["units"]:6.1f}  '
                  f'клик {x["clk"]:9,.0f}  ставка {x["cpo"]:9,.0f}  ДРР {x["drr"]:.1%}'.replace(',', ' '))
        f = lambda a, b: f'{R[(a, sc)]["prof"] - R[(b, sc)]["prof"]:+,.0f}'.replace(',', ' ')
        print(f'   В1-В2 {f("В1","В2")}  В1б-В2 {f("В1б","В2")}  В1-В1б (дорогой клик) {f("В1","В1б")}  В1-В0 {f("В1","В0")}  В2-В0 {f("В2","В0")}')
    print('\nпороги эластичности (остальное - средний сценарий): В1 = В2 при ε', breakeven('В1', 'В2'),
          '; В1б = В2 при ε', breakeven('В1б', 'В2'), '; В1б = В0 при ε', breakeven('В1б', 'В0'))
    print('\nартикулы В1 (заказов/нед за 4 недели, Δ прибыли за 2 нед по сценариям):')
    PA = per_article()
    for x in PA:
        print(f'  {x["art"]:20} {x["u_wk"]:4.2f}/нед  {x["p0"]:8,.0f} -{x["step"]}% -> {x["p1"]:8,.0f}  витрина {x["vit0"]:7,.0f}->{x["vit1"]:7,.0f}  '
              f'приб/заказ {x["pi0"]:7,.0f}->{x["pi1"]:7,.0f}  нужно +{x["need"]:.0%}  Δ {x["d_низкий"]:+8,.0f} {x["d_средний"]:+8,.0f} {x["d_высокий"]:+8,.0f}'.replace(',', ' '))
    print('  итого по 26 (только цена):', {sc: round(sum(x['d_' + sc] for x in PA)) for sc in SCN},
          '; без заказов за 4 недели:', sum(1 for x in PA if not x['u_wk']))
    CA = cpo_articles()
    print('\nВ2 по артикулам (средний сценарий): доплата ставки за 2 нед', round(sum(x['extra'] for x in CA)), '; Δ прибыли', round(sum(x['d'] for x in CA)))
    for x in CA[:10]: print(f'  {x["art"]:20} {x["u_wk"]:4.2f}/нед  доплата {x["extra"]:8,.0f}  Δ {x["d"]:+8,.0f}'.replace(',', ' '))
    json.dump(dict(R={f'{v}|{sc}': x for (v, sc), x in R.items()}, PA=PA, CA=CA, SH=SH, clk0=clk0, cpo_sp=cpo_sp, rev=rev,
                   cov_u=cov_u, n_units=sum(U_all.values()),
                   cand=[dict(cid=c, off=camp[c]['off'], active=active(camp[c]), last=camp[c]['last'], w=camp[c]['sp'] / WEEKS,
                              o=camp[c]['o'] / WEEKS, pi=camp_pi(camp[c])[0], sel=c in SEL) for c in CAND],
                   be=dict(v1_v2=breakeven('В1', 'В2'), v1b_v2=breakeven('В1б', 'В2'), v1b_v0=breakeven('В1б', 'В0'))),
              open('/tmp/ozon-v5/forecast.json', 'w'), ensure_ascii=False, indent=1)
