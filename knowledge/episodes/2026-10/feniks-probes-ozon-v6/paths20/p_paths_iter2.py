# ФЕНИКС 14.10, записка «К выплате 20 млн», итерация 2: независимый пересчёт новых строк по текстам страницы (доли - не копия),
# клик весны ЗАМЕНЯЕТ базовый клик (моя ошибка предпроверки: p_paths.py прибавлял его к базе), себестоимость штуки весны.
# Плюс темп пяти дорогих кампаний за 01-11.10 и за последние 7 дней. FV6=<каталог rp_2026-03..10.txt> python3 -I -B p_paths_iter2.py
import os, sys, io, json, contextlib, collections
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'iter2'))
with contextlib.redirect_stdout(io.StringIO()):
    from replica2 import SC, T4, U, g, N0, U0, P0
CLK_ITEM, P_CLK, MIR_P = 1500 * 4.35, 57000, 3370310 / 60
U2 = {'x0,3': 2.1 * 30.4 / 23 * 0.3, 'средн': 2.1 * 30.4 / 23 * 0.5, 'верх': 2.1 * 30.4 / 23}
Ns = sum(g('Начислено (оборот)', j) for j in range(4)); Us = sum(U[j] for j in range(4))
CCU = sum(g('СС произв.', j) for j in range(4)) / Us; CLKS = sum(T4['за клик'][j] for j in range(4)) / 4
def pl(st, N, u, clk, cc=None):
    m = 1 - st['comm'] - st['logi'] - st['acq'] - st['sto'] - st['oth'] - st['cpo']
    kv = N * m - clk; ad = N * st['cpo'] + clk
    cc = st['cc'] * N if cc is None else cc
    return kv, kv - cc - (st['ship'] - st['dinc']) * u - 0.3 * (kv + 0.86 * ad + st['b'] * N) - 0.15 * st['real'] * N, ad / N
def row(name, du, dN, dclk, spr=False, ccs=False):
    out = []
    for key, lab in (('mid', 'средн'), ('high', 'сент')):
        st = SC[key]
        clk = (CLKS if spr else st['clk'] * N0) + dclk
        cc = CCU * (U0 + du) if ccs else None
        kv, net, ads = pl(st, N0 + dN, U0 + du, clk, cc)
        out.append(f'{lab}: КВ {kv/1e6:5.1f} чистая {net/1e6:+.2f} реклама {ads*100:.1f}%')
    print(f'{name:44s} оборот {(N0+dN)/1e6:5.1f} шт {U0+du:5.0f} | ' + ' | '.join(out))
row('1 весна 581, цена сент., клик весны', 310, 310 * P0, 0, spr=True)
row('1а 469, цена сент., клик весны', 198, 198 * P0, 0, spr=True)
row('1б 581, цена и СС весны, клик весны', 310, 581 * Ns / Us - N0, 0, spr=True, ccs=True)
row('4 срез 0,25 без KUVINO', 0, 0, -250000)
row('А клик как сейчас (срез 0,25)', 310 + 100 * U2['средн'], 310 * P0 + 100 * U2['средн'] * P_CLK, 100 * CLK_ITEM - 250000)
row('А клик весны (срез 0,25)', 310 + 100 * U2['средн'], 310 * P0 + 100 * U2['средн'] * P_CLK, 100 * CLK_ITEM - 250000, spr=True)
row('А2 1б + клик 100 + срез 0,25', 310 + 100 * U2['средн'], 581 * Ns / Us - N0 + 100 * U2['средн'] * P_CLK, 100 * CLK_ITEM - 250000, spr=True, ccs=True)
for k, u in U2.items():
    row(f'В клик 400 ({k}) + срез 0,25', 400 * u, 400 * u * P_CLK, 400 * CLK_ITEM - 250000)
row('без пути 1: клик 100 + зеркала (+113) + срез', 100 * U2['средн'] + 113, 100 * U2['средн'] * P_CLK + 113 * MIR_P, 100 * CLK_ITEM - 250000)
row('без пути 1, зеркала к июлю-августу (+63)', 100 * U2['средн'] + 63, 100 * U2['средн'] * P_CLK + 63 * MIR_P, 100 * CLK_ITEM - 250000)
print(f'весна: оборот на шт {Ns/Us:,.0f}, СС на шт {CCU:,.0f}, клик в месяц {CLKS:,.0f}; апрель: оборот на шт {g("Начислено (оборот)", 1)/U[1]:,.0f}')
D = '/home/user/t1/analytics-mvp/data/'
IDS = ('40015169', '40047060', '37676554', '37675958', '39931246')
sp = collections.Counter(); sp7 = collections.Counter()
for l in open(D + 'ads_daily.ndjson'):
    r = json.loads(l)
    if r['id'] in IDS and '2026-10-01' <= r['d'] <= '2026-10-11': sp[r['id']] += r.get('sp') or 0
    if r['id'] in IDS and '2026-10-05' <= r['d'] <= '2026-10-11': sp7[r['id']] += r.get('sp') or 0
print(f'темп пяти кампаний: 01-11.10 {sum(sp.values())/11*30.4:,.0f} в месяц; 05-11.10 {sum(sp7.values())/7*30.4:,.0f} в месяц')
