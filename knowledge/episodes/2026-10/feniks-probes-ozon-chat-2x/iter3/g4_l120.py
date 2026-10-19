# ФЕНИКС iter3, @ 754cf5c. База TRUBIS L120 14.09-11.10: план (Excel 15.10, u_wk_base 3.5 x 4 = 14) против
# пересчёта по дню UTC и МСК, с отменами и без; какие заказы дают разницу. python3 -I g4_l120.py
import json, datetime as dt

DD = '/home/user/t1/analytics-mvp/data/'
MSK = dt.timezone(dt.timedelta(hours=3))
od = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
groups = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
plan = json.load(open(DD + 'plan_2026-10-15.json', encoding='utf-8'))
off2sku = {s['offer']: str(s['sku']) for g in groups for s in g['skus']}
c = next(c for c in plan['cards'] if c['short'] == 'TRUBIS L120')
m0 = off2sku[c['main_art']]
ss = {str(s['sku']) for g in groups if any(str(s['sku']) == m0 for s in g['skus']) for s in g['skus']}
msk = lambda o: dt.datetime.fromisoformat(o['t'].replace('Z', '+00:00')).astimezone(MSK).date().isoformat()
rows = [o for o in od if str(o.get('sku')) in ss]
for name, day in (('UTC', lambda o: o['d']), ('МСК', msk)):
    w = [o for o in rows if '2026-09-14' <= day(o) <= '2026-10-11']
    print(name, 'с отменами', sum(int(o['units']) for o in w), '| без отмен', sum(int(o['units']) for o in w if o['status'] != 'cancelled'))
edge = [o for o in rows if ('2026-09-14' <= o['d'] <= '2026-10-11') != ('2026-09-14' <= msk(o) <= '2026-10-11')]
print('на границе окна:', [(o['d'], o['t'], o['status'], o['units']) for o in edge])
print('план: u_wk_base', c['u_wk_base'], 'x4 =', c['u_wk_base'] * 4, 'порог', c['threshold'])
