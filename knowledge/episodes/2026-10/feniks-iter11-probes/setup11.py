#!/usr/bin/env python3
"""FENIKS iter11 sandboxes (git archive, no writes to the repo).
p11 = 978821206 (audited, hash 00411db3bfde9957), p10 = a06dcd948 (iter10 content), pm = origin/main d5bc74580
(analytics-mvp equal to 2fd407e17, main after #473).
usage: setup11.py p11 p10 pm | setup11.py fix <name> <rev-key-or-sha>"""
import os, subprocess, sys

REPO = "/home/user/t1"
S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11"
NM = REPO + "/analytics-mvp/node_modules"
REV = {"p11": "97882120601e7e4e9109fd7c5284395fb1697c30", "p10": "a06dcd94896cd6582191a00086e97673271008c2",
       "pm": "d5bc74580d13b0cd2e129687abc46efc8eebe8ce"}


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
    extract(REV.get(args[2], args[2]), S + "/" + args[1], ("analytics-mvp",))
else:
    for w in args:
        extract(REV[w], S + "/" + w)
