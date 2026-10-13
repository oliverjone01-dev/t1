#!/usr/bin/env python3
"""FENIKS iter7 sandboxes (git archive, no writes to the repo).
p7   = branch head e60d0dfa2 (audited)
mn   = origin/main 9eb7309bc as is
b6m  = origin/main + branch b6cdc4b0 analytics-mvp paths (old code, iter6 go state, on main data)
p5m  = origin/main + branch 5229fd9e2 analytics-mvp paths (N5/N6 commit before the merge, on main data)
"""
import os, subprocess, sys

REPO = "/home/user/t1"
S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i7"
NM = REPO + "/analytics-mvp/node_modules"


def rev(x):
    return subprocess.run(["git", "-C", REPO, "rev-parse", x], capture_output=True, text=True).stdout.strip()


HEAD = rev("e60d0dfa2")
MAIN = rev("origin/main")


def extract(r, dest):
    os.makedirs(dest, exist_ok=True)
    a = subprocess.Popen(["git", "-C", REPO, "archive", r, "analytics-mvp"], stdout=subprocess.PIPE)
    t = subprocess.run(["tar", "-x", "-C", dest], stdin=a.stdout)
    a.wait()
    assert a.returncode == 0 and t.returncode == 0, (r, a.returncode, t.returncode)
    link = os.path.join(dest, "analytics-mvp", "node_modules")
    if not os.path.exists(link):
        os.symlink(NM, link)
    print("extracted", r[:10], "->", dest)


def overlay(br, base_main, dest):
    mb = subprocess.run(["git", "-C", REPO, "merge-base", base_main, br], capture_output=True, text=True).stdout.strip()
    st = subprocess.run(["git", "-C", REPO, "diff", "--name-status", "--no-renames", mb, br, "--", "analytics-mvp"], capture_output=True, text=True).stdout.splitlines()
    mch = set(subprocess.run(["git", "-C", REPO, "diff", "--name-only", mb, base_main, "--", "analytics-mvp"], capture_output=True, text=True).stdout.split())
    clash, n_add, n_del = [], 0, 0
    for ln in st:
        code, p = ln.split("\t", 1)
        if p in mch:
            clash.append(p)
            continue
        full = os.path.join(dest, p)
        if code == "D":
            if os.path.exists(full):
                os.remove(full)
                n_del += 1
            continue
        blob = subprocess.run(["git", "-C", REPO, "show", f"{br}:{p}"], capture_output=True)
        assert blob.returncode == 0, p
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as fh:
            fh.write(blob.stdout)
        n_add += 1
    print("overlay", br[:10], "on", base_main[:10], "mb", mb[:10], "written", n_add, "deleted", n_del, "clash", clash)


which = sys.argv[1:]
if "p7" in which:
    extract(HEAD, S + "/p7")
if "mn" in which:
    extract(MAIN, S + "/mn")
if "b6m" in which:
    extract(MAIN, S + "/b6m")
    overlay(rev("b6cdc4b0"), MAIN, S + "/b6m")
if "p5m" in which:
    extract(MAIN, S + "/p5m")
    overlay(rev("5229fd9e2"), MAIN, S + "/p5m")
print("HEAD", HEAD, "MAIN", MAIN)
