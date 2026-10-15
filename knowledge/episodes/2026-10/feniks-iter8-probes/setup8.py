#!/usr/bin/env python3
"""FENIKS iter8 sandboxes (git archive, no writes to the repo).
p8 = branch head (audited, 42db22195)
mn = origin/main 51acead0e (before)
"""
import os, subprocess, sys

REPO = "/home/user/t1"
S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8"
NM = REPO + "/analytics-mvp/node_modules"


def rev(x):
    return subprocess.run(["git", "-C", REPO, "rev-parse", x], capture_output=True, text=True).stdout.strip()


def extract(r, dest):
    os.makedirs(dest, exist_ok=True)
    a = subprocess.Popen(["git", "-C", REPO, "archive", r, "analytics-mvp", ".github"], stdout=subprocess.PIPE)
    t = subprocess.run(["tar", "-x", "-C", dest], stdin=a.stdout)
    a.wait()
    assert a.returncode == 0 and t.returncode == 0, (r, a.returncode, t.returncode)
    link = os.path.join(dest, "analytics-mvp", "node_modules")
    if not os.path.exists(link):
        os.symlink(NM, link)
    print("extracted", r[:10], "->", dest)


which = sys.argv[1:]
HEAD = rev("42db22195")
MAIN = rev("origin/main")
if "p8" in which:
    extract(HEAD, S + "/p8")
if "mn" in which:
    extract(MAIN, S + "/mn")
print("HEAD", HEAD, "MAIN", MAIN)
