#!/usr/bin/env python3
"""FENIKS iter6: campaigns labelled «Оплата за заказ» - ads_daily names, spend by month, metadata in ads_periods/ads_30d."""
import collections, json, re, sys

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6"
D = f"{S}/{sys.argv[1]}/analytics-mvp/data/"
rows = [json.loads(l) for l in open(D + "ads_daily.ndjson") if l.strip()]
meta = {}
for f in ("ads_periods.json", "ads_30d.json"):
    s = open(D + f, encoding="utf-8").read()
    for m in re.finditer(r'\{"id":"(\d+)"[^{}]*?"instr":"([^"]*)"', s):
        meta.setdefault(m.group(1), set()).add(m.group(2))
cpo_ids = sorted(i for i, v in meta.items() if any(re.search("за заказ", x, re.I) for x in v))
print("ids with instr ~ «за заказ» in ads_periods/ads_30d:", {i: sorted(meta[i]) for i in cpo_ids})
names = collections.defaultdict(collections.Counter)
for r in rows:
    names[r["id"]][r.get("off")] += 1
for i in cpo_ids + ["22421802", "28753239"]:
    m = collections.defaultdict(float)
    spd = [r["d"] for r in rows if r["id"] == i and r["sp"] > 0]
    for r in rows:
        if r["id"] == i:
            m[r["d"][:7]] += r["sp"]
    print(i, "ads_daily names:", dict(names[i]), "spend by month:", {k: round(v) for k, v in sorted(m.items())},
          "spend days:", (min(spd), max(spd), len(spd)) if spd else None)
# who is first in campaign lists? spend 01-05.06 per CPO-labelled campaign
for f, t in (("2026-06-01", "2026-06-05"), ("2026-06-01", "2026-06-06"), ("2026-06-01", "2026-06-10"), ("2026-05-25", "2026-06-10"), ("2026-06-05", "2026-06-07")):
    print(f, t, {i: round(sum(r["sp"] for r in rows if r["id"] == i and f <= r["d"] <= t)) for i in cpo_ids})
# CPO name rule in report-page (ads_daily off name contains «за заказ»)
print("ads_daily ids whose off name matches /за заказ/i:", sorted({r["id"] for r in rows if re.search("за заказ", str(r.get("off") or ""), re.I)}))
