#!/usr/bin/env python3
"""FENIKS iter10: diff of whole «Отчет» text (fx10_full.mjs) fixture vs clean p10, per block and month view;
prints header flags and the first differing lines (N2 class: does a damaged input file of the page show a red mark?)."""
import difflib, json, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f10/"
base = json.load(open(S + "full_p10.json"))
for sb in sys.argv[1:] or ["fzS", "fzT", "fzV"]:
    x = json.load(open(S + f"full_{sb}.json"))
    for ym in ("2026-09", "2026-08"):
        a, b = base["months"][ym], x["months"][ym]
        diffs = {k: [l for l in difflib.unified_diff(a[k].split("\n"), b[k].split("\n"), lineterm="", n=0) if l[:1] in "+-" and not l.startswith(("---", "+++"))] for k in a}
        ch = {k: len(v) for k, v in diffs.items() if v}
        print(f"{sb} {ym}: JS err {len(x['errs'])} | changed lines per block {ch} | red mark «повреждены» in flags: {'повреждены' in b['rp-flags']}")
        for k, v in diffs.items():
            for l in v[:4]:
                print(f"    {k}: {l[:200]}")
