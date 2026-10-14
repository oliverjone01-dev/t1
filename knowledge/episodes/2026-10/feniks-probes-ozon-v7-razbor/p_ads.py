# ФЕНИКС 14.10, предпроверка разбора: (1) кампания 22421802 «Продвижение в поиске - все товары» и кампании «за заказ» по месяцам;
# (2) входят ли рекламные показы в итоговые: окно выключения оплаты за заказ 28.08-03.09 (итоги дня против показов рекламы).
import json, collections
D = '/home/user/t1/analytics-mvp/data/'
meta = json.load(open(D + 'ads_30d.json')).get('camp_meta', {})
for per in ('p7', 'p30', 'p90'):
    meta = {**json.load(open(D + 'ads_periods.json'))[per].get('camp_meta', {}), **meta}
rows = [json.loads(l) for l in open(D + 'ads_daily.ndjson')]
m = collections.defaultdict(lambda: [0.0, 0.0, 0.0])
cpo_ids = collections.defaultdict(float)
day = collections.defaultdict(lambda: [0.0, 0.0])          # дата -> [показы рекламы «за заказ», показы рекламы всего]
for r in rows:
    ins = meta.get(r['id'], {}).get('instr', '?')
    if r['id'] == '22421802':
        a = m[r['d'][:7]]; a[0] += r.get('sp') or 0; a[1] += r.get('o') or 0; a[2] += r.get('vw') or 0
    if ins == 'Оплата за заказ' and '2026-07-01' <= r['d'] <= '2026-09-30': cpo_ids[r['id']] += r.get('sp') or 0
    d = day[r['d']]; d[1] += r.get('vw') or 0
    if ins == 'Оплата за заказ': d[0] += r.get('vw') or 0
print('22421802', meta.get('22421802'), {k: [round(x) for x in v] for k, v in sorted(m.items())})
print('кампании «за заказ» с расходом в июле-сентябре:', {k: round(v) for k, v in sorted(cpo_ids.items(), key=lambda kv: -kv[1])[:5]}, {k: meta.get(k, {}).get('name', '')[:40] for k in list(cpo_ids)[:5]})
tot = {json.loads(l)['date']: json.loads(l) for l in open(D + 'daily_totals.ndjson')}
print('дата | итоги: показы, в поиске | реклама: показы «за заказ», все')
for dd in ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07']:
    t = tot.get(dd, {})
    print(dd, t.get('views'), t.get('views_search'), round(day[dd][0]), round(day[dd][1]))
# дни, где показы рекламы больше итоговых показов (если рекламные не входят в итоги, такое возможно)
over = [dd for dd, v in day.items() if dd in tot and tot[dd].get('views') and v[1] > tot[dd]['views']]
print('дней, где показы рекламы больше итоговых:', len(over), sorted(over)[:5])
