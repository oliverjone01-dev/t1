#!/usr/bin/env python3
"""FENIKS iter7: lines added by both sides (vs base) whose merged count is below the sum of additions.
usage: merge7b.py <path> <ours> <theirs> <merged>"""
import collections, subprocess, sys

REPO = "/home/user/t1"
path, ours, theirs, merged = sys.argv[1:5]


def lines(rev):
    return subprocess.run(["git", "-C", REPO, "show", f"{rev}:{path}"], capture_output=True).stdout.decode("utf-8").split("\n")


base = subprocess.run(["git", "-C", REPO, "merge-base", ours, theirs], capture_output=True, text=True).stdout.strip()
cB, cO, cT, cM = (collections.Counter(lines(r)) for r in (base, ours, theirs, merged))
for l in set(cO) | set(cT):
    ao, at, am = max(cO[l] - cB[l], 0), max(cT[l] - cB[l], 0), max(cM[l] - cB[l], 0)
    if ao and at and am < ao + at:
        print(repr(l[:200]), "base", cB[l], "ours", cO[l], "theirs", cT[l], "merged", cM[l])
