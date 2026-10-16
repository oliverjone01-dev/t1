#!/usr/bin/env python3
"""Print tab CPO rows per period for p8 and fixtures; report block-5 key rows for June/Sep views."""
import json

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8/"
for sb in ("p8", "fzA", "fzC", "fzD"):
    print(f"######## TAB {sb}")
    for l in open(S + f"rows_{sb}.jsonl", encoding="utf-8"):
        r = json.loads(l)
        print(f"  {r['f']}..{r['t']} errs={len(r['errs'])}")
        for cid, v in r["out"].items():
            print(f"     {cid}: {v['cells']} | rev: {v['revTitle'][:40]!r} | drr: {v['drrTitle'][:150]!r}")
        print("     src:", r["src"][-160:])
KEYR = ("за заказ", "за заказ по выгрузке кабинета (списания по дате заказа)", "Выручка заказов «за заказ»",
        "Окупаемость «за заказ» (к списаниям выгрузки), ₽ на 1 ₽", "Окупаемость всего (к расходу за клик и списаниям выгрузки), ₽ на 1 ₽")
for sb in ("p8", "fzA", "fzC", "fzD"):
    R = json.load(open(S + f"rep_{sb}.json"))
    print(f"######## REPORT {sb} errs={R['errs']}")
    for ym in ("2026-09", "2026-06"):
        m = R["months"][ym]
        rows = {x[0]: x[1:] for x in m["rows"]}
        print(f"  view {ym} cols={m['h'][1:]}")
        for k in KEYR:
            print(f"     {k[:40]:40s} {rows.get(k)}")
        print("     note1:", m["note"].split("\n")[0][:220])
