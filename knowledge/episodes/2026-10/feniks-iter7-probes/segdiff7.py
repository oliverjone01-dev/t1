#!/usr/bin/env python3
"""FENIKS iter7: classify differences of one public file between two sources.
Splits text at '>' and ';' to short segments, runs difflib on segments (fast), prints changed segments
and a classification: TIME (only digits of time/date changed), NAV (segment mentions katya-reklama-kartochki), OTHER.
usage: segdiff7.py <A> <B> <rel> [--max N]"""
import difflib, re, subprocess, sys, os

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i7"
REPO = "/home/user/t1"
A, B, rel = sys.argv[1:4]
MAX = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 6


def read(src):
    if src.startswith("git:"):
        return subprocess.run(["git", "-C", REPO, "show", f"{src[4:]}:analytics-mvp/public/{rel}"], capture_output=True).stdout.decode("utf-8", "replace")
    return open(f"{S}/{src}/analytics-mvp/public/{rel}", encoding="utf-8", errors="replace").read()


def seg(t):
    return re.split(r"(?<=[>;])", t)


x, y = seg(read(A)), seg(read(B))
sm = difflib.SequenceMatcher(None, x, y, autojunk=False)
cls = {"TIME": 0, "NAV": 0, "OTHER": 0}
shown = 0
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == "equal":
        continue
    a, b = "".join(x[i1:i2]), "".join(y[j1:j2])
    if re.sub(r"\d", "0", a) == re.sub(r"\d", "0", b):
        c = "TIME"
    elif "kartochki" in a + b or "Реклама по карточкам" in a + b:
        c = "NAV"
    else:
        c = "OTHER"
    cls[c] += 1
    if c != "TIME" or shown < 2:
        if shown < MAX:
            print(f"  [{c}] {tag}: {a[:220]!r}\n        -> {b[:220]!r}")
            shown += 1
print(rel, cls)
