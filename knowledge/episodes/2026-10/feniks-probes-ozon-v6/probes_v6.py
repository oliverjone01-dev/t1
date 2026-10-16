# ФЕНИКС 14.10, аудит OZON v6 (прогноз 30 млн): пробы B2, вклад рычагов, безубыточность цены, двойной счёт зеркал,
# максимум оборота при чистой >= 0, доля 26 артикулов и их состав. Запуск: run.sh (FV6 - тексты страницы снимка ветки).
import sys, os, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from replica import month, col, levers, lev_col, full_col, SC, LEV, MON
D = '/home/user/t1/analytics-mvp/data/'
st = month('сентябрь')
base = col(st, st['U0'], st['N0'], st['N0'], st['clk0'])
print(f'[R0] реплика сентября: чистая {base["net"]:,.1f} (Отчет {st["net"]:,.0f}), К выплате {base["kv"]:,.0f}, b {st["b"]:.6f}')
for name, sc in SC.items():
    lv = levers(st, sc); a = lev_col(st, lv); f = full_col(st, lv, sc['R'])
    print(f'[R0] {name}: рычаги {lv["lev"]:,.0f} чистая {a["net"]:,.0f}; 30 млн чистая {f["net"]:,.0f}, реклама {f["ads"]:,.0f}')

print('\n[B2] модель на структуре сентября против факта (оборот, штуки и клик месяца; второй вариант - и ставка за заказ месяца)')
for m in ['июнь', 'июль', 'август']:
    o = month(m)
    p1 = col(st, o['U0'], o['N0'], o['N0'], o['clk_cab'])
    s2 = dict(st); s2['cpo'] = o['cpo']
    p2 = col(s2, o['U0'], o['N0'], o['N0'], o['clk_cab'])
    print(f'  {m}: факт {o["net"]:+,.0f}; модель {p1["net"]:+,.0f} (ошибка {p1["net"]-o["net"]:+,.0f}); с рекламой месяца {p2["net"]:+,.0f} '
          f'(ошибка {p2["net"]-o["net"]:+,.0f}, {(p2["net"]-o["net"])/o["N0"]:+.2%} оборота)')
print('  чистая по месяцам:', [(m, round(month(m)['net'])) for m in MON])
for m in ['июнь', 'июль', 'август', 'сентябрь']:
    o = month(m)
    print(f'  30 млн «всё как в месяце» {m}: {o["net"] * 30e6 / o["N0"]:+,.0f}')
ms = [month(m) for m in ('июль', 'август', 'сентябрь')]
N = sum(o['N0'] for o in ms); net = sum(o['net'] for o in ms)
print(f'  июль-сентябрь: чистая {net/N:+.2%} оборота, 30 млн при этой структуре {net/N*30e6:+,.0f}')

print('\n[L] вклад рычагов в чистую по одному (к сентябрю, база «Отчета»)')
for name, sc in SC.items():
    out = []
    for i in (1, 2, 3):
        lv = levers(st, sc, on=(i,)); out.append(f'рычаг {i}: оборот {lv["sn"]:+,.0f}, чистая {lev_col(st, lv)["net"] - base["net"]:+,.0f}')
    print(' ', name, ' | '.join(out))

def d1(eps, cc26=None):
    sc = dict(SC['mid']); sc['eps'] = eps
    lv = levers(st, sc, on=(1,))
    d = lev_col(st, lv)['net'] - base['net']
    return d + (lv['l1ns'] * (st['cc'] - cc26) if cc26 is not None else 0)
def breakeven(f):
    lo, hi = -20.0, 0.0
    for _ in range(60):
        m = (lo + hi) / 2
        if f(m) > 0: lo = m
        else: hi = m
    return lo
print(f'\n[P1] рычаг 1: безубыточная ε {breakeven(d1):.2f} при средней доле СС 15,7%; {breakeven(lambda e: d1(e, 0.139)):.2f} при доле СС самих 26 (13,9%)')
print('  с долей СС 26: ' + ', '.join(f'ε {e}: {d1(e, 0.139):+,.0f}' for e in (-1, -2, -3.6, -4.3)))

