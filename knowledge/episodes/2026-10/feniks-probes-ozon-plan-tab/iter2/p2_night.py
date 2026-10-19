# iter2, G7-регресс: как часто в 00:00-02:59 МСК бывают заказы (тогда последний день по МСК = обрывок в 3 часа).
# Оценка без времени заказа: sku_views.units (день OZON, МСК) против orders_daily.units со всеми статусами (день UTC).
# sv[X] - od[X] = in(X) - in(X+1), где in(X) - заказы 00:00-02:59 МСК дня X. День с sv - od > 0 => in(X) >= 1 (нижняя граница).
# python3 -I p2_night.py
import json, collections
DD = '/home/user/t1/analytics-mvp/data/'
od = collections.Counter(); sv = collections.Counter()
for l in open(DD + 'orders_daily.ndjson', encoding='utf-8'):
    if l.strip():
        r = json.loads(l); od[r['d']] += int(r.get('units') or 0)
A, B = '2026-08-01', '2026-10-12'
for l in open(DD + 'sku_views.ndjson', encoding='utf-8'):
    if '"date"' not in l: continue
    r = json.loads(l)
    if A <= r['date'] <= B: sv[r['date']] += int(r.get('units') or 0)
days = sorted(d for d in sv if A <= d <= B)
pos = [d for d in days if sv[d] - od[d] > 0]
neg = [d for d in days if sv[d] - od[d] < 0]
print('дней', len(days), '| sv-od > 0 (ночью были заказы, нижняя граница):', len(pos), f'({len(pos) / len(days):.0%})', '| < 0:', len(neg), '| = 0:', len(days) - len(pos) - len(neg))
print('сумма sv', sum(sv[d] for d in days), 'сумма od', sum(od[d] for d in days), 'Σ|sv-od|', sum(abs(sv[d] - od[d]) for d in days))
print('последние 14 дней:', ' '.join(f"{d[8:]}.{d[5:7]}:{sv[d] - od[d]:+d}" for d in days[-14:]))
