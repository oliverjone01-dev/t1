import json, sys, collections, statistics as st
D = sys.argv[1]
rd = lambda f: [json.loads(l) for l in open(D + "/" + f, encoding="utf-8") if l.strip()]
eb = {(r["date"], r["art"]): r.get("eb_pct") for r in rd("eb_daily.ndjson")}
gap = {(r["date"], r["art"]): r.get("gap_pct") for r in rd("gap_daily.ndjson") if isinstance(r.get("gap_pct"), (int, float))}
acts = rd("acts_daily.ndjson")
inEB = collections.defaultdict(set)
for r in acts:
    if r["title"].startswith("Эластичный бустинг"): inEB[r["date"]].add(r["art"])
# eb_pct vs gap buckets
b = collections.defaultdict(list)
for k, g in gap.items():
    e = eb.get(k)
    if e is None: continue
    b[0 if e == 0 else (15 if e <= 20 else 55 if e >= 50 else 30)].append(g)
for k in sorted(b):
    print(f"eb_pct bucket {k}: n={len(b[k])} gap median={st.median(b[k]):.2f} min={min(b[k]):.2f}")
# eb_pct for GGM-18-1-1-LED and new cards around exit/entry
for a in ["GGM-18-1-1-LED", "GGT-03-5-1-L-100", "GGT-47-5-1-80"]:
    ds = sorted({d for d, x in eb if x == a and d >= "2026-10-05"})
    print(a, [(d[5:], eb.get((d, a)), "EB" if a in inEB.get(d, ()) else "-", gap.get((d, a))) for d in ds])
