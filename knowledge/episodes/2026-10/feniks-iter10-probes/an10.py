#!/usr/bin/env python3
"""FENIKS iter10: analysis of rep_<sb>.json (fx10_report.mjs) and rows_<sb>.jsonl (fx10_rows.mjs).
A1 p10 vs p9m: every month view of «Отчет» block 5 (table + note) and every tab period equal?
A2 per fixture, view 2026-09: the 16 export cells (June-Sep x 4 rows) - which months show a number; red / yellow notes; header flags.
A3 tab per fixture and period: 28753239 cells, red / yellow spans, «н/д» titles."""
import json, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f10/"
EXP = ("за заказ по выгрузке кабинета (списания по дате заказа)", "Выручка заказов «за заказ»",
       "Окупаемость «за заказ» (к списаниям выгрузки), ₽ на 1 ₽", "Окупаемость всего (к расходу за клик и списаниям выгрузки), ₽ на 1 ₽")
MON = ("июнь 2026", "июль 2026", "август 2026", "сентябрь 2026")
EMPTY = ("нет данных", "—", "")
sbs = sys.argv[1:] or ["p10", "p9m", "fzA", "fzB", "fzC", "fzD", "fzE", "fzF", "fzG", "fzH", "fzI", "fzJ", "fzK"]
rep = {sb: json.load(open(S + f"rep_{sb}.json")) for sb in sbs}
rows = {sb: [json.loads(l) for l in open(S + f"rows_{sb}.jsonl")] for sb in sbs}
if "p10" in rep and "p9m" in rep:
    a, b = rep["p10"], rep["p9m"]
    dm = [ym for ym in a["months"] if (a["months"][ym] or {}).get("rows") != (b["months"].get(ym) or {}).get("rows")]
    dn = [ym for ym in a["months"] if (a["months"][ym] or {}).get("note") != (b["months"].get(ym) or {}).get("note")]
    df = [ym for ym in a["months"] if (a["months"][ym] or {}).get("flags") != (b["months"].get(ym) or {}).get("flags")]
    print("A1 «Отчет» views", len(a["months"]), "| table differs in", dm, "| note differs in", dn, "| flags differ in", df, "| JS errors", a["errs"], b["errs"])
    pr = [(x["f"], x["t"]) for x, y in zip(rows["p10"], rows["p9m"]) if {k: x[k] for k in ("out", "src", "red")} != {k: y[k] for k in ("out", "src", "red")}]
    print("A1 tab periods", len(rows["p10"]), "| differ:", pr, "| JS errors", sum(len(x["errs"]) for x in rows["p10"]))
for sb in sbs:
    m = rep[sb]["months"].get("2026-09")
    if not m:
        print(sb, "no 2026-09 view")
        continue
    h, rr = m["h"], {x[0]: x[1:] for x in m["rows"]}
    shown = {mo: sum(1 for k in EXP if k in rr and rr[k][h[1:].index(mo)] not in EMPTY) for mo in MON}
    tot = rr.get(EXP[3], [])
    print(f"A2 {sb}: cells with a number per month {shown} | всего: {dict(zip(h[1:], tot))} | red {len(m['red'])} yellow {len(m['yel'])} | JS err {len(rep[sb]['errs'])}")
    for t in m["red"] + m["yel"]:
        print("     note:", t[:260])
    if "повреждены" in m["flags"] or sb == "fzK":
        print("     flags:", [l for l in m["flags"].split("\n") if "поврежд" in l][:2])
for sb in sbs:
    for x in rows[sb]:
        c = x["out"].get("28753239", {})
        if sb in ("p10",) or x["red"] or x["yel"] or x.get("na") and any(x["na"]):
            print(f"A3 {sb} {x['f']}..{x['t']}: 28753239 {c.get('cells')} | red {len(x['red'])} yel {len(x['yel'])} na-title {sum(len(n) for n in (x.get('na') or []))}"
                  + (f" | {x['yel'][0][:200]}" if x["yel"] else "") + (f" | {x['red'][0][:120]}" if x["red"] else ""))
