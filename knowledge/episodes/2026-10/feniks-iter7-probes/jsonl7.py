#!/usr/bin/env python3
"""FENIKS iter7: merged traces jsonl - every line of both sides present, duplicates within one side, parse check.
usage: jsonl7.py <ours> <theirs> <merged> <path> ..."""
import collections, json, subprocess, sys

REPO = "/home/user/t1"
ours, theirs, merged, *paths = sys.argv[1:]


def lines(rev, p):
    r = subprocess.run(["git", "-C", REPO, "show", f"{rev}:{p}"], capture_output=True)
    return [l for l in r.stdout.decode("utf-8").split("\n") if l.strip()] if r.returncode == 0 else []


for p in paths:
    O, T, M = lines(ours, p), lines(theirs, p), lines(merged, p)
    cO, cT, cM = collections.Counter(O), collections.Counter(T), collections.Counter(M)
    miss_o = [l for l in cO if l not in cM]
    miss_t = [l for l in cT if l not in cM]
    foreign = [l for l in cM if l not in cO and l not in cT]
    dup_in_side = {"ours": sum(n - 1 for n in cO.values() if n > 1), "theirs": sum(n - 1 for n in cT.values() if n > 1), "merged": sum(n - 1 for n in cM.values() if n > 1)}
    bad = 0
    for l in M:
        try:
            json.loads(l)
        except Exception:
            bad += 1
    # lines whose multiplicity in merged is below max multiplicity in a side (legit repeated lines collapsed)
    collapsed = [(l[:100], cO[l], cT[l], cM[l]) for l in set(cO) | set(cT) if cM[l] < max(cO[l], cT[l])]
    print(f"{p}: ours {len(O)} theirs {len(T)} merged {len(M)} unique(ours|theirs) {len(set(O) | set(T))}; missing ours {len(miss_o)} theirs {len(miss_t)} foreign {len(foreign)} unparsable {bad}; dups {dup_in_side}; collapsed {len(collapsed)}")
    for c in collapsed[:3]:
        print("   collapsed", c)
