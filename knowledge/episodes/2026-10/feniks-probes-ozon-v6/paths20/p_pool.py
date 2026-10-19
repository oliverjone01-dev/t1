# ФЕНИКС 14.10, записка итерации 2: клик «на 100 товаров» больше пула теста 1 (23 товара, итоги тестов :78).
# Вариант А и «без пути 1» с кликом только на 23 товара пула; зеркала к уровню июля-августа (как рычаг 3 прогноза v6).
import os, sys, io, contextlib
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'iter2'))
with contextlib.redirect_stdout(io.StringIO()):
    from replica2 import SC, N0, U0, P0
CLK_ITEM, P_CLK, MIR_P, UM = 1500 * 4.35, 57000, 3370310 / 60, 2.1 * 30.4 / 23 * 0.5
def kvnet(st, N, u, clk):
    m = 1 - st['comm'] - st['logi'] - st['acq'] - st['sto'] - st['oth'] - st['cpo']
    kv = N * m - clk; ad = N * st['cpo'] + clk
    return kv, kv - st['cc'] * N - (st['ship'] - st['dinc']) * u - 0.3 * (kv + 0.86 * ad + st['b'] * N) - 0.15 * st['real'] * N
for name, du, dN, dc in [
        ('А, клик 100 (как в записке)', 310 + 100 * UM, 310 * P0 + 100 * UM * P_CLK, 100 * CLK_ITEM - 250000),
        ('А, клик только на 23 товара пула', 310 + 23 * UM, 310 * P0 + 23 * UM * P_CLK, 23 * CLK_ITEM - 250000),
        ('без пути 1: клик 100 + зеркала к июню (как в записке)', 100 * UM + 113, 100 * UM * P_CLK + 113 * MIR_P, 100 * CLK_ITEM - 250000),
        ('без пути 1: клик 23 + зеркала к июлю-августу (+63)', 23 * UM + 63, 23 * UM * P_CLK + 63 * MIR_P, 23 * CLK_ITEM - 250000)]:
    r = [kvnet(SC[k], N0 + dN, U0 + du, SC[k]['clk'] * N0 + dc) for k in ('mid', 'high')]
    print(f'{name:55s} КВ {r[0][0]/1e6:.1f} / {r[1][0]/1e6:.1f}, чистая {r[0][1]/1e6:+.2f} / {r[1][1]/1e6:+.2f}')
# комиссия октября (50,8%) против опорной (47,8%) при обороте варианта А 53 млн: «К выплате» меньше на
print(f'комиссия +3,0 п. при 53 млн: К выплате -{0.030 * 53.0:.2f} млн; оборот для 20 млн при m-0,03: {20 / (1 - SC["mid"]["comm"] - 0.030 - SC["mid"]["logi"] - SC["mid"]["acq"] - SC["mid"]["sto"] - SC["mid"]["oth"] - SC["mid"]["cpo"]) :.1f} млн + клик/m')
