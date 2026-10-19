#!/usr/bin/env python3
"""ФЕНИКС #484, проба R3: история шага «Коммит данных в ветку» orders-backfill на GitHub.
Длительность шага >= 25 с означает ретраи push (паузы 2+4+8+16 с). Для каждого прогона: есть ли
коммит data(orders) в main в окне прогона, и были ли чужие коммиты в main между стартом job и шагом
коммита (окно гонки). Только чтение API.
"""
import json
import subprocess
import datetime as dt

REPO = "oliverjone01-dev/t1"


def api(url):
    r = subprocess.run(["gh", "api", url], capture_output=True, text=True)
    return json.loads(r.stdout)


def ts(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None


runs = api(f"repos/{REPO}/actions/workflows/361257227/runs?per_page=60")["workflow_runs"]
commits = []
for page in range(1, 15):
    cs = api(f"repos/{REPO}/commits?sha=main&since=2026-09-20T00:00:00Z&per_page=100&page={page}")
    if not cs:
        break
    commits += cs
    if len(cs) < 100:
        break
cm = [(ts(c["commit"]["committer"]["date"]), c["commit"]["author"]["email"], c["commit"]["message"].split("\n")[0][:50]) for c in commits]
print(f"прогонов orders-backfill: {len(runs)}, коммитов main с 20.09: {len(cm)}")
for r in sorted(runs, key=lambda x: x["run_number"]):
    if r["status"] != "completed":
        continue
    jobs = api(f"repos/{REPO}/actions/runs/{r['id']}/jobs")["jobs"]
    if not jobs:
        continue
    j = jobs[0]
    st = {s["name"]: s for s in j["steps"]}
    c = st.get("Коммит данных в ветку")
    if not c:
        continue
    j0, c0, c1 = ts(j["started_at"]), ts(c["started_at"]), ts(c["completed_at"])
    dur = (c1 - c0).total_seconds() if c0 and c1 else None
    ours = [x for x in cm if x[2].startswith("data(orders)") and j0 <= x[0] <= (c1 or j0) + dt.timedelta(seconds=5)]
    race = [x for x in cm if j0 < x[0] < (c0 or j0) and not x[2].startswith("data(orders)")]
    print(f"#{r['run_number']:>3} {r['event']:<17} {r['conclusion']:<8} job {j0:%d.%m %H:%M:%S} коммит-шаг {c['conclusion']:<8} {('%.0f' % dur) if dur is not None else '-':>4} с; data(orders) в main: {len(ours)}; чужих коммитов в окне: {len(race)} {[ (f'{x[0]:%H:%M:%S}', x[1].split('@')[0]) for x in race]}")
