#!/usr/bin/env python3
"""ФЕНИКС, проба 1 к ym-reklama-mehanika-20261015: «вторая цена» из разброса списаний.
Только чтение analytics-mvp/data-ym. Код автора не импортируется, всё считается заново.
a) пары SKU-день: точные ставки (4 знака), деньги/баллы буста, число проводок, даты проводок, цены;
b) разброс при других базах (p_buyer, accruals, revenue) - есть ли база, при которой разброс исчезает;
c) «круглые» максимумы против «+0,01%»; d) ряд ставок KONUX 5-1; e) П5 при второй цене (6% против 8,8%)."""
import json, sys, collections, statistics
D = (sys.argv[1] if len(sys.argv) > 1 else '/home/user/t1/analytics-mvp/data-ym').rstrip('/') + '/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); o = rd('orders.ndjson')
BOOST = 'Буст продаж, оплата за продажи'
p = [r for r in o if not r['service']]; po = {(r['order'], r['sku']): r for r in p}
money = collections.defaultdict(float); pts = collections.defaultdict(float); cnt = collections.Counter(); dts = collections.defaultdict(set)
for r in n:
    if r['service'] == BOOST:
        k = (r['order'], r['sku'])
        if r['type'] == 'Удержание': money[k] += abs(r['amount'])
        elif r['type'] == 'Списание': pts[k] += abs(r['amount'])
        else: print('ДРУГОЙ ТИП БУСТА', r)
        cnt[k] += 1; dts[k].add(r['d'])
tot = lambda k: money[k] + pts[k]
keys = [k for k in set(money) | set(pts) if k in po and po[k]['price'] and po[k]['status'] == 'DELIVERED' and po[k]['created'][:7] in ('2026-07', '2026-08', '2026-09', '2026-10')]
print('доставленных с бустом июль-октябрь:', len(keys), '; из них count>1:', sum(1 for k in keys if po[k]['count'] > 1))
grp = collections.defaultdict(list)
for k in keys: grp[(po[k]['sku'], po[k]['created'])].append(k)
multi = {g: v for g, v in grp.items() if len(v) >= 2}
print('\n## a) SKU-дни с 2+ заказами:', len(multi))
for g, v in sorted(multi.items(), key=lambda x: x[0][1]):
    print(g[0], g[1])
    for k in sorted(v, key=lambda k: tot(k) / po[k]['price']):
        r = po[k]
        print(f"   {k[0]} cnt={r['count']} price={r['price']} p_buyer={r['p_buyer']} p_mp={r['p_mp']} acc={r['accruals']} rev={r['revenue']} | буст деньги={money[k]:.2f} баллы={pts[k]:.2f} проводок={cnt[k]} даты={sorted(dts[k])} статус-дата={r['statusDate']} | ставка/price={tot(k) / (r['price'] * r['count']):.4%}")
def spread(base):
    out = []
    for g, v in multi.items():
        rs = [tot(k) / base(po[k]) for k in v if base(po[k])]
        if len(rs) >= 2: out.append(max(rs) - min(rs))
    return out
print('\n## b) разброс внутри SKU-дня при разных базах (медиана / максимум / пар > 2 п.п.)')
for nm, bf in (('price*count', lambda r: r['price'] * r['count']), ('p_buyer', lambda r: r['p_buyer']), ('accruals', lambda r: r['accruals']), ('revenue', lambda r: r['revenue']), ('p_mp', lambda r: r['p_mp'])):
    s = spread(bf); print(f"  {nm}: медиана {statistics.median(s):.2%}, максимум {max(s):.2%}, пар > 2 п.п. {sum(1 for x in s if x > 0.02)} из {len(s)}")
print('\n## c) знаки после запятой: ставка в % с 2 знаками, хвост сотых (у «+0,01%» ожидается ...1)')
tails = collections.Counter(); rr = []
for k in keys:
    r = po[k]; x = tot(k) / (r['price'] * r['count']) * 100; rr.append(x); tails[f"{x:.2f}"[-1]] += 1
print('  последняя цифра сотых процента:', dict(sorted(tails.items())), 'всего', len(keys))
print('  доля ставок, кратных 0,1% (|x*10 - round| < 0,02):', f"{sum(1 for x in rr if abs(x * 10 - round(x * 10)) < 0.02) / len(rr):.1%}")
print('\n## d) KONUX 5-1 (GGT-35-5-1-100-180): ряд ставок по дате создания, все доставленные с бустом')
for k in sorted([k for k in keys if k[1] == 'GGT-35-5-1-100-180'], key=lambda k: po[k]['created']):
    r = po[k]; print(f"   {r['created']} {k[0]} price={r['price']} ставка={tot(k) / (r['price'] * r['count']):.3%} деньги={money[k]:.0f} баллы={pts[k]:.0f}")
sep = [tot(k) / (po[k]['price'] * po[k]['count']) for k in keys if k[1] == 'GGT-35-5-1-100-180' and po[k]['created'][:7] == '2026-09']
print('  5-1, заказы сентября: n', len(sep), 'макс', f"{max(sep):.2%}" if sep else '-', 'медиана', f"{statistics.median(sep):.2%}" if sep else '-')
print('\n## e) П5 при второй цене: мебель, заказы сентября, доставленные с бустом (без 5-1)')
K = [k for k in keys if po[k]['business'] == '74986385' and po[k]['created'][:7] == '2026-09' and k[1] != 'GGT-35-5-1-100-180']
C = sum(tot(k) for k in K); B = sum(po[k]['price'] * po[k]['count'] for k in K)
rates = [(tot(k) / (po[k]['price'] * po[k]['count']), tot(k), po[k]['price'] * po[k]['count']) for k in K]
print(f"  заказов {len(K)}, буст {C:,.0f}, база {B:,.0f}, средняя ставка {C / B:.2%}, медиана {statistics.median(x[0] for x in rates):.2%}")
prop = C * (1 - 6 / 8.8)
cap = sum(max(0, c - 0.06 * b) for x, c, b in rates)
lost_c = sum(c for x, c, b in rates if x > 0.0601); lost_n = sum(1 for x, c, b in rates if x > 0.0601)
print(f"  пропорционально (дизайн П5, ×(1-6/8,8)): экономия {prop:,.0f} ({prop / C:.1%})")
print(f"  вторая цена, позиция сохранена (списание = min(ставка, 6%)): экономия {cap:,.0f} ({cap / C:.1%})")
print(f"  вторая цена, позиция потеряна там, где списание было > 6%: списаний не будет {lost_c:,.0f} ({lost_c / C:.1%}), но это {lost_n} из {len(K)} заказов ({lost_n / len(K):.0%})")
print(f"  без изменений (списание было <= 6%): {len(K) - lost_n} заказов, {C - lost_c:,.0f}")
