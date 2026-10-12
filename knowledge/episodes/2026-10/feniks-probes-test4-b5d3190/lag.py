"""Ads vs gap freshness per data-sync commit (read-only git)."""
import json, subprocess, sys
repo = sys.argv[1]
commits = subprocess.run(["git", "-C", repo, "log", "--format=%h %ad %s", "--date=short", "-12", "--", "analytics-mvp/data/ads_sku_daily.ndjson"],
                         capture_output=True, text=True).stdout.strip().split("\n")


def maxd(rev, path, key):
    out = subprocess.run(["git", "-C", repo, "show", f"{rev}:{path}"], capture_output=True, text=True).stdout
    m = ""
    for l in out.splitlines():
        if l.strip():
            try:
                d = str(json.loads(l).get(key) or "")[:10]
            except Exception:
                continue
            if d > m:
                m = d
    return m


for c in commits:
    h = c.split()[0]
    a = maxd(h, "analytics-mvp/data/ads_sku_daily.ndjson", "d")
    g = maxd(h, "analytics-mvp/data/gap_daily.ndjson", "date")
    ac = maxd(h, "analytics-mvp/data/acts_daily.ndjson", "date")
    print(f"{c[:60]:60s} ads {a}  gap {g}  acts {ac}  {'LAG' if a and g and a < g else 'ok'}")
