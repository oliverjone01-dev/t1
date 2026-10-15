# ФЕНИКС, PR #477 @ 889c35b. Проба G2 (E083): дрейф «заказано без отмен» на уже закрытом 13-дневном окне
# по версиям orders_daily из git. Окна 01-13.09, 08-20.09, 15-27.09, 22.09-04.10: значение в первом коммите,
# где окно уже целиком в файле, и через ~7 и ~14 дней. Сравнить с допуском теста эталона 137: -2% (3 шт).
# python3 -I c10_drift.py
import json, subprocess, datetime as dt

R = '/home/user/t1'
F = 'analytics-mvp/data/orders_daily.ndjson'
log = [x.split() for x in subprocess.run(['git', '-C', R, 'log', '--format=%h %cI', '--since=2026-09-01', '--', F], capture_output=True, text=True).stdout.split('\n') if x]
log = log[::-1]
vers = []
for h, ts in log:
    rows = [json.loads(l) for l in subprocess.run(['git', '-C', R, 'show', f'{h}:{F}'], capture_output=True, text=True).stdout.splitlines() if l.strip()]
    if not rows:
        continue
    vers.append((h, ts[:10], max(r['d'] for r in rows), rows))
print('версий orders_daily с 01.09:', len(vers))
WIN = [('2026-09-01', '2026-09-13'), ('2026-09-08', '2026-09-20'), ('2026-09-15', '2026-09-27'), ('2026-09-22', '2026-10-04')]
for a, b in WIN:
    seq = []
    for h, day, md, rows in vers:
        if md < b:
            continue
        v = sum(int(r.get('units') or 0) for r in rows if a <= r['d'] <= b and r.get('status') != 'cancelled')
        seq.append((day, v))
    if not seq:
        print(a, b, 'нет версий'); continue
    d0, v0 = seq[0]
    out = []
    for lag in (7, 14):
        tgt = (dt.date.fromisoformat(d0) + dt.timedelta(days=lag)).isoformat()
        cand = [x for x in seq if x[0] >= tgt]
        if cand:
            out.append(f'+{lag}д ({cand[0][0]}): {cand[0][1]} ({(cand[0][1] - v0) / v0 * 100:+.1f}%)')
    print(f'окно {a}..{b}: первое {d0} = {v0}; ' + '; '.join(out) + f'; последнее {seq[-1][0]} = {seq[-1][1]} ({(seq[-1][1] - v0) / v0 * 100:+.1f}%)')
