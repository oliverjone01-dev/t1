# ФЕНИКС, итерация 3, проба 4 (R2): воронка вариантов KONUX 100/180 до и после 01-02.10 (отчёт показов, дневные строки).
# Вопрос: рост 5-1 - добавочный спрос или перетекание с 1-3 (контроль П4). Только чтение. Запуск: python3 -I feniks_iter3_4_konux_funnel.py
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
sv = [json.loads(l) for l in open(D + 'sku_views.ndjson')]
fam = lambda s: s.startswith('GGT-35-') and s.endswith('-100-180')
W = {'pre 13.09-01.10 (19 дн)': ('2026-09-13', '2026-10-01', 19), 'post 02.10-12.10 (11 дн)': ('2026-10-02', '2026-10-12', 11)}
agg = collections.defaultdict(lambda: [0, 0, 0, 0])
for r in sv:
    if r.get('aggregate') or not fam(r['sku']):
        continue
    for lab, (a, z, nd) in W.items():
        if a <= r['date'] <= z:
            x = agg[(r['sku'], lab)]; x[0] += r['views']; x[1] += r['pdp']; x[2] += r['cart']; x[3] += r['units']
print('вариант | окно | показы в день | заходы в день | CTR | корзины в день | единиц в день')
tot = collections.defaultdict(lambda: [0, 0, 0, 0])
for s in sorted({k[0] for k in agg}):
    for lab, (a, z, nd) in W.items():
        x = agg[(s, lab)]
        for i in range(4):
            tot[lab][i] += x[i]
        print(f'  {s} | {lab} | {x[0] / nd:,.0f} | {x[1] / nd:,.0f} | {x[1] / x[0] if x[0] else 0:.1%} | {x[2] / nd:.1f} | {x[3] / nd:.2f}')
for lab, (a, z, nd) in W.items():
    x = tot[lab]
    print(f'  МОДЕЛЬ 100/180 | {lab} | {x[0] / nd:,.0f} | {x[1] / nd:,.0f} | {x[1] / x[0]:.1%} | {x[2] / nd:.1f} | {x[3] / nd:.2f}')
