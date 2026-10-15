#!/usr/bin/env python3
"""FENIKS iter11 gap 5 + B1: «Отчет» block 5 (rep_<sb>.json from fx11_report.mjs), p11 vs main pm.
Are the tables equal once U+2014 in pm is replaced by '-'? How many U+2014 are left in p11 (table, note, flags)?
And the whole page text (full_<sb>.json, fx11_full.mjs): U+2014 count per block in p11."""
import json

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11/"
D = "—"
a, b = json.load(open(S + "rep_p11.json")), json.load(open(S + "rep_pm.json"))
neq, dash_pm, dash_p11 = [], 0, 0
for ym, m in a["months"].items():
    n = b["months"].get(ym)
    rows_pm = [[c.replace(D, "-") for c in r] for r in n["rows"]]
    dash_pm += sum(c.count(D) for r in n["rows"] for c in r)
    dash_p11 += sum(c.count(D) for r in m["rows"] for c in r) + m["note"].count(D) + m["flags"].count(D)
    if rows_pm != m["rows"] or [h.replace(D, "-") for h in n["h"]] != m["h"]:
        neq.append(ym)
    if n["note"].replace(D, "-") != m["note"]:
        neq.append(ym + " note")
print("B1/gap5: views", len(a["months"]), "| differ after U+2014->'-' in main:", neq, "| U+2014 in main block 5 cells:", dash_pm, "| U+2014 left in p11 block 5 (cells+note+flags):", dash_p11)
f = json.load(open(S + "full_p11.json"))
for ym, blocks in f["months"].items():
    print("full text p11", ym, {k: v.count(D) for k, v in blocks.items()})
