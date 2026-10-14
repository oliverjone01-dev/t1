# ФЕНИКС, итерация 3, проба 5 (R5): мостики раздела 2.4 / выдачи 18.
# (а) буст деньгами реестра 479 145 минус «Скидка за лояльность» 12 597 против поля promo разноски 470 349: где 3 801;
# (б) «те же удержания»: акт (показы, полки, баннеры + подписка) против реестра «Удержание» без услуги - по месяцам и кабинетам, и чем ещё являются строки без услуги;
# (в) маржа в деньгах на доставленную единицу мебели (для пробы 6: точка безубыточности П5).
# Только чтение analytics-mvp/data-ym. Запуск: python3 -I feniks_iter3_5_margin_bridge.py
import json, collections
D = '/home/user/t1/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); pnl = rd('pnl_sku_netting_daily.ndjson'); svc = rd('services_monthly.ndjson')
M = ('2026-07', '2026-08', '2026-09'); B = 'Буст продаж, оплата за продажи'
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
# (а)
bm = collections.defaultdict(float); loy = collections.defaultdict(float); loy_types = collections.Counter(); promo = collections.defaultdict(float)
for r in n:
    if r['d'][:7] not in M:
        continue
    if r['service'] == B and r['type'] == 'Удержание':
        bm[(r['d'][:7], r['business'])] += abs(r['amount'])
    if r['service'] == 'Скидка за лояльность':
        loy_types[(r['type'], r['src'])] += 1
        if r['type'] == 'Начисление':
            loy[(r['d'][:7], r['business'])] += r['amount']
for r in pnl:
    if r['d'][:7] in M and r['basis'] == 'netting':
        promo[(r['d'][:7], r['business'])] += -r['promo']
print('(а) строки «Скидка за лояльность» в реестре квартала по (тип, источник):', dict(loy_types))
print('месяц | кабинет | буст деньгами реестра | лояльность | реестр - лояльность | promo разноски | разница')
T = [0, 0, 0]
for k in sorted(set(bm) | set(promo)):
    d = bm[k] - loy[k] - promo[k]; T[0] += bm[k]; T[1] += loy[k]; T[2] += promo[k]
    print(f'  {k[0]} | {CAB[k[1]]} | {bm[k]:,.0f} | {loy[k]:,.0f} | {bm[k] - loy[k]:,.0f} | {promo[k]:,.0f} | {d:,.0f}')
print(f'  итого | {T[0]:,.0f} | {T[1]:,.0f} | {T[0] - T[1]:,.0f} | {T[2]:,.0f} | {T[0] - T[1] - T[2]:,.0f}')
# буст деньгами без SKU или с SKU, которого нет в разноске
skus = {(r['business'], r['sku']) for r in pnl if r['d'][:7] in M}
nosku = sum(abs(r['amount']) for r in n if r['d'][:7] in M and r['service'] == B and r['type'] == 'Удержание' and (not r['sku'] or (r['business'], r['sku']) not in skus))
print('   буст деньгами без SKU или с SKU вне разноски квартала:', f'{nosku:,.0f}')
# (б)
act = collections.defaultdict(float)
for r in svc:
    if r['ym'] in M and r['service'] in ('Буст продаж с оплатой за показы', 'Полка', 'Товарные баннеры', 'Подписка'):
        act[(r['ym'], r['business'])] += r['money']
reg = collections.defaultdict(float); srcs = collections.Counter()
for r in n:
    if r['d'][:7] in M and r['type'] == 'Удержание' and r['service'] == '':
        reg[(r['d'][:7], r['business'])] += abs(r['amount']); srcs[r['src']] += abs(r['amount'])
print('(б) реестр «Удержание» без услуги по источнику:', {k: round(v) for k, v in srcs.items()})
print('месяц | кабинет | акт (показы, полки, баннеры, подписка) | реестр без услуги | разница')
for k in sorted(set(act) | set(reg)):
    print(f'  {k[0]} | {CAB[k[1]]} | {act[k]:,.0f} | {reg[k]:,.0f} | {reg[k] - act[k]:,.0f}')
print(f'  итого | {sum(act.values()):,.0f} | {sum(reg.values()):,.0f} | {sum(reg.values()) - sum(act.values()):,.0f}')
# (в)
fu = collections.defaultdict(float)
for r in pnl:
    if r['d'][:7] in M and r['basis'] == 'netting' and r['business'] == '74986385':
        for f in ('units', 'accruals', 'amount', 'cogs', 'promo'):
            fu[f] += r[f]
print(f"(в) мебель, квартал: единиц {fu['units']:.0f}, деньги покупателя {fu['accruals']:,.0f}, к выплате {fu['amount']:,.0f}, себестоимость {fu['cogs']:,.0f};"
      f" маржа в деньгах {fu['amount'] - fu['cogs']:,.0f}, на единицу {(fu['amount'] - fu['cogs']) / fu['units']:,.0f}; буст деньгами (promo) на единицу {-fu['promo'] / fu['units']:,.0f}")
