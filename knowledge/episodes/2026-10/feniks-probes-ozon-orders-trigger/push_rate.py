#!/usr/bin/env python3
"""ФЕНИКС #484, проба R2: частота чужих коммитов в main в окна сбора заказов.
Окно гонки шага коммита = от checkout до push, ~4 мин после старта прогона.
Для каждого дня 01.10-15.10 считаем коммиты в main (кроме самого мака и бота orders) в окнах
[t, t+4 мин] для t = 04:50 и 17:50 UTC (утро/вечер съёма) и в окне фактического прогона по расписанию.
Источник: REST /commits (committer date). Только чтение.
"""
import json
import subprocess
import datetime as dt
from collections import Counter

REPO = "oliverjone01-dev/t1"


def api(url):
    r = subprocess.run(["gh", "api", url], capture_output=True, text=True)
    return json.loads(r.stdout)


commits = []
for page in range(1, 15):
    cs = api(f"repos/{REPO}/commits?sha=main&since=2026-09-30T00:00:00Z&per_page=100&page={page}")
    if not cs:
        break
    commits += cs
    if len(cs) < 100:
        break
rows = []
for c in commits:
    t = dt.datetime.fromisoformat(c["commit"]["committer"]["date"].replace("Z", "+00:00"))
    rows.append((t, c["commit"]["author"]["email"], c["commit"]["message"].split("\n")[0][:60], c["sha"][:8]))
rows.sort()
print(f"коммитов в main с 30.09: {len(rows)} ({rows[0][0]:%d.%m %H:%M} .. {rows[-1][0]:%d.%m %H:%M} UTC)")
by_hour = Counter(t.hour for t, *_ in rows)
print("по часам UTC:", " ".join(f"{h:02d}:{by_hour.get(h, 0)}" for h in range(24)))
days = sorted({t.date() for t, *_ in rows})
ndays = (rows[-1][0].date() - rows[0][0].date()).days + 1


def others_in(t0, minutes):
    t1 = t0 + dt.timedelta(minutes=minutes)
    return [r for r in rows if t0 < r[0] <= t1 and "srez@" not in r[1] and not r[2].startswith("data(orders)")]


for hh, mm in ((4, 50), (17, 50)):
    hits = []
    for i in range(ndays):
        d = rows[0][0].date() + dt.timedelta(days=i)
        t0 = dt.datetime(d.year, d.month, d.day, hh, mm, tzinfo=dt.timezone.utc)
        h = others_in(t0, 4)
        if h:
            hits.append((d, h))
    rate_h = sum(1 for t, e, m, s in rows if "srez@" not in e and (t.hour == hh or (t.hour == hh + 1 and t.minute < 10))) / ndays
    print(f"окно {hh:02d}:{mm:02d}+4 мин: дней с чужим коммитом {len(hits)} из {ndays}; коммитов/день в часе {hh:02d} ~{rate_h:.2f}")
    for d, h in hits:
        print("   ", d, [(f"{r[0]:%H:%M:%S}", r[1].split('@')[0], r[2][:40]) for r in h])

# окно вокруг каждого мак-пуша: чужие коммиты в 4 мин после него
mac = [r for r in rows if "srez@" in r[1]]
print(f"мак-коммитов: {len(mac)}")
for r in mac:
    h = others_in(r[0], 4)
    if h:
        print("   после мака", f"{r[0]:%d.%m %H:%M:%S}", "->", [(f"{x[0]:%H:%M:%S}", x[1].split('@')[0], x[2][:40]) for x in h])
# общая частота чужих коммитов в окне 4 мин по всем минутам суток
tot = 0
for i in range(ndays):
    d = rows[0][0].date() + dt.timedelta(days=i)
    for m in range(0, 24 * 60, 4):
        t0 = dt.datetime(d.year, d.month, d.day, tzinfo=dt.timezone.utc) + dt.timedelta(minutes=m)
        if others_in(t0, 4):
            tot += 1
print(f"доля 4-минутных окон суток с чужим коммитом (все часы): {tot / (ndays * 360):.3%}")
