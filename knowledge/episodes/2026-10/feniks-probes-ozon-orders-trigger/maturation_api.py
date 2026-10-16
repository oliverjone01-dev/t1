#!/usr/bin/env python3
"""ФЕНИКС #484, проба M1 через REST (клон shallow, 94 коммита): все версии daily_totals.ndjson
на main, поиск дней, чьи значения менялись после первой записи (дозревание данных OZON).
Только чтение API, кэш версий в scratch.
"""
import json
import os
import subprocess
import sys

OUT = "/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/fx484/m1"
os.makedirs(OUT, exist_ok=True)
REPO = "oliverjone01-dev/t1"
PATH = sys.argv[1] if len(sys.argv) > 1 else "analytics-mvp/data/daily_totals.ndjson"
KEY = sys.argv[2] if len(sys.argv) > 2 else "date"


def api(url, raw=False):
    cmd = ["gh", "api", url]
    if raw:
        cmd += ["-H", "Accept: application/vnd.github.raw"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[:300])
    return r.stdout if raw else json.loads(r.stdout)


commits = []
page = 1
while True:
    cs = api(f"repos/{REPO}/commits?sha=main&path={PATH}&per_page=100&page={page}")
    if not cs:
        break
    commits += cs
    if len(cs) < 100:
        break
    page += 1
commits = commits[::-1]
print(f"{PATH}: коммитов на main {len(commits)} ({commits[0]['commit']['committer']['date']} .. {commits[-1]['commit']['committer']['date']})")

first = {}
prev = {}
changes = []
for c in commits:
    sha = c["sha"]
    cache = os.path.join(OUT, sha[:12] + ".ndjson")
    if not os.path.exists(cache):
        try:
            txt = api(f"repos/{REPO}/contents/{PATH}?ref={sha}", raw=True)
        except RuntimeError as e:
            print("  skip", sha[:8], e)
            continue
        open(cache, "w").write(txt)
    txt = open(cache).read()
    cur = {}
    for l in txt.splitlines():
        try:
            r = json.loads(l)
        except Exception:
            continue
        k = r.get(KEY)
        if k:
            cur[k] = r
    ts = c["commit"]["committer"]["date"]
    for k, r in cur.items():
        if k not in first:
            first[k] = (sha[:8], ts)
        elif k in prev and prev[k] != r:
            diff = {f: (prev[k].get(f), r.get(f)) for f in set(prev[k]) | set(r) if prev[k].get(f) != r.get(f)}
            changes.append((k, first[k], sha[:8], ts, diff))
    prev = cur

print(f"дней всего {len(first)}, переписаны после первой записи: {len(set(x[0] for x in changes))}")
for k, f, sha, ts, diff in changes[:40]:
    print(f"  {k}: первая запись {f[1]} ({f[0]}), изменён {ts} ({sha}): {diff}")
# время первой записи дня D относительно конца дня D (UTC), часы
lags = []
import datetime as dt
for k, (sha, ts) in first.items():
    try:
        d = dt.datetime.fromisoformat(k + "T00:00:00+00:00") + dt.timedelta(days=1)
        t = dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
        lags.append(((t - d).total_seconds() / 3600, k, ts))
    except Exception:
        pass
lags.sort()
print("самые ранние первые записи (часов после конца дня UTC):", [(round(a, 1), k, ts) for a, k, ts in lags[:8]])
