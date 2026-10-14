# ФЕНИКС 14.10, предпроверка записки «К выплате 20 млн», п.6 и путь 4: расход и заказы дорогих кампаний за 14.09-11.10
# (ads_daily, заказы по атрибуции OZON), и идут ли они сейчас (последние 7 дней данных). python3 -I -B p_campaigns.py
import json, collections, datetime as dt
D = '/home/user/t1/analytics-mvp/data/'
IDS = {'40015169': '', '40047060': '', '37676554': '', '37675958': 'KONUX', '39931246': 'KUVINO'}
rows = [json.loads(l) for l in open(D + 'ads_daily.ndjson')]
last = max(r['d'] for r in rows)
w0, w1 = '2026-09-14', '2026-10-11'
l7 = (dt.date.fromisoformat(last) - dt.timedelta(days=6)).isoformat()
agg = collections.defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, set()])
for r in rows:
    if r['id'] not in IDS: continue
    a = agg[r['id']]
    if w0 <= r['d'] <= w1: a[0] += r.get('sp') or 0; a[1] += r.get('o') or 0
    if r['d'] >= l7: a[2] += r.get('sp') or 0; a[3] += r.get('o') or 0
    if (r.get('sp') or 0) > 0: a[4].add(r['d'])
days = (dt.date.fromisoformat(w1) - dt.date.fromisoformat(w0)).days + 1
print('последний день ads_daily', last, '; окно', w0, w1, days, 'дн.')
tot = [0.0, 0.0]
for k, (sp, o, sp7, o7, ds) in agg.items():
    m = sp / days * 30.4
    print(f'{k} {IDS[k]:7s} окно: расход {sp:,.0f} (в месяц {m:,.0f}), заказов {o:.0f}; последние 7 дн.: расход {sp7:,.0f}, заказов {o7:.0f}; последний день с расходом {max(ds) if ds else "-"}')
    grp = 0 if IDS[k] == '' else 1; tot[grp] += m
print(f'итого в месяц по темпу окна: три кампании {tot[0]:,.0f}; KONUX+KUVINO {tot[1]:,.0f}')
# весь клик по месяцам и октябрь по темпу (для базы пути 4)
mon = collections.Counter()
for r in rows:
    mon[r['d'][:7]] += r.get('sp') or 0
print('весь расход кампаний (клик+заказ) по месяцам:', {k: round(v) for k, v in sorted(mon.items()) if k >= '2026-06'})
