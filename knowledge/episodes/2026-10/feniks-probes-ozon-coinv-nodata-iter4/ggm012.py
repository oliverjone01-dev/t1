"""A1: source of decisions.md 19.10 p.(4) «GGM-01-2 54 750 -> 43 900 = 19,8%» in prices_daily (outside the artifact text).
Usage: python3 -I ggm012.py <analytics-mvp/data>"""
import json
import sys

rows = [json.loads(l) for l in open(f"{sys.argv[1]}/prices_daily.ndjson", encoding="utf-8") if l.strip()]
g = [r for r in rows if r.get("offer") == "GGM-01-2" and "2026-10-08" <= r["d"]]
for r in g:
    print({k: r.get(k) for k in ("d", "price", "before", "coinv")})
pairs = {(r.get("before"), r.get("price")) for r in rows if r.get("offer") == "GGM-01-2" and r.get("before")}
print("distinct (before, price) for GGM-01-2:", sorted(pairs, key=str)[:10])
print("1 - 43900/54750 =", round((1 - 43900 / 54750) * 100, 2))
