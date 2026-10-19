# ФЕНИКС проба B2 (OZON v5, три периода): экономика заказа v5 до рекламы и АДМ против «Отчета»: август, сентябрь, 01-10.10.
# Вход: /tmp/feniks-floor/periods_rows.json (p7b_periods.js), floor_rows_patched.json.
import json
P = json.load(open('/tmp/feniks-floor/periods_rows.json'))
fl = {r['sku']: r for r in json.load(open('/tmp/feniks-floor/floor_rows_patched.json'))}
PAY, TAX = 0.914, 0.15
F = lambda v: '{:,.0f}'.format(v).replace(',', ' ')
for per in ('aug', 'sep', 'oct'):
    both = [x for x in P[per] if x['sk'] in fl and x['units'] >= 1]
    rep = sum(x['amt'] + x['adv'] - x['cc'] - (x['ship'] - x['dinc']) - TAX * x['tb'] for x in both)
    mod = sum(x['acc'] * fl[x['sk']]['keep'] - x['cc'] - fl[x['sk']]['shipn'] * x['units'] - TAX * x['acc'] * fl[x['sk']]['s'] * PAY for x in both)
    acc = sum(x['acc'] for x in both); kr = sum(x['amt'] + x['adv'] for x in both) / acc
    km = sum(x['acc'] * fl[x['sk']]['keep'] for x in both) / acc
    print(f'{per}: артикулов {len(both)}, штук {sum(x["units"] for x in both)}; доля К выплате «Отчет» {kr:.3f}, модель {km:.3f}; '
          f'прибыль до рекламы и АДМ: «Отчет» {F(rep)} | модель {F(mod)} | {(mod / rep - 1) * 100:+.1f}%')
