# ФЕНИКС iter2, проба X4b: деньги волны 2 в Excel против переноса теста 1 (sessions/2026-10-12-ozon-testy-itogi.md:27, :78)
import re
L = open('/home/user/t1/sessions/2026-10-12-ozon-testy-itogi.md', encoding='utf-8').read().splitlines()
row = L[26]; print('itogi.md:27 ->', row[:120])
otchet = 35.0; nalog = 132.0                     # «Как в Отчете» и «После налога», 7 тестовых товаров, 23 дня, за вычетом клика 26 594
print('itogi.md:78 ->', re.search(r'Ожидание:[^\[]+', L[77]).group(0)[:200])
NW = 6; days = 28
k = NW / 7 * days / 23                           # перенос на товар-день
print(f'перенос 6 товаров x 28 дней = {k:.3f} теста 1')
print(f'  база «Отчета» (с АДМ): x0,3 = +{0.3 * otchet * k:.1f}, x1 = +{otchet * k:.1f}')
print(f'  база «после налога» (без АДМ, как итог «Коротко»): x0,3 = +{0.3 * nalog * k:.1f}, x1 = +{nalog * k:.1f}')
print(f'Excel (plan7_xlsx.py:84): W_LO = 10*6/20 = {10 * NW / 20:.1f}, W_HI = 35*6/20 = {35 * NW / 20:.1f}')
print(f'в itogi.md:78 «+10» = 35 x 0,3 на 7 товаров и 23 дня, «+35» = то же на 20 товаров и 28 дней: 10,5 x 20/7 x 28/23 = {10.5 * 20 / 7 * 28 / 23:.1f}')
print('отношение баз в «Прогнозе» (средне): без АДМ 85 / с АДМ 22 =', round(85 / 22, 2), '| в itogi.md:27: 132 / 35 =', round(132 / 35, 2))
