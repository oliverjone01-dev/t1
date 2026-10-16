#!/usr/bin/env python3
"""FENIKS iter9 sandboxes (git archive, no writes to the repo).
p9 = branch head 9ef5e2d3e (audited, hash 910f56546a9e75df)
p8 = d07567852 (iter8 audited content, hash 3bb00f94c5e5a234)
fixtures: fzA..fzK = copies of p9 (code 9ef5e2d3e) with modified data; fzXo = same fixture on p8 code (old) where needed.
usage: setup9.py p9 p8 | setup9.py fix <name> <rev>"""
import os, subprocess, sys

REPO = "/home/user/t1"
S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9"
NM = REPO + "/analytics-mvp/node_modules"
REV = {"p9": "9ef5e2d3e69023bd1932a16825b43fa622209f16", "p8": "d07567852"}


def rev(x):
    return subprocess.run(["git", "-C", REPO, "rev-parse", x], capture_output=True, text=True).stdout.strip()


def extract(r, dest, paths=("analytics-mvp", ".github")):
    os.makedirs(dest, exist_ok=True)
    a = subprocess.Popen(["git", "-C", REPO, "archive", r, *paths], stdout=subprocess.PIPE)
    t = subprocess.run(["tar", "-x", "-C", dest], stdin=a.stdout)
    a.wait()
    assert a.returncode == 0 and t.returncode == 0, (r, a.returncode, t.returncode)
    link = os.path.join(dest, "analytics-mvp", "node_modules")
    if not os.path.lexists(link):
        os.symlink(NM, link)
    print("extracted", r[:10], "->", dest)


args = sys.argv[1:]
if args and args[0] == "fix":
    extract(rev(REV.get(args[2], args[2])), S + "/" + args[1], ("analytics-mvp",))
else:
    for w in args:
        extract(rev(REV[w]), S + "/" + w)
