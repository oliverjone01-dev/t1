#!/usr/bin/env python3
"""FENIKS iter9 tab «Реклама по карточкам»: CPO rows per period; p8 vs p9 equality; fixtures with red spans and source line."""
import json, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9/"


def load(sb):
    return [json.loads(l) for l in open(S + f"rows_{sb}.jsonl", encoding="utf-8")]


a, b = load("p8"), load("p9")
eq = [(x["f"], x["t"], x["out"] == y["out"], x["src"] == y["src"]) for x, y in zip(a, b)]
print("p8 vs p9 per period (rows equal, src equal):", eq)
print("p9 errs:", [x["errs"] for x in b if x["errs"]], "red spans p9:", sum(len(x["allRed"]) for x in b))
for sb in sys.argv[1:]:
    print(f"######## {sb}")
    for r in load(sb):
        print(f"  {r['f']}..{r['t']} errs={r['errs']} red_in_top={len(r['red'])} red_all={len(r['allRed'])}")
        for cid, v in r["out"].items():
            print(f"     {cid}: {v['cells']} | rev: {v['revTitle'][:40]!r} | drr: {v['drrTitle'][:160]!r}")
        if r["allRed"]:
            print("     RED:", r["allRed"][0][:200])
        print("     src:", r["src"][-260:].replace("\n", " "))
