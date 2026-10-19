"""Follow-up: are the 50 EB exits real (do arts come back next days)? When did new GGT-03-5-1 join EB?
Gap vs EB membership overall: share of observed (date, art) in EB vs gap level."""
import json, sys, collections, statistics as st
D = sys.argv[1]
rd = lambda f: [json.loads(l) for l in open(D + "/" + f, encoding="utf-8") if l.strip()]
acts = rd("acts_daily.ndjson"); gap = rd("gap_daily.ndjson"); coinv = rd("coinv_daily.ndjson")
EB = lambda title: title.startswith("Эластичный бустинг")
act_days = sorted({r["date"] for r in acts})
eb = collections.defaultdict(set); anyact = collections.defaultdict(set)
for r in acts:
    anyact[r["date"]].add(r["art"])
    if EB(r["title"]): eb[r["date"]].add(r["art"])
obs = collections.defaultdict(set)
for r in coinv:
    if r.get("observed") is not False: obs[r["date"]].add(r["art"])
# per act-day: size of EB set
print("EB set size by act-day:")
print("  ", [(d[5:], len(eb[d])) for d in act_days])
exits = []
for i in range(len(act_days) - 1):
    d0, d1 = act_days[i], act_days[i + 1]
    for a in eb[d0] - eb[d1]:
        if a in obs.get(d1, set()):
            back = next((x for x in act_days[i + 2:] if a in eb[x]), None)
            exits.append((d0, d1, a, back))
dur = collections.Counter((d1, back) for d0, d1, a, back in exits)
print("exits grouped by (exit day, back-in-EB day):", dict(dur))
print("\nnew GGT-03-5-1 + GGT-47-5-1-80/90: EB membership by act-day")
for a in ["GGT-03-5-1-L-100", "GGT-03-5-1-O-18090", "GGT-47-5-1-80", "GGT-47-5-1-90"]:
    print("  ", a, [(d[5:], "EB" if a in eb[d] else ("act" if a in anyact[d] else "-")) for d in act_days if d >= "2026-10-08"])
# gap level by EB membership (same day), for dates with acts snapshot
g = {(r["date"], r["art"]): r.get("gap_pct") for r in gap if isinstance(r.get("gap_pct"), (int, float))}
inn, out = [], []
for (d, a), v in g.items():
    if d not in eb: continue
    (inn if a in eb[d] else out).append(v)
print(f"\ngap when in EB: n={len(inn)} median={st.median(inn):.2f} min={min(inn):.2f}; not in EB: n={len(out)} median={st.median(out):.2f} min={min(out):.2f}")
print("not-in-EB rows with gap < 20:", sum(1 for v in out if v < 20), "; in-EB rows with gap < 20:", sum(1 for v in inn if v < 20))
