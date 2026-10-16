# ФЕНИКС iter3, PR #478 @ 528604a. План v2: 27 артикулов выводятся из продажи и убраны из минимального клика,
# пороги карточек оставлены как в Excel (Иван 15.10). Второй порядок: какая доля базы порога (14.09-11.10, без отмен,
# все товары объединённой карточки - как считает страница) приходится на выводимые артикулы. Если товар выведен,
# его заказы в окне 15-28.10 стремятся к нулю, а порог посчитан с ними. python3 -I v2_withdrawn.py
import json, datetime as dt, subprocess

R = '/home/user/t1'
DD = R + '/analytics-mvp/data/'
MSK = dt.timezone(dt.timedelta(hours=3))
v1 = json.loads(subprocess.run(['git', '-C', R, 'show', '528604a:analytics-mvp/data/plan_2026-10-15.json'], capture_output=True, text=True, check=True).stdout)
v2 = json.loads(subprocess.run(['git', '-C', R, 'show', '528604a:analytics-mvp/data/plan_2026-10-15_v2.json'], capture_output=True, text=True, check=True).stdout)
groups = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in groups for s in g['skus']}
sku2off = {v: k for k, v in off2sku.items()}
od = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
msk = lambda o: dt.datetime.fromisoformat(o['t'].replace('Z', '+00:00')).astimezone(MSK).date().isoformat()
tot_out = tot_all = 0
print('карточка | товаров | выводимых | база 14.09-11.10 всего / от выводимых | 01-14.10 всего / от выводимых | порог')
for c1, c2 in zip(v1['cards'], v2['cards']):
    out = set(c1['min_arts']) - set(c2['min_arts'])
    ms = off2sku[c1['main_art']]
    g = next(g for g in groups if any(str(s['sku']) == ms for s in g['skus']))
    skus = {str(s['sku']) for s in g['skus']}
    out_skus = {off2sku[a] for a in out if a in off2sku}
    assert out_skus <= skus, (c1['short'], out_skus - skus)
    def n(a, b, ss):
        return sum(int(o['units']) for o in od if o['status'] != 'cancelled' and str(o.get('sku')) in ss and a <= msk(o) <= b)
    b_all, b_out = n('2026-09-14', '2026-10-11', skus), n('2026-09-14', '2026-10-11', out_skus)
    p_all, p_out = n('2026-10-01', '2026-10-14', skus), n('2026-10-01', '2026-10-14', out_skus)
    tot_out += b_out; tot_all += b_all
    print(f"{c1['short']} | {len(skus)} | {len(out)} | {b_all} / {b_out} | {p_all} / {p_out} | {c1['threshold']}")
print(f'итого база: {tot_all}, от выводимых {tot_out}')
