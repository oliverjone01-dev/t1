# P11: темп заказов магазина (без отмен) по неделям против «Сейчас в месяц» 293 на «Цели»: сдвинулась ли база после 08.10
import json, collections as C, datetime as dt
D = '/home/user/t1/analytics-mvp/data/'
u = C.Counter(); canc = C.Counter(); allu = C.Counter()
for l in open(D + 'orders_daily.ndjson'):
    o = json.loads(l)
    if o['d'] < '2026-09-01': continue
    allu[o['d']] += o['units']
    if o['status'] == 'cancelled': canc[o['d']] += o['units']
    else: u[o['d']] += o['units']
def per_month(a, b):
    n = (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days + 1
    s = sum(v for d, v in u.items() if a <= d <= b); return s, s / n * 30.3, n
for a, b in (('2026-09-14', '2026-10-11'), ('2026-09-14', '2026-10-07'), ('2026-10-08', '2026-10-13'), ('2026-10-01', '2026-10-07'), ('2026-09-24', '2026-09-30'), ('2026-09-17', '2026-09-23')):
    s, m, n = per_month(a, b)
    print(f'{a}..{b}: {s} шт за {n} дн, {m:.0f} в месяц (30,3 дн)')
print('отменено 08-13.10:', sum(v for d, v in canc.items() if '2026-10-08' <= d <= '2026-10-13'), 'из', sum(v for d, v in allu.items() if '2026-10-08' <= d <= '2026-10-13'))
