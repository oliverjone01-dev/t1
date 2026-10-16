# ФЕНИКС 14.10, книга вариантов v8: зеркало модели автора (variants.py до блока MIRROR_ONLY, исполняется как есть) и тот же расчёт,
# где отдача клика сверх пула 23 товаров ограничена наблюдаемой верхней границей «Отчета» (по артикулам: авг 1,24 / июль 2,56 / сент 2,85).
# python3 -I -B p_click_cap.py <папка с rp_2026-*.txt> /home/user/t1/analytics-mvp/data
import sys, os
src = open('/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v8/variants.py', encoding='utf-8').read()
cut = src.index("if __name__ == '__main__' and os.environ.get('MIRROR_ONLY')")
sys.argv = ['variants.py', sys.argv[1], sys.argv[2]]
ns = {'__name__': 'feniks_probe', '__file__': '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v8/variants.py'}
exec(compile(src[:cut], 'variants_prefix', 'exec'), ns)
G, T, KS, EPS = ns['grid_m'], ns['TEST1'], ns['KS'], ns['EPS']
WEEKS = ns['WEEKS']; Bp = T['pool'] * T['cw'] * WEEKS
RCAP = {'B': 1.24, 'C': 2.56, 'D': 2.85}
orig = ns['click_units']
def capped(B, k, scen):
    ui = T['u'] * 30.4 / T['days'] * k
    if B <= Bp: return B / (T['cw'] * WEEKS) * ui
    return T['pool'] * ui + (B - Bp) * RCAP[scen] / T['p']      # сверх пула - не больше наблюдаемой отдачи «Отчета»
print(f'бюджет пула {Bp:,.0f} ₽/мес')
for scen in 'CD':
    for B in (250_000, 1_000_000, 2_000_000):
        u = orig(B, KS[scen]); print(f'сценарий {scen}: клик +{B/1e6:.2f} млн - модель {u:.0f} шт, отдача {u * T["p"] / B:.1f} ₽/₽; с ограничением {capped(B, KS[scen], scen) * T["p"] / B:.1f} ₽/₽')
def run(cap):
    if cap:
        ns['click_units'] = lambda B, k: capped(B, k, {v: kk for kk, v in KS.items()}[k])
    else:
        ns['click_units'] = orig
    out = {}
    for sc in 'BC':
        for scen in 'BCD':
            for d in ns['DLIST']:
                for B in ns['BLIST']:
                    out[(sc, scen, d, B)] = G(sc, scen, d, B)
    return out
A, Cp = run(False), run(True)
for key in [('B', 'C', 0.20, 2_000_000), ('C', 'C', 0.20, 2_000_000), ('B', 'C', 0.0, 250_000), ('B', 'C', 0.0, 2_000_000)]:
    print(key, f'К выплате {A[key]["kv"]/1e6:.2f} -> {Cp[key]["kv"]/1e6:.2f}; чистая {A[key]["net"]/1e6:+.2f} -> {Cp[key]["net"]/1e6:+.2f}')
for sc in 'BC':
    n0 = sum(1 for k, v in A.items() if k[0] == sc and k[1] == 'D' and v['kv'] >= 20e6)
    n1 = sum(1 for k, v in Cp.items() if k[0] == sc and k[1] == 'D' and v['kv'] >= 20e6)
    mx = max((v['kv'], k) for k, v in Cp.items() if k[0] == sc and k[1] == 'D')
    print(f'структура {sc}, высокий: вариантов с К выплате >= 20 млн - модель {n0}, с ограничением {n1}; максимум с ограничением {mx[0]/1e6:.2f} млн {mx[1][2:]}')
