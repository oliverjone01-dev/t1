#!/usr/bin/env python3
"""FENIKS iter7: cells of given campaign rows from the sweep for given periods. usage: camp7.py <sweep.jsonl> <sandbox> <id> f:t ..."""
import json, sys

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i7/"
fn, sb, cid, *per = sys.argv[1:]
want = set(tuple(x.split(":")) for x in per)
for l in open(S + fn):
    r = json.loads(l)
    if (r["f"], r["t"]) in want:
        print(r["f"], r["t"], cid, r[sb]["camps"].get(cid, [None])[:7])
