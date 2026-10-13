# Проба ФЕНИКСА: сколько смен ставки за заказ в журнале и по каким парам уровней (проверка «29 смен», «5 смен», «18 смен»).
import collections as C
rows = [l.strip().split('|') for l in open('/home/user/t1-v4/analytics-mvp/tools/tests/cpo_history.psv')][1:]
print('записей в журнале', len(rows))
print('по виду записи:', dict(C.Counter(r[1] for r in rows)))
st = '5'
days = C.OrderedDict()
for ts, c, u in rows:
    days.setdefault(ts[:10], []).append(c)
seq = []
for d, cs in days.items():
    for c in cs:
        new = 'OFF' if c == 'OFF' else ('5' if c == 'ON 5%' else c.split('>')[1].split('.')[0])
        seq.append((d, st, new))
        st = new
real = [(d, a, b) for d, a, b in seq if a != b]
print('записей (включая внутри дня):', len(seq), '; реальных переходов уровня:', len(real))
print('пары уровней:', dict(C.Counter('-'.join(sorted((a, b))) for d, a, b in real)))
eod = []
prev = '5'
for d, cs in days.items():
    s_end = [b for dd, a, b in seq if dd == d][-1]
    if s_end != prev:
        eod.append((d, prev, s_end))
    prev = s_end
print('переходов по состоянию на конец дня:', len(eod), dict(C.Counter('-'.join(sorted((a, b))) for d, a, b in eod)))
