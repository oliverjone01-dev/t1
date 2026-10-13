#!/usr/bin/env python3
"""FENIKS iter7: titles of the CPO rows and ИТОГО rows from the sweep (A vs B) for selected periods.
usage: titles7.py <sweep.jsonl> A B f:t ..."""
import json, sys

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i7/"
fn, A, B = sys.argv[1:4]
want = set(tuple(x.split(":")) for x in sys.argv[4:])
tot_same = tot_diff = 0
for l in open(S + fn):
    r = json.loads(l)
    if r[A]["tot"] == r[B]["tot"]:
        tot_same += 1
    else:
        tot_diff += 1
        print("TOT DIFF", r["f"], r["t"], r[A]["tot"], r[B]["tot"])
    if (r["f"], r["t"]) in want:
        for i, c in r[A]["cpo"].items():
            print(r["f"], r["t"], i, c["cells"][3:7], "| rev:", c["revTitle"][:160], "| drr:", c["drrTitle"][:400])
        print("   src1:", r[A]["src1"][:300])
print("ИТОГО same", tot_same, "diff", tot_diff)
