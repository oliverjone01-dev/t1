#!/usr/bin/env python3
"""Compare all files of public/ between two sandboxes; for differing html print the differing lines (first 300 chars each).
usage: listdiff9.py <sbA> <sbB>"""
import difflib, filecmp, os, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11/"
A, B = sys.argv[1], sys.argv[2]
pa, pb = S + A + "/analytics-mvp/public", S + B + "/analytics-mvp/public"


def walk(p):
    out = set()
    for root, _, files in os.walk(p):
        for f in files:
            out.add(os.path.relpath(os.path.join(root, f), p))
    return out


fa, fb = walk(pa), walk(pb)
same, diff = [], []
for f in sorted(fa & fb):
    (same if filecmp.cmp(os.path.join(pa, f), os.path.join(pb, f), shallow=False) else diff).append(f)
print(f"only {A}:", sorted(fa - fb), f"only {B}:", sorted(fb - fa))
print(f"same {len(same)} diff {len(diff)}:", diff)
for f in diff:
    if not f.endswith(".html"):
        continue
    la = open(os.path.join(pa, f), encoding="utf-8").read().split("\n")
    lb = open(os.path.join(pb, f), encoding="utf-8").read().split("\n")
    n = 0
    for op in difflib.unified_diff(la, lb, lineterm="", n=0):
        if op.startswith(("---", "+++", "@@")):
            continue
        n += 1
        if n <= 12:
            # show only the region around the first difference inside the long line
            print(f"  {f}: {op[:1]} len={len(op)}")
    print(f"  {f}: {n} changed lines")
