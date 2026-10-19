# ФЕНИКС 14.10, предпроверка записки «К выплате 20 млн»: независимый пересчёт путей по текстам страницы (не копия долей),
# весенние факты (штуки, зеркала, клик, себестоимость на штуку) и чувствительность путей 1б / 1 / А / 2 к ним.
# FV6=<каталог rp_2026-03..10.txt> python3 -I -B p_paths.py
import os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'iter2'))
from replica2 import SC, T3, T4, U, g, N0, U0, P0
MON = ['март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь']
S = os.environ.get('FV6', '/tmp/feniks-v6/branch/')
mir = []
for k in range(3, 10):
    t = open(os.path.join(S, f'rp_2026-{k:02d}.txt'), encoding='utf-8').read()
    mir.append(int(re.search(r'\nЗеркала\n[\d\s]+ ₽\n.*\nреализовано (\d+) шт', t).group(1)))
print('шт по месяцам', dict(zip(MON, U)), '; зеркала', dict(zip(MON, mir)))
spring = range(0, 4)
Ns = sum(g('Начислено (оборот)', j) for j in spring); Us = sum(U[j] for j in spring)
ccs = sum(g('СС произв.', j) for j in spring); clks = sum(T4['за клик'][j] for j in spring) / 4
print(f'март-июнь: оборот на 1 шт {Ns/Us:,.0f}; СС на 1 шт {ccs/Us:,.0f} ({ccs/Ns:.3f} оборота); клик в месяц в среднем {clks:,.0f} '
      f'(доля {sum(T4["за клик"][j] for j in spring)/Ns:.3f}); сентябрь: СС на 1 шт {g("СС произв.", 6)/U0:,.0f}, клик {T4["за клик"][6]:,.0f}')
def pl(st, N, u, clk, cc_abs=None):
    m = 1 - st['comm'] - st['logi'] - st['acq'] - st['sto'] - st['oth'] - st['cpo']
    kv = N * m - clk; ad = N * st['cpo'] + clk
    cc = st['cc'] * N if cc_abs is None else cc_abs
    net = kv - cc - (st['ship'] - st['dinc']) * u - 0.3 * (kv + 0.86 * ad + st['b'] * N) - 0.15 * st['real'] * N
    return kv, net, ad / N
CLK_ITEM, P_CLK = 1500 * 4.35, 57000
U_LOW, U_MID, U_HIGH = 2.1 * 0.3 * 30.4 / 23, 2.1 * 0.5 * 30.4 / 23, 2.1 * 30.4 / 23
P_SPR = Ns / Us
PATHS = {
    '0 сейчас': (0, 0, 0, None),
    '1 весна 581 шт по цене сентября': (310, 310 * P0, 0, None),
    '1б весна 581 шт по цене весны': (310, 581 * P_SPR - N0, 0, None),
    '1б, СС на штуку весны': (310, 581 * P_SPR - N0, 0, 'spr'),
    '1б, СС весны и клик весны': (310, 581 * P_SPR - N0, clks, 'spr'),
    '1, клик весны': (310, 310 * P0, clks, None),
    '2 клик 300 (средн.)': (300 * U_MID, 300 * U_MID * P_CLK, 300 * CLK_ITEM, None),
    '2 клик 300 (низк., x0,3)': (300 * U_LOW, 300 * U_LOW * P_CLK, 300 * CLK_ITEM, None),
    'А: 1 + клик 100 + срез 0,3': (310 + 100 * U_MID, 310 * P0 + 100 * U_MID * P_CLK, 100 * CLK_ITEM - 300000, None),
    'А, клик весны вместо среза': (310 + 100 * U_MID, 310 * P0 + 100 * U_MID * P_CLK, 100 * CLK_ITEM + clks, None),
    'А2: 1б + клик 100 + срез 0,3': (310 + 100 * U_MID, 581 * P_SPR - N0 + 100 * U_MID * P_CLK, 100 * CLK_ITEM - 300000, None),
    'А2, СС весны': (310 + 100 * U_MID, 581 * P_SPR - N0 + 100 * U_MID * P_CLK, 100 * CLK_ITEM - 300000, 'spr'),
    'В: клик 400 (верх) + срез 0,3': (400 * U_HIGH, 400 * U_HIGH * P_CLK, 400 * CLK_ITEM - 300000, None),
}
for name, (du, dN, dc, ccm) in PATHS.items():
    out = []
    for key, lab in (('mid', 'средн'), ('high', 'сент')):
        st = SC[key]
        if ccm == 'spr':   # штуки весны со своей себестоимостью на штуку, рост клика - отдельно
            cc_abs = st['cc'] * N0 + (ccs / Us) * 581 - st['cc'] * N0 * 0 - (st['cc'] * N0) + (st['cc'] * N0)
            cc_abs = (ccs / Us) * 581
        else:
            cc_abs = None
        kv, net, ads = pl(st, N0 + dN, U0 + du, st['clk'] * N0 + dc, cc_abs)
        out.append(f'{lab}: КВ {kv/1e6:5.1f} чистая {net/1e6:+.2f} реклама {ads*100:.1f}%')
    print(f'{name:36s} оборот {(N0 + dN)/1e6:5.1f} шт {U0 + du:5.0f} | ' + ' | '.join(out))
for R in (1.24, 2.56, 2.85):
    print('R', R, {k: round(R * (1 - s['comm'] - s['logi'] - s['acq'] - s['sto'] - s['oth'] - s['cpo']) - 1, 3) for k, s in SC.items()},
          'порог R для К выплате:', {k: round(1 / (1 - s['comm'] - s['logi'] - s['acq'] - s['sto'] - s['oth'] - s['cpo']), 2) for k, s in SC.items()})
