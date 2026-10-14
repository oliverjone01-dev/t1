#!/usr/bin/env python3
"""FENIKS iter6 sandboxes (git archive, no writes to the repo).
pre   = branch 3238e099 (go 8.40 state, analytics-mvp = 814a861d)
post  = branch b6cdc4b0 (audited)
mpre  = origin/main + branch 3238e099 analytics-mvp paths (diff merge-base..rev)
mpost = origin/main + branch b6cdc4b0 analytics-mvp paths
mn    = origin/main as is
mold  = older main head (argument MOLD) + branch b6cdc4b0 / 3238e099 paths -> moldpre, moldpost
"""
import os, subprocess, sys

REPO = "/home/user/t1"
S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6"
NM = REPO + "/analytics-mvp/node_modules"
PRE = "3238e0995eb1a4d1f5d3e5b7d1f2f4c0a8b6e7c9"  # resolved below
POST = "b6cdc4b0e4bd4d6deef22623812f683ed6f65061"


def rev(x):
    return subprocess.run(["git", "-C", REPO, "rev-parse", x], capture_output=True, text=True).stdout.strip()


PRE = rev("3238e099")
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
if "pre" in which:
    extract(PRE, S + "/pre")
if "post" in which:
    extract(POST, S + "/post")
if "mn" in which:
    extract(MAIN, S + "/mn")
if "mpre" in which:
    extract(MAIN, S + "/mpre")
    overlay(PRE, MAIN, S + "/mpre")
if "mpost" in which:
    extract(MAIN, S + "/mpost")
    overlay(POST, MAIN, S + "/mpost")
for w in which:
    if w.startswith("old="):
        old = rev(w[4:])
        extract(old, S + "/oldpre")
        overlay(PRE, old, S + "/oldpre")
        extract(old, S + "/oldpost")
        overlay(POST, old, S + "/oldpost")
        extract(old, S + "/oldmn")
print("PRE", PRE, "POST", POST, "MAIN", MAIN)