print('\n[DC] двойной счёт зеркал: зеркала рычага 1 внутри возврата к уровню июля-августа')
for name, sc in SC.items():
    lv0, lv1 = levers(st, sc), levers(st, sc, mir_cap=True)
    print(f'  {name}: рычаги {lv0["lev"]:,.0f} -> {lv1["lev"]:,.0f}; 30 млн чистая {full_col(st, lv0, sc["R"])["net"]:,.0f} -> {full_col(st, lv1, sc["R"])["net"]:,.0f}')

print('\n[MX] максимальный оборот при чистой >= 0 (рычаги + добор кликом с отдачей сценария)')
for name, sc in SC.items():
    lv = levers(st, sc); lo, hi = lv['lev'], 60e6
    for _ in range(80):
        m = (lo + hi) / 2
        if full_col(st, lv, sc['R'], T=m)['net'] >= 0: lo = m
        else: hi = m
    print(f'  {name}: {lo:,.0f} (R {sc["R"]})')

print('\n[S26] доля 26 артикулов, шаг, состав (orders_daily без отмен, сентябрь; sku_taxonomy)')
L26 = ('GGT-35-5-1-100-180 -10, GGM-18-2-2 -10, GGT-03-3-3-E-16080 -10, GGT-12-2 -10, GGM-16-2-3 -10, GGR-11-1 -10, GGT-03-3-3-L-120 -5, '
       'GGT-35-3-3-100-180 -10, GGM-02-1-2 -10, GGL-09-2 -10, GGM-16-1-2 -10, GGM-02-2-1 -10, GGM-01-1 -9, GGK-02-2-2-80 -10, GGT-35-2-2-100-180 -8, '
       'GGL-07-XL-2 -10, GGT-48-5-1-100-180 -10, GGT-48-2-2-100-180 -10, GGM-24-1 -10, GGM-23-3-1 -10, GGT-35-2-3-100-180 -10, GGT-03-3-5-E-16080 -5, '
       'GGM-16-1-3-LED -9, GGT-35-1-3-100-180 -10, GGKP-02-1 -7, GGM-08-3-M -10')   # список из sessions/handoff/2026-10-14-ozon-testy-analiz-v7.md §5
step = {p.strip().rsplit(' ', 1)[0]: -int(p.strip().rsplit(' ', 1)[1]) / 100 for p in L26.split(',')}
tax = json.load(open(D + 'sku_taxonomy.json')); cat = {v['offer']: v['category'] for v in tax.values()}
cogs = json.load(open(D + 'sku_cogs.json'))
rev = collections.Counter(); un = collections.Counter(); cc = collections.Counter(); byo = collections.Counter()
for l in open(D + 'orders_daily.ndjson'):
    r = json.loads(l)
    if r['status'] == 'cancelled': continue
    byo[r['d'][:7]] += r['revenue']
    if not '2026-09-01' <= r['d'] <= '2026-09-30': continue
    rev[r['offer']] += r['revenue']; un[r['offer']] += r['units']; cc[r['offer']] += cogs.get(r['sku'], 0) * r['units']
tot, totu = sum(rev.values()), sum(un.values())
s26 = sum(rev[a] for a in step); u26 = sum(un[a] for a in step)
print(f'  доля оборота {s26/tot:.4f} ({s26:,.0f} из {tot:,.0f}), доля шт {u26/totu:.4f}, шаг {sum(rev[a]*step[a] for a in step)/s26:.4f}')
mir = [a for a in step if cat.get(a) == 'Зеркала']
print(f'  зеркал среди 26: {len(mir)} ({sum(rev[a] for a in mir)/s26:.1%} оборота 26, {sum(un[a] for a in mir)} из {u26} шт)')
c26 = sum(cc[a] for a in step) / s26; crest = (sum(cc.values()) - sum(cc[a] for a in step)) / (tot - s26)
print(f'  доля СС: 26 артикулов {c26:.3f}, остальные {crest:.3f}')
print('  заказы без отмен по месяцам, млн:', {k: round(v / 1e6, 2) for k, v in sorted(byo.items())})
