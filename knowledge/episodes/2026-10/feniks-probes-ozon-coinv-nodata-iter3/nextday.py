"""Check claim «назавтра 46-58%» (gap-daily.ts comment, decisions.md 2026-10-19 (3)) for 14 gap_daily and 21 coinv_daily no_site rows."""
import json, sys, collections
D = sys.argv[1]
rd = lambda f: [json.loads(l) for l in open(D + "/" + f, encoding="utf-8") if l.strip()]
for f, fld in (("gap_daily.ndjson", "gap_pct"), ("coinv_daily.ndjson", "coinv_paid_pct")):
    rows = rd(f)
    by = collections.defaultdict(dict)
    for r in rows:
        by[r["art"]][r["date"]] = None if r.get("no_site") else r.get(fld)
    nxt, nxt3 = [], []
    for r in rows:
        if not r.get("no_site"): continue
        later = [(d, v) for d, v in sorted(by[r["art"]].items()) if d > r["date"] and isinstance(v, (int, float))]
        if later:
            nxt.append(later[0][1]); nxt3 += [v for _, v in later[:3]]
    print(f"{f}: no_site rows {sum(1 for r in rows if r.get('no_site'))}; first value after: min {min(nxt):.2f} max {max(nxt):.2f}; first 3 values after: min {min(nxt3):.2f} max {max(nxt3):.2f}")
