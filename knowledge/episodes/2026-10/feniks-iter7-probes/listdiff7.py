#!/usr/bin/env python3
"""FENIKS iter7: list files in public/ that differ between two sources (sandbox name in i7, or git:<rev>).
Fast: blob hashes for git, sha1 for files. usage: listdiff7.py <A> <B>"""
import hashlib, os, subprocess, sys

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i7"
REPO = "/home/user/t1"


def gitblob(data):
    h = hashlib.sha1()
    h.update(b"blob %d\0" % len(data))
    h.update(data)
    return h.hexdigest()


def index(src):
    if src.startswith("git:"):
        out = subprocess.run(["git", "-C", REPO, "ls-tree", "-r", src[4:], "analytics-mvp/public"], capture_output=True, text=True).stdout.splitlines()
        res = {}
        for ln in out:
            meta, p = ln.split("\t", 1)
            res[p[len("analytics-mvp/public/"):]] = meta.split()[2]
        return res
    root = f"{S}/{src}/analytics-mvp/public"
    res = {}
    for dp, dn, fn in os.walk(root):
        for f in fn:
            full = os.path.join(dp, f)
            res[os.path.relpath(full, root)] = gitblob(open(full, "rb").read())
    return res


A, B = sys.argv[1], sys.argv[2]
ia, ib = index(A), index(B)
common = set(ia) & set(ib)
diff = sorted(p for p in common if ia[p] != ib[p])
print(f"{A} vs {B}: common {len(common)}, same {len(common) - len(diff)}, differ {len(diff)}, only A {len(set(ia) - set(ib))}, only B {len(set(ib) - set(ia))}")
for p in sorted(set(ia) - set(ib))[:15]:
    print("  only A:", p)
for p in sorted(set(ib) - set(ia))[:15]:
    print("  only B:", p)
for p in diff:
    print("  DIFF", p)
