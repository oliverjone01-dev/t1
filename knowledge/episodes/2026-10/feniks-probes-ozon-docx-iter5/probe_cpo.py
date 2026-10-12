"""Проба K10 «показы магазина покупаем ставкой за заказ»: выключение 28.08-03.09.
Считает по дням: показы в поиске магазина (sku_views.vsearch), расход ставки за заказ
(ads_daily, кампании «все товары»), расход за клик (остальные кампании ads_daily),
заказы без отмен (orders_daily, units)."""
import json, sys, collections
D = '/home/user/t1/analytics-mvp/data/'
lo, hi = '2026-08-14', '2026-09-20'
vs = collections.Counter(); vw = collections.Counter(); pdp = collections.Counter()
with open(D + 'sku_views.ndjson') as f:
    for line in f:
        r = json.loads(line)
        d = r['date']
        if lo <= d <= hi:
            vs[d] += r.get('vsearch') or 0
            vw[d] += r.get('views') or 0
            pdp[d] += r.get('pdp') or 0
cpo = collections.Counter(); cpo_o = collections.Counter(); srch = collections.Counter(); cpc = collections.Counter()
names = collections.Counter()
with open(D + 'ads_daily.ndjson') as f:
    for line in f:
        r = json.loads(line)
        d = r['d']
        if not (lo <= d <= hi):
            continue
        off = r.get('off') or ''
        if off.startswith('Оплата за заказ'):
            cpo[d] += r['sp']; cpo_o[d] += r.get('o') or 0
        elif off.startswith('Продвижение в поиске'):
            srch[d] += r['sp']
        else:
            cpc[d] += r['sp']
ords = collections.Counter(); ords_all = collections.Counter(); rev = collections.Counter()
with open(D + 'orders_daily.ndjson') as f:
    for line in f:
        r = json.loads(line)
        d = r['d']
        if lo <= d <= hi:
            ords_all[d] += r.get('units') or 0
            if r.get('status') != 'cancelled':
                ords[d] += r.get('units') or 0
                rev[d] += r.get('revenue') or 0
print('date       vsearch   views   pdp  cpo_sp  cpo_o srch_sp  cpc_sp  orders(no canc) all')
days = sorted(set(vs) | set(cpo) | set(cpc) | set(ords))
for d in days:
    print(f"{d} {vs[d]:8d} {vw[d]:7d} {pdp[d]:5d} {cpo[d]:7.0f} {cpo_o[d]:5d} {srch[d]:7.0f} {cpc[d]:7.0f} {ords[d]:5d} {ords_all[d]:5d}")

def avg(c, a, b):
    ds = [d for d in days if a <= d <= b]
    return sum(c[d] for d in ds) / len(ds), len(ds)
for lab, a, b in [('до 14-27.08', '2026-08-14', '2026-08-27'), ('выкл 28.08-03.09', '2026-08-28', '2026-09-03'), ('после 04-17.09', '2026-09-04', '2026-09-17')]:
    print(lab, 'vsearch %.0f' % avg(vs, a, b)[0], 'pdp %.0f' % avg(pdp, a, b)[0], 'cpo %.0f' % avg(cpo, a, b)[0], 'cpc %.0f' % avg(cpc, a, b)[0], 'orders %.2f' % avg(ords, a, b)[0], 'n', avg(vs, a, b)[1])
