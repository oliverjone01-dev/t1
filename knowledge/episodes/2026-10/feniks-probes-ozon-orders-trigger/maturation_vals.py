#!/usr/bin/env python3
"""ФЕНИКС #484, проба M1b: в кэше версий daily_totals (m1/*.ndjson, порядок по коммитам API) ищем
только ЗНАЧЕНИЯ, которые сменились (старое и новое не None), без добавления полей схемы.
Печатает: день, когда впервые записан (UTC и часы после конца дня МСК), когда изменён, поля.
"""
import json
import os
import subprocess
import datetime as dt

OUT = "/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/fx484/m1"
REPO = "oliverjone01-dev/t1"
PATH = "analytics-mvp/data/daily_totals.ndjson"
r = subprocess.run(["gh", "api", f"repos/{REPO}/commits?sha=main&path={PATH}&per_page=100&page=1"], capture_output=True, text=True)
cs = json.loads(r.stdout)
r2 = subprocess.run(["gh", "api", f"repos/{REPO}/commits?sha=main&path={PATH}&per_page=100&page=2"], capture_output=True, text=True)
cs += json.loads(r2.stdout)
cs = cs[::-1]
MSK = dt.timezone(dt.timedelta(hours=3))
first, prev = {}, {}
real = []
for c in cs:
    f = os.path.join(OUT, c["sha"][:12] + ".ndjson")
    if not os.path.exists(f):
        continue
    ts = c["commit"]["committer"]["date"]
    cur = {}
    for l in open(f):
        try:
            o = json.loads(l)
        except Exception:
            continue
        if o.get("date"):
            cur[o["date"]] = o
    for k, o in cur.items():
        if k not in first:
            first[k] = ts
        elif k in prev:
            d = {fl: (prev[k].get(fl), o.get(fl)) for fl in o if prev[k].get(fl) is not None and o.get(fl) is not None and prev[k].get(fl) != o.get(fl)}
            if d:
                real.append((k, first[k], ts, d))
    prev = cur

print(f"дней {len(first)}; дней с реальной сменой значений: {len(set(x[0] for x in real))}; событий {len(real)}")
for k, f0, ts, d in real:
    end_msk = dt.datetime.fromisoformat(k + "T00:00:00").replace(tzinfo=MSK) + dt.timedelta(days=1)
    t0 = dt.datetime.fromisoformat(f0.replace("Z", "+00:00"))
    t1 = dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    print(f"  {k}: впервые {f0} (+{(t0 - end_msk).total_seconds() / 3600:.1f} ч от конца дня МСК), сменён {ts} (+{(t1 - end_msk).total_seconds() / 3600:.1f} ч): {d}")
