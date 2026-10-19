"""Downside probe: honest exit from Elastic Boosting vs gap_daily.
1) titles in acts_daily; 2) for 14 no_site pairs - was the art in EB that day / next day;
3) every observed exit from EB (in EB on day d, observed but not in EB on next observed day) - gap before/after."""
import json, sys, collections
D = sys.argv[1]
rd = lambda f: [json.loads(l) for l in open(D + "/" + f, encoding="utf-8") if l.strip()]
acts = rd("acts_daily.ndjson")
gap = rd("gap_daily.ndjson")
coinv = rd("coinv_daily.ndjson")
t = collections.Counter(r["title"] for r in acts)
print("acts_daily", len(acts), "rows,", min(r["date"] for r in acts), "..", max(r["date"] for r in acts))
for k, v in t.most_common(12):
    print("  ", v, k)
EB = lambda title: title.startswith("Эластичный бустинг")
eb = collections.defaultdict(set)    # date -> arts in EB
act_days = sorted({r["date"] for r in acts})
for r in acts:
    if EB(r["title"]):
        eb[r["date"]].add(r["art"])
# observed per day: coinv_daily rows (build-tests OBSERVED_BY_DAY)
obs = collections.defaultdict(set)
for r in coinv:
    if r.get("observed") is not False:
        obs[r["date"]].add(r["art"])
g = {}
for r in gap:
    g[(r["date"], r["art"])] = "NS" if r.get("no_site") else r.get("gap_pct")
ns = sorted((r["date"], r["art"]) for r in gap if r.get("no_site"))
print("\n-- 14 no_site pairs: in EB that day? next act-day?")
for d, a in ns:
    nxt = [x for x in act_days if x > d][:1]
    print(f"  {d} {a}: acts snapshot that day={d in act_days}, inEB={a in eb.get(d, set())}, nextday {nxt[0] if nxt else '-'} inEB={(a in eb.get(nxt[0], set())) if nxt else '-'}")
print("\n-- exits from EB (in EB on act-day i, observed in coinv on act-day i+1, not in EB on i+1)")
exits = []
for i in range(len(act_days) - 1):
    d0, d1 = act_days[i], act_days[i + 1]
    for a in eb[d0] - eb[d1]:
        if a in obs.get(d1, set()):
            exits.append((d0, d1, a))
print("exits:", len(exits))
gdays = sorted({r["date"] for r in gap})
for d0, d1, a in exits[:40]:
    before = g.get((d0, a)); after = g.get((d1, a))
    later = [g.get((x, a)) for x in gdays if x > d1][:3]
    print(f"  {a}: EB {d0} -> out {d1}; gap {d0}={before} {d1}={after} later={later}")
zero_after_exit = [(d0, d1, a) for d0, d1, a in exits if g.get((d1, a)) in (0, "NS")]
print("exits with gap 0/NS on exit day:", len(zero_after_exit))
