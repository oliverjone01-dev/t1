# iter3, N1/N3: независимый пересчёт заказов по дню МСК и долей отмен на фикстуре, сверка с PD блока.
# python3 -I p3_msk_check.py <fx_dir> <pd.json>
import json, sys, datetime as dt, collections
fx, pdf = sys.argv[1], sys.argv[2]
rows = [json.loads(l) for l in open(fx + '/orders_daily.ndjson', encoding='utf-8') if l.strip()]
D = json.load(open(pdf))
raw_last = max(r['d'] for r in rows)
def msk(r):
    t = r.get('t')
    if not t: return r['d']
    x = dt.datetime.fromisoformat(t.replace('Z', '+00:00')) + dt.timedelta(hours=3)
    return x.date().isoformat()
u = collections.Counter(); allu = collections.Counter(); canc = collections.Counter(); dropped = 0
for r in rows:
    d = msk(r)
    if d > raw_last: dropped += 1; continue
    allu[d] += int(r.get('units') or 0)
    if r['status'] == 'cancelled': canc[d] += int(r.get('units') or 0); continue
    u[d] += int(r.get('units') or 0)
last = max(d for d in allu)
print('последний d выгрузки', raw_last, '| последний день по МСК после отсечки', last, '| PD od_last', D['od_last'], '| отброшено строк (обрывок)', dropped)
bad = 0
for j, d in enumerate(D['days']):
    v = D['store']['orders'][j]
    exp = u.get(d, 0) if d <= last else None
    if '2026-09-14' <= d and (v != exp and not (v is None and exp is None)):
        bad += 1; print('  расхождение', d, 'PD', v, 'независимо', exp)
print('дней сверено', len([d for d in D['days'] if '2026-09-14' <= d]), 'расхождений', bad)
def win(a, b): return sum(u[d] for d in u if a <= d <= b)
print('магазин 15.10..', last, '=', win('2026-10-15', last), '| 01-14.10 =', win('2026-10-01', '2026-10-14'), '| 01.10..', last, '=', win('2026-10-01', last))
def share(a, b):
    tu = sum(allu[d] for d in allu if a <= d <= b); tc = sum(canc[d] for d in canc if a <= d <= b)
    return f'{tc}/{tu} = {tc / tu * 100:.1f}%' if tu else '-'
L = dt.date.fromisoformat(last)
f = lambda k: (L + dt.timedelta(days=k)).isoformat()
print('отмены', f(-12), '..', f(-3), share(f(-12), f(-3)), '| последние 3 дня', f(-2), '..', last, share(f(-2), last))
