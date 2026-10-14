#!/usr/bin/env python3
"""FENIKS iter9 «Отчет» block 5 analysis.
1) p8 vs p9 (same data): every changed cell in every month view.
2) fixtures: per month view, the CPO rows for the two main columns + red banner; flags LEAK when a red banner says «нет данных»
   but a CPO export row (по выгрузке / выручка «за заказ» / окупаемость «за заказ» / всего) shows a number."""
import json, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9/"
EXP = ("за заказ по выгрузке кабинета (списания по дате заказа)", "Выручка заказов «за заказ»",
       "Окупаемость «за заказ» (к списаниям выгрузки), ₽ на 1 ₽", "Окупаемость всего (к расходу за клик и списаниям выгрузки), ₽ на 1 ₽")


def load(sb):
    return json.load(open(S + f"rep_{sb}.json"))


A, B = load("p8"), load("p9")
print("options equal:", A["options"] == B["options"], B["options"])
print("errs p8:", A["errs"], "errs p9:", B["errs"])
nchg = 0
for ym in B["options"]:
    a, b = A["months"][ym], B["months"][ym]
    ra = {r[0]: r[1:] for r in a["rows"]}
    rb = {r[0]: r[1:] for r in b["rows"]}
    if a["h"] != b["h"]:
        print("HEAD CHANGED", ym)
    for k in rb:
        if ra.get(k) != rb[k]:
            nchg += 1
            print(f"  {ym} CHANGED {k[:60]}: {ra.get(k)} -> {rb[k]}")
    if a["note"] != b["note"]:
        print(f"  {ym} NOTE CHANGED")
print("p8->p9 changed rows total:", nchg)
print("p9 key rows, view 2026-09 (cols:", B["months"]["2026-09"]["h"][1:], ")")
for k in EXP:
    print("   ", k[:45], {r[0]: r[1:] for r in B["months"]["2026-09"]["rows"]}.get(k))

for sb in sys.argv[1:]:
    R = load(sb)
    print(f"######## {sb} errs={R['errs']}")
    leaks = []
    for ym in R["options"]:
        m = R["months"][ym]
        rows = {x[0]: x[1:] for x in m["rows"]}
        h = m["h"]
        # columns: [Показатель, retro..., prev, cur, Отклонение, %]; take every month column (retro + prev + cur)
        ncol = len(h) - 3  # minus label, Отклонение, %
        for k in EXP:
            vals = rows.get(k, [])[:ncol]
            for name, v in zip(h[1:1 + ncol], vals):
                if m["red"] and v not in ("нет данных", "\u2014", ""):
                    leaks.append((ym, name, k[:40], v))
    red = R["months"][R["options"][-1]]["red"]
    print("   red banner (last view):", red[:1])
    seen = set()
    for x in leaks:
        key = (x[1], x[2], x[3])
        if key in seen:
            continue
        seen.add(key)
        print("   LEAK", x)
    print("   leaks (unique month/row/value):", len(seen))
    m = R["months"]["2026-09"]
    rows = {x[0]: x[1:] for x in m["rows"]}
    print("   view 2026-09 cols", m["h"][1:-2])
    for k in ("за заказ",) + EXP:
        print("     ", k[:45], rows.get(k))
