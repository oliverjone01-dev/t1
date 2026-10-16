# iter2, G8: независимая проверка цифр «Как считаем» (оборот базы, +3,5%, отмены 12,9% / 6,5%) и их устойчивость.
# python3 -I p2_g8.py
import json
DD = '/home/user/t1/analytics-mvp/data/'
rows = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
plan = json.load(open(DD + 'plan_2026-10-15.json'))
base = [r for r in rows if '2026-09-14' <= r['d'] <= '2026-10-11' and r['status'] != 'cancelled']
rev = sum(r['revenue'] for r in base); u = sum(r['units'] for r in base)
print('база 14.09-11.10 без отмен: выручка', rev, 'млн', round(rev / 1e6, 3), 'шт', u, 'заказов', len(base))
per_day = rev / 28
for days in (30, 30.29, 30.4, 31):
    print(f'  в месяц ×{days}: {per_day * days / 1e6:.2f} млн; к 20,4: {per_day * days / 20.4e6 - 1:+.1%}')
lo = plan['goal']['turn_mln']['oct']['lo']
print('  к «плохо» октября', lo, 'млн/31 дн:', f'{per_day / (lo * 1e6 / 31) - 1:+.1%}')
ulo = plan['goal']['units']['oct']['lo']
print('  штуки: база', u, 'за 28 дн =', round(u / 28, 3), 'в день; «плохо» октября', ulo, '/31 =', round(ulo / 31, 3), f'{(u / 28) / (ulo / 31) - 1:+.1%}')
def canc(a, b):
    s = [r for r in rows if a <= r['d'] <= b]
    c = [r for r in s if r['status'] == 'cancelled']
    return len(c), len(s), (len(c) / len(s) if s else None)
for a, b in (('2026-10-01', '2026-10-10'), ('2026-10-11', '2026-10-13'), ('2026-09-14', '2026-10-11'), ('2026-09-01', '2026-09-30')):
    c, n, p = canc(a, b); print('отмены', a, b, f'{c}/{n} = {p:.1%}')
