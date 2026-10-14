# ФЕНИКС 14.10, предпроверка «К выплате 20 млн»: вариант В без верхней границы (средн. и x0,3), А2 с себестоимостью штуки весны
# (зеркала и мебель весны) плюс клик-товары по доле структуры; путь 4 по темпу последних 7 дней.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'iter2'))
import io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    from replica2 import SC, T4, U, g, N0, U0, P0
CLK_ITEM, P_CLK = 1500 * 4.35, 57000
U_LOW, U_MID, U_HIGH = 2.1 * 0.3 * 30.4 / 23, 2.1 * 0.5 * 30.4 / 23, 2.1 * 30.4 / 23
Ns = sum(g('Начислено (оборот)', j) for j in range(4)); Us = sum(U[j] for j in range(4)); CCU = sum(g('СС произв.', j) for j in range(4)) / Us
def pl(st, N, u, clk, cc=None):
    m = 1 - st['comm'] - st['logi'] - st['acq'] - st['sto'] - st['oth'] - st['cpo']
    kv = N * m - clk; ad = N * st['cpo'] + clk
    cc = st['cc'] * N if cc is None else cc
    return kv, kv - cc - (st['ship'] - st['dinc']) * u - 0.3 * (kv + 0.86 * ad + st['b'] * N) - 0.15 * st['real'] * N, ad / N
for lab, uu in (('В средн.', U_MID), ('В низк. x0,3', U_LOW)):
    du, dN, dc = 400 * uu, 400 * uu * P_CLK, 400 * CLK_ITEM - 300000
    print(lab, ' | '.join(f'{k}: КВ {pl(SC[k], N0 + dN, U0 + du, SC[k]["clk"] * N0 + dc)[0]/1e6:.1f} чистая {pl(SC[k], N0 + dN, U0 + du, SC[k]["clk"] * N0 + dc)[1]/1e6:+.2f}' for k in ('mid', 'high')))
# А2: 581 шт по цене весны с себестоимостью штуки весны + 100 клик-товаров (их себестоимость - доля структуры)
dN_click = 100 * U_MID * P_CLK
for k in ('mid', 'high'):
    st = SC[k]
    cc = CCU * 581 + st['cc'] * dN_click
    kv, net, ads = pl(st, 581 * Ns / Us + dN_click, 581 + 100 * U_MID, st['clk'] * N0 + 100 * CLK_ITEM - 300000, cc)
    print(f'А2 с СС штуки весны ({CCU:,.0f} ₽/шт), {k}: КВ {kv/1e6:.1f} чистая {net/1e6:+.2f}')
# путь 4 по темпу последних 7 дней (p_campaigns.py): 121 087 + 26 290 + 0 + 130 468 + 86 844 в месяц; минимум 8 ₽ и 2 000 ₽/нед = 8 700 в месяц
cur = 121087 + 26290 + 0 + 130468 + 86844
print(f'путь 4: темп пяти кампаний {cur:,.0f} в месяц; срез до минимума {cur - 4 * 8700:,.0f}; без KUVINO {cur - 86844 - 3 * 8700:,.0f}')
