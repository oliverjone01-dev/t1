#!/usr/bin/env python3
"""FENIKS iter11, class N2 acceptance by class, not by example: for every ndjson file of the OZON build, a copy of p11
where ONE REAL record (the September-2026 line closest to the middle of the file) is cut to its first half - the record is
lost, as in a torn write. Then: build, and every page whose content differs from p11 must carry the red mark (pages11.py).
usage: fzcls11.py make <file>...   (sandbox name c_<file stem>)"""
import os, shutil, subprocess, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11/"
P11 = "97882120601e7e4e9109fd7c5284395fb1697c30"
NM = "/home/user/t1/analytics-mvp/node_modules"

for f in sys.argv[2:]:
    sb = "c_" + f.replace(".ndjson", "")
    dest = S + sb
    if os.path.exists(dest):
        shutil.rmtree(dest)
    os.makedirs(dest)
    a = subprocess.Popen(["git", "-C", "/home/user/t1", "archive", P11, "analytics-mvp"], stdout=subprocess.PIPE)
    subprocess.run(["tar", "-x", "-C", dest], stdin=a.stdout, check=True)
    a.wait()
    os.symlink(NM, dest + "/analytics-mvp/node_modules")
    p = dest + "/analytics-mvp/data/" + f
    lines = open(p, encoding="utf-8").read().split("\n")
    mid = len(lines) // 2
    cand = [i for i, l in enumerate(lines) if '"2026-09' in l] or [i for i, l in enumerate(lines) if l.strip()]
    i = min(cand, key=lambda k: abs(k - mid))
    lines[i] = lines[i][: len(lines[i]) // 2]
    open(p, "w", encoding="utf-8").write("\n".join(lines))
    print(sb, f, "line", i + 1, "of", len(lines), "cut to", repr(lines[i][:70]))
