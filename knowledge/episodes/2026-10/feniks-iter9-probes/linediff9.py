#!/usr/bin/env python3
"""Line diff of one public file between two sandboxes; for each changed line pair trims the common prefix/suffix and
prints the differing middle with context. Long lines (REP JSON) are split on ',' to localize changes.
usage: linediff9.py <sbA> <sbB> <file>"""
import difflib, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9/"
A, B, F = sys.argv[1:4]
la = open(S + A + "/analytics-mvp/public/" + F, encoding="utf-8").read().split("\n")
lb = open(S + B + "/analytics-mvp/public/" + F, encoding="utf-8").read().split("\n")


def mid(x, y):
    p = 0
    while p < min(len(x), len(y)) and x[p] == y[p]:
        p += 1
    s = 0
    while s < min(len(x), len(y)) - p and x[len(x) - 1 - s] == y[len(y) - 1 - s]:
        s += 1
    return p, x[p:len(x) - s], y[p:len(y) - s]


sm = difflib.SequenceMatcher(None, la, lb, autojunk=False)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == "equal":
        continue
    print(f"== {tag} A lines {i1}-{i2} B lines {j1}-{j2}")
    if tag == "replace" and (i2 - i1) == (j2 - j1):
        for x, y in zip(la[i1:i2], lb[j1:j2]):
            if len(x) > 5000:
                ta, tb = x.split(","), y.split(",")
                for t2, a1, a2, b1, b2 in difflib.SequenceMatcher(None, ta, tb, autojunk=False).get_opcodes():
                    if t2 != "equal":
                        print(f"   tok {t2}: A[{a1}:{a2}]={','.join(ta[a1:a2])[:200]!r} B[{b1}:{b2}]={','.join(tb[b1:b2])[:200]!r}")
            else:
                p, mx, my = mid(x, y)
                print("   ctx:", repr(x[max(0, p - 100):p]))
                print("   A  :", repr(mx[:500]))
                print("   B  :", repr(my[:500]))
    else:
        for x in la[i1:i2]:
            print("   A-:", repr(x[:400]))
        for y in lb[j1:j2]:
            print("   B+:", repr(y[:400]))
