# ФЕНИКС проба P22: числа модели, ушедшие в стратегию v3 (sessions/2026-10-12-ozon-strategiya-magazin.md:23, make2.js:33):
# «у 28 продающихся товаров есть запас снизить цену при рентабельности 10%; при -10% нужно +22...+47% заказов, середина +28%».
# Сначала воспроизводим их на floor_rows.json @ e4988f5, затем те же числа на исправленной модели (P20).
import json, statistics as S
def calc(rows, CPO, PAY, admfix):
    sel = [r for r in rows if r['wk'] >= 0.5 and r['p_10'] and (1 - r['p_10'] / r['p0']) * 100 >= 5]
    need = []
    for r in sel:
        k = (0.70 * r['keep'] - CPO - 0.15 * r['s'] * PAY) if admfix else (0.70 * (r['keep'] - CPO) - 0.15 * r['s'])
        fx = r['cogs'] + r['shipn']
        pr0 = r['p0'] * k - fx; pr1 = r['p0'] * 0.9 * k - fx
        if pr0 > 0: need.append(pr0 / pr1 - 1 if pr1 > 0 else float('inf'))
    fin = sorted(x for x in need if x != float('inf'))
    q = lambda a, f: a[min(len(a) - 1, int(f * len(a)))]
    return len(sel), fin, q
for lab, path, CPO, PAY, fix in (('модель @ e4988f5', '/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json', 0.05, 1.0, False),
                                ('исправленная (P20)', '/tmp/feniks-floor/floor_rows_patched.json', 0.039, 0.914, True)):
    n, fin, q = calc(json.load(open(path)), CPO, PAY, fix)
    print('[P22] %s: продающихся с запасом до 10%% >= 5%%: %d; рост заказов при -10%%: медиана +%.0f%%, квартили +%.0f%%...+%.0f%%, мин +%.0f%%, макс +%.0f%%' % (
        lab, n, S.median(fin) * 100, q(fin, 0.25) * 100, q(fin, 0.75) * 100, fin[0] * 100, fin[-1] * 100))
