#!/usr/bin/env python3
"""ФЕНИКС #484, проба M3: дозревание рекламной статистики OZON Performance (ads_daily.ndjson).
Ряд дописывается от последнего дня до вчера, но был разовый ПОЛНЫЙ пересбор (needsBackfill, ads-daily.ts:55-66).
Ищем коммит пересбора (много удалённых строк) и сравниваем расход/показы/клики дней, впервые записанных
ранним утром (первая запись дня D в D+1 до 08:00 UTC), с их значением после пересбора.
Только чтение REST, кэш в scratch.
"""
import json
import os
import subprocess
import datetime as dt
from collections import defaultdict

REPO = "oliverjone01-dev/t1"
PATH = "analytics-mvp/data/ads_daily.ndjson"
OUT = "/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/fx484/m3"
os.makedirs(OUT, exist_ok=True)


def api(url, raw=False):
    cmd = ["gh", "api", url] + (["-H", "Accept: application/vnd.github.raw"] if raw else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[:200])
    return r.stdout if raw else json.loads(r.stdout)


cs = []
for p in range(1, 5):
    page = api(f"repos/{REPO}/commits?sha=main&path={PATH}&per_page=100&page={p}")
    cs += page
    if len(page) < 100:
        break
cs = cs[::-1]
print(f"коммитов ads_daily на main: {len(cs)} ({cs[0]['commit']['committer']['date']} .. {cs[-1]['commit']['committer']['date']})")
stats = []
for c in cs:
    f = os.path.join(OUT, c["sha"][:12] + ".stat.json")
    if not os.path.exists(f):
        d = api(f"repos/{REPO}/commits/{c['sha']}")
        st = [x for x in d.get("files", []) if x["filename"] == PATH]
        json.dump({"add": st[0]["additions"] if st else None, "del": st[0]["deletions"] if st else None}, open(f, "w"))
    s = json.load(open(f))
    stats.append((c["sha"], c["commit"]["committer"]["date"], s["add"], s["del"]))
big = [s for s in stats if (s[3] or 0) > 200]
print("коммиты с удалением >200 строк (пересборы):", [(s[0][:8], s[1], s[2], s[3]) for s in big])


def load(sha):
    f = os.path.join(OUT, sha[:12] + ".ndjson")
    if not os.path.exists(f):
        open(f, "w").write(api(f"repos/{REPO}/contents/{PATH}?ref={sha}", raw=True))
    m = defaultdict(lambda: defaultdict(float))
    for l in open(f):
        try:
            r = json.loads(l)
        except Exception:
            continue
        for k in ("sp", "vw", "cl", "o", "om"):
            if r.get(k) is not None:
                m[r["d"]][k] += float(r[k] or 0)
    return m


# первая запись каждого дня: коммит, где день появился (по stats - дописывающие коммиты)
first_commit = {}
prev_days = set()
for sha, when, a, d_ in stats:
    if (d_ or 0) > 200:
        continue
    m = load(sha)
    for day in m:
        if day not in prev_days and day not in first_commit:
            first_commit[day] = (sha, when)
    prev_days |= set(m)
for sha, when, a, d_ in big:
    after = load(sha)
    # версия прямо перед пересбором
    idx = [s[0] for s in stats].index(sha)
    before = load(stats[idx - 1][0]) if idx else {}
    print(f"\nпересбор {sha[:8]} {when}: дней до {len(before)}, после {len(after)}")
    rows = []
    for day in sorted(set(before) & set(after)):
        fc = first_commit.get(day)
        if not fc:
            continue
        t = dt.datetime.fromisoformat(fc[1].replace("Z", "+00:00"))
        lag_h = (t - (dt.datetime.fromisoformat(day + "T00:00:00+03:00") + dt.timedelta(days=1))).total_seconds() / 3600
        b, a2 = before[day], after[day]
        rows.append((lag_h, day, b.get("sp", 0), a2.get("sp", 0), b.get("cl", 0), a2.get("cl", 0)))
    early = [r for r in rows if r[0] < 8]
    late = [r for r in rows if 8 <= r[0] < 30]
    for name, grp in (("первая запись < 8 ч после конца дня МСК", early), ("8-30 ч", late)):
        if not grp:
            print(f"   {name}: дней 0")
            continue
        sp_b = sum(r[2] for r in grp); sp_a = sum(r[3] for r in grp)
        ch = sum(1 for r in grp if abs(r[3] - r[2]) > 0.5)
        print(f"   {name}: дней {len(grp)}, расход до {sp_b:.0f} после {sp_a:.0f} (x{sp_a / sp_b if sp_b else float('nan'):.4f}), дней с изменённым расходом {ch}")
        for r in grp[:6]:
            print(f"      {r[1]} (+{r[0]:.1f} ч): sp {r[2]:.0f} -> {r[3]:.0f}, cl {r[4]:.0f} -> {r[5]:.0f}")
