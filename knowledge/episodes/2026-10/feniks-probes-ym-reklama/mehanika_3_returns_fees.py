#!/usr/bin/env python3
"""ФЕНИКС, проба 3: возвраты (раздел 5) и размещение деньгами на 5-1 (Д6). Только чтение.
a) определение возврата: статус, count/delivered/returned; частичные возвраты;
b) «Скидка за лояльность / Возврат списания» по заказу против списаний размещения и буста баллами - чей это возврат;
c) fees заказа против реестра (Комиссия за продажу = Размещение / Удержание?), 5-1 сентябрь-октябрь;
d) доля размещения деньгами по месяцам и SKU мебели: 5-1 особый или весь кабинет в октябре."""
import json, sys, collections
D = (sys.argv[1] if len(sys.argv) > 1 else '/home/user/t1/analytics-mvp/data-ym').rstrip('/') + '/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); o = rd('orders.ndjson')
BOOST = 'Буст продаж, оплата за продажи'; PL = 'Размещение товарных предложений'; LOY = 'Скидка за лояльность'
p = [r for r in o if not r['service']]
byo = collections.defaultdict(lambda: collections.defaultdict(float))
for r in n:
    if r['order']: byo[r['order']][(r['service'] if r['service'] in (BOOST, PL, LOY) else 'x', r['type'])] += r['amount']
ret = [r for r in p if r.get('returned') or r['status'] == 'RETURNED']
print('## a) возвраты: позиций', len(ret), 'заказов', len({r['order'] for r in ret}))
print('  (статус, count, delivered, returned, cancelled):', dict(collections.Counter((r['status'], r['count'], r['delivered'], r['returned'], r['cancelled']) for r in ret)))
part = [r for r in ret if r['returned'] and r['returned'] < r['count']]
print('  частичные (returned < count):', [(r['order'], r['sku'], r['count'], r['returned']) for r in part])
multi_pos = collections.Counter(r['order'] for r in p if r['order'] in {x['order'] for x in ret})
print('  возвращённые заказы с 2+ позициями:', {k: v for k, v in multi_pos.items() if v > 1})
print('\n## b) Возврат списания «Скидка за лояльность» против списаний баллами по заказу')
lo = {k for k, v in byo.items() if v.get((LOY, 'Возврат списания'))}
retset = {r['order'] for r in ret}
m = collections.Counter()
for k in sorted(lo):
    v = byo[k]; lr = v[(LOY, 'Возврат списания')]; ps = -v.get((PL, 'Списание'), 0); bs = -v.get((BOOST, 'Списание'), 0)
    tag = 'размещение' if abs(lr - ps) < 1 else 'размещение+буст' if abs(lr - ps - bs) < 1 else 'буст' if abs(lr - bs) < 1 else 'другое'
    m[(tag, k in retset)] += 1
    if tag != 'размещение': print(f"   {k} возвращён={k in retset} возврат_списания={lr:.2f} размещение_баллы={ps:.2f} буст_баллы={bs:.2f} размещение_деньги={-v.get((PL, 'Удержание'), 0):.2f} -> {tag}")
print('  итог сопоставления (тег, заказ возвращён):', dict(m))
print('  буст по заказам с возвратом списания: баллы', f"{sum(-byo[k].get((BOOST, 'Списание'), 0) for k in lo):,.0f}", 'деньги', f"{sum(-byo[k].get((BOOST, 'Удержание'), 0) for k in lo):,.0f}")
print('\n## c) 5-1: fees заказа против реестра (сентябрь-октябрь, доставленные)')
for r in sorted([r for r in p if r['sku'] == 'GGT-35-5-1-100-180' and r['status'] == 'DELIVERED' and r['created'] >= '2026-09-01'], key=lambda r: r['created']):
    v = byo[r['order']]
    print(f"   {r['created']} {r['order']} price={r['price']} acc={r['accruals']} fees={r['fees']} fee_total={r['fee_total']} payout={r['payout']} fee_actual={r.get('fee_actual')} | реестр: размещение деньги={-v.get((PL, 'Удержание'), 0):.0f} баллы={-v.get((PL, 'Списание'), 0):.0f}; буст деньги={-v.get((BOOST, 'Удержание'), 0):.0f} баллы={-v.get((BOOST, 'Списание'), 0):.0f}; acc-fee_total-payout={r['accruals'] - r['fee_total'] - r['payout']:.2f}")
print('\n## d) мебель, доставленные: доля размещения деньгами по месяцу создания; октябрь по SKU')
agg = collections.defaultdict(lambda: [0.0, 0.0, 0]); sk = collections.defaultdict(lambda: [0.0, 0.0, 0])
seen = set()
for r in p:
    if r['business'] != '74986385' or r['status'] != 'DELIVERED' or r['order'] in seen: continue
    seen.add(r['order']); v = byo[r['order']]; mo = r['created'][:7]
    a = agg[mo]; a[0] += -v.get((PL, 'Удержание'), 0); a[1] += -v.get((PL, 'Списание'), 0); a[2] += 1
    if mo == '2026-10': s = sk[r['sku']]; s[0] += -v.get((PL, 'Удержание'), 0); s[1] += -v.get((PL, 'Списание'), 0); s[2] += 1
for mo in sorted(agg):
    if mo >= '2026-06': a = agg[mo]; print(f"  {mo}: заказов {a[2]}, размещение деньгами {a[0]:,.0f}, баллами {a[1]:,.0f}, доля денег {a[0] / (a[0] + a[1]) if a[0] + a[1] else 0:.1%}")
for s, a in sorted(sk.items(), key=lambda x: -x[1][0]): print(f"   октябрь {s}: заказов {a[2]}, деньгами {a[0]:,.0f}, баллами {a[1]:,.0f}")
