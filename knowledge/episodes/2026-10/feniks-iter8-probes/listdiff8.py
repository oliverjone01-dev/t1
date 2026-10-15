#!/usr/bin/env python3
"""Compare build outputs of two sandboxes (public/ tree), ignoring the 'обновлено' timestamp line."""
import os, re, sys, hashlib, difflib

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8"
A, B = sys.argv[1], sys.argv[2]
pa, pb = f"{S}/{A}/analytics-mvp/public", f"{S}/{B}/analytics-mvp/public"
TS = re.compile(r"(обновлено|updated|generated|сборка)[^<\"]{0,60}\d{2}[.:]\d{2}[^<\"]{0,40}", re.I)
TS2 = re.compile(r"20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z?")


def files(root):
    out = {}
    for dp, _, fs in os.walk(root):
        for f in fs:
            p = os.path.join(dp, f)
            out[os.path.relpath(p, root)] = p
    return out


fa, fb = files(pa), files(pb)
same = diff = 0
diffs = []
for k in sorted(set(fa) | set(fb)):
    if k not in fa or k not in fb:
        print("ONLY", "A" if k in fa else "B", k)
        continue
    x, y = open(fa[k], "rb").read(), open(fb[k], "rb").read()
    if x == y:
        same += 1
        continue
    xs, ys = x.decode("utf-8", "replace"), y.decode("utf-8", "replace")
    xn, yn = TS2.sub("T", TS.sub("TS", xs)), TS2.sub("T", TS.sub("TS", ys))
    if xn == yn:
        same += 1
        print("TS-only", k)
        continue
    diff += 1
    diffs.append(k)
print("same", same, "diff", diff)
for k in diffs:
    print("DIFF", k)
