#!/usr/bin/env python3
"""FENIKS iter5 sandboxes: br = branch 814a861d; mg = origin/main 9839714e + branch non-public analytics-mvp files."""
import os, subprocess, sys

REPO = "/home/user/t1"
S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad"
NM = REPO + "/analytics-mvp/node_modules"
BR = "814a861d0b60d2234cb76b2633eddf5a8d709d5b"
MAIN = subprocess.run(["git", "-C", REPO, "rev-parse", "origin/main"], capture_output=True, text=True).stdout.strip()


def extract(rev, dest):
    os.makedirs(dest, exist_ok=True)
    a = subprocess.Popen(["git", "-C", REPO, "archive", rev, "analytics-mvp"], stdout=subprocess.PIPE)
    t = subprocess.run(["tar", "-x", "-C", dest], stdin=a.stdout)
    a.wait()
    assert a.returncode == 0 and t.returncode == 0, (rev, a.returncode, t.returncode)
    link = os.path.join(dest, "analytics-mvp", "node_modules")
    if not os.path.exists(link):
        os.symlink(NM, link)
    print("extracted", rev[:10], "->", dest)


def overlay(rev, dest, paths):
    for p in paths:
        blob = subprocess.run(["git", "-C", REPO, "show", f"{rev}:{p}"], capture_output=True)
        assert blob.returncode == 0, p
        full = os.path.join(dest, p)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as fh:
            fh.write(blob.stdout)
    print("overlay", len(paths), "files from", rev[:10])


which = sys.argv[1:]
if "br" in which:
    extract(BR, S + "/br")
if "mg" in which:
    extract(MAIN, S + "/mg")
    mb = subprocess.run(["git", "-C", REPO, "merge-base", MAIN, BR], capture_output=True, text=True).stdout.strip()
    ch = subprocess.run(["git", "-C", REPO, "diff", "--name-only", mb, BR, "--", "analytics-mvp"], capture_output=True, text=True).stdout.split()
    mch = set(subprocess.run(["git", "-C", REPO, "diff", "--name-only", mb, MAIN, "--", "analytics-mvp"], capture_output=True, text=True).stdout.split())
    clash = [p for p in ch if p in mch]
    print("main", MAIN[:10], "mb", mb[:10], "branch paths", len(ch), "clash", clash)
    overlay(BR, S + "/mg", [p for p in ch if p not in mch])
if "mn" in which:
    extract(MAIN, S + "/mn")
