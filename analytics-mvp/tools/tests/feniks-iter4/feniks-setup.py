#!/usr/bin/env python3
"""Sandboxes for FENIKS audit: main@e0ad2dc, branch@b243b28, simulated PR result (main@7837fbf + branch files)."""
import os, subprocess, sys

REPO = "/home/user/t1"
S = "/tmp/claude-0/-home-user-t1/ab784862-23d6-55b0-ac5d-13cc753c25dd/scratchpad"
NM = REPO + "/analytics-mvp/node_modules"


def extract(rev, dest):
    os.makedirs(dest, exist_ok=True)
    a = subprocess.Popen(["git", "-C", REPO, "archive", rev, "analytics-mvp"], stdout=subprocess.PIPE)
    t = subprocess.run(["tar", "-x", "-C", dest], stdin=a.stdout)
    a.wait()
    assert a.returncode == 0 and t.returncode == 0, (rev, a.returncode, t.returncode)
    link = os.path.join(dest, "analytics-mvp", "node_modules")
    if not os.path.exists(link):
        os.symlink(NM, link)
    print("extracted", rev, "->", dest)


def overlay(rev, dest, paths):
    for p in paths:
        blob = subprocess.run(["git", "-C", REPO, "show", f"{rev}:{p}"], capture_output=True)
        assert blob.returncode == 0, p
        full = os.path.join(dest, p)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as fh:
            fh.write(blob.stdout)
        print("overlay", p, len(blob.stdout))


which = sys.argv[1:]
if "main" in which:
    extract("e0ad2dc7d2407facff318a9f3da9a01ff5bfe221", S + "/feniks-main")
if "br" in which:
    extract("b243b28a71b2ac8a722d88eaab02c14a7fd773a3", S + "/feniks-br")
if "new" in which:
    extract("7837fbf0ae8a55e411c78510a65fbf5851e0fa77", S + "/feniks-new")
    mb = subprocess.run(["git", "-C", REPO, "merge-base", "7837fbf0ae8a55e411c78510a65fbf5851e0fa77", "b243b28"],
                        capture_output=True, text=True).stdout.strip()
    ch = subprocess.run(["git", "-C", REPO, "diff", "--name-only", mb, "b243b28", "--", "analytics-mvp"],
                        capture_output=True, text=True).stdout.split()
    # Make sure main did not touch those paths after mb (otherwise overlay is not a valid merge)
    mch = set(subprocess.run(["git", "-C", REPO, "diff", "--name-only", mb, "7837fbf0ae8a55e411c78510a65fbf5851e0fa77", "--", "analytics-mvp"],
                             capture_output=True, text=True).stdout.split())
    clash = [p for p in ch if p in mch]
    print("branch paths", len(ch), "clash with main changes", clash)
    overlay("b243b28", S + "/feniks-new", [p for p in ch if not p.startswith("analytics-mvp/public/")] )
