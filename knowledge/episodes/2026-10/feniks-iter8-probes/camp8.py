#!/usr/bin/env python3
"""Classification mismatch: report isCpoCampaign(r.off) vs camp_meta.instr (N8 / tab isCPO). Monthly spend/om per campaign."""
import json, re, collections, sys

D = sys.argv[1] if len(sys.argv) > 1 else "/home/user/t1/analytics-mvp/data"
instr = {}
metas = []
try:
    metas.append(json.load(open(D + "/ads_30d.json")).get("camp_meta"))
except Exception as e:
    print("ads_30d err", e)
try:
    ap = json.load(open(D + "/ads_periods.json"))
    for k in ap:
        metas.append((ap[k] or {}).get("camp_meta"))
except Exception as e:
    print("ads_periods err", e)
for m in metas:
    for i, v in (m or {}).items():
        if i not in instr and (v or {}).get("instr"):
            instr[i] = str(v["instr"])
names = collections.defaultdict(set)
mon = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0, 0]))
for l in open(D + "/ads_daily.ndjson"):
    if not l.strip():
        continue
    r = json.loads(l)
    i = str(r.get("id"))
    names[i].add(str(r.get("off") or ""))
    a = mon[i][str(r["d"])[:7]]
    a[0] += float(r.get("sp") or 0)
    a[1] += float(r.get("om") or 0)
    a[2] += int(r.get("o") or 0)
cpo_name = lambda s: bool(re.search("за заказ", s, re.I))
print("campaigns:", len(names), "with camp_meta instr:", sum(1 for i in names if i in instr))
mis = []
for i in sorted(names):
    by_name = any(cpo_name(n) for n in names[i])
    by_meta = cpo_name(instr.get(i, ""))
    if by_name != by_meta:
        mis.append(i)
    if by_name or by_meta:
        tot = sum(v[0] for v in mon[i].values())
        print(f"{i}: name={sorted(names[i])} instr={instr.get(i,'-')!r} report_CPO={by_name} meta_CPO={by_meta} total_sp={tot:.0f}")
        for m in sorted(mon[i]):
            v = mon[i][m]
            print(f"    {m}: sp={v[0]:.0f} om={v[1]:.0f} o={v[2]}")
print("MISMATCH ids:", mis)
# spend per month by report rule (cpo by name) - to explain Feb-May coverage
pm = collections.defaultdict(float)
for i in names:
    if any(cpo_name(n) for n in names[i]):
        for m, v in mon[i].items():
            pm[m] += v[0]
print("report cpoApiSp by month:", {k: round(v) for k, v in sorted(pm.items())})
