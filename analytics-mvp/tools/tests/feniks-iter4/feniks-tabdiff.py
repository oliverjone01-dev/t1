#!/usr/bin/env python3
import subprocess, sys
S = "/tmp/claude-0/-home-user-t1/ab784862-23d6-55b0-ac5d-13cc753c25dd/scratchpad"
mine = open(S + "/feniks-br/analytics-mvp/public/katya-reklama-kartochki.html", "rb").read()
wt = open("/home/user/t1/analytics-mvp/public/katya-reklama-kartochki.html", "rb").read()
com = subprocess.run(["git", "-C", "/home/user/t1", "show", "b243b28:analytics-mvp/public/katya-reklama-kartochki.html"], capture_output=True).stdout


def spans(x, y, maxn=12):
    """list differing spans via line diff (lines are long but few)."""
    import difflib
    xl, yl = x.split(b"\n"), y.split(b"\n")
    out = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, xl, yl, autojunk=False).get_opcodes():
        if tag == "equal":
            continue
        for a, b in zip(xl[i1:i2], yl[j1:j2]):
            # character-level prefix/suffix
            p = 0
            while p < min(len(a), len(b)) and a[p] == b[p]:
                p += 1
            q = 0
            while q < min(len(a), len(b)) - p and a[-1 - q] == b[-1 - q]:
                q += 1
            out.append((i1, a[max(0, p - 60):len(a) - q + 60][:300], b[max(0, p - 60):len(b) - q + 60][:300]))
        if (i2 - i1) != (j2 - j1):
            out.append(("linecount", i2 - i1, j2 - j1))
        if len(out) >= maxn:
            break
    return out


for name, other in (("worktree", wt), ("committed b243b28", com)):
    print("=== mine vs", name, len(mine), len(other))
    for s in spans(mine, other):
        print("  ", s)
