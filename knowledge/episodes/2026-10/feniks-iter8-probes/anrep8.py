#!/usr/bin/env python3
"""Compare «Отчет» block 5 between two renders: rows changed, rows added; print key rows for every month."""
import json, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8/"
A = json.load(open(S + "rep_mn.json"))
B = json.load(open(S + "rep_p8.json"))
print("options equal:", A["options"] == B["options"], B["options"])
print("errs mn:", A["errs"], "errs p8:", B["errs"])
KEYS = ("Расход всего", "за клик", "за заказ", "Выручка заказов «за заказ»", "Окупаемость", "ДРР")
for ym in B["options"]:
    a, b = A["months"][ym], B["months"][ym]
    ra = {r[0]: r[1:] for r in a["rows"]}
    rb = {r[0]: r[1:] for r in b["rows"]}
    changed = [(k, ra[k], rb[k]) for k in ra if k in rb and ra[k] != rb[k]]
    added = [k for k in rb if k not in ra]
    removed = [k for k in ra if k not in rb]
    print(f"== {ym} head={b['h']}")
    print("   removed:", removed)
    print("   added:", [(k, rb[k]) for k in added])
    for k, x, y in changed:
        print("   CHANGED", k, x, "->", y)
    for k in rb:
        if k.startswith("Окупаемость") or k.startswith("за заказ") or k.startswith("Выручка заказов «за"):
            print("   ", k, rb[k])
    if a["note"] != b["note"]:
        print("   NOTE p8:", b["note"].replace("\n", " | ")[:900])
