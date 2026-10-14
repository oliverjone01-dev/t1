#!/usr/bin/env python3
"""Compare every built page A vs B sandbox; for differing pages show the diff after removing the nav button and timestamp."""
import os, re, sys
S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad"
A, B = sys.argv[1], sys.argv[2]
pa, pb = f"{S}/{A}/analytics-mvp/public", f"{S}/{B}/analytics-mvp/public"
TS = re.compile(rb"\d\d\.\d\d\.\d{4} \d\d:\d\d( \xd0\x9c\xd0\xa1\xd0\x9a)?")
BTN = re.compile(rb'<a [^>]*href="katya-reklama-kartochki\.html"[^>]*>.*?</a>')


def pages(root):
    out = {}
    for sub in ("", "market"):
        d = os.path.join(root, sub)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith(".html"):
                out[os.path.join(sub, f)] = TS.sub(b"TS", open(os.path.join(d, f), "rb").read())
    return out


def pdiff(x, y):
    i, n = 0, min(len(x), len(y))
    while i < n and x[i] == y[i]:
        i += 1
    j = 0
    while j < n - i and x[len(x) - 1 - j] == y[len(y) - 1 - j]:
        j += 1
    return i, len(x) - j, len(y) - j


a, b = pages(pa), pages(pb)
print("pages", A, len(a), B, len(b), "only in A", sorted(set(a) - set(b)), "only in B", sorted(set(b) - set(a)))
same, diff = [], []
for k in sorted(set(a) & set(b)):
    (same if a[k] == b[k] else diff).append(k)
print("byte-equal (timestamps masked)", len(same), "differ", len(diff))
for k in diff:
    x, y = a[k], b[k]
    y2 = BTN.sub(b"", y)
    eq = x == y2
    print(f"  {k}: {len(x)} -> {len(y)}, button A={len(BTN.findall(x))} B={len(BTN.findall(y))}, equal after removing button: {eq}")
    if not eq:
        i, ex, ey = pdiff(x, y2)
        print("     span A", ex - i, "B", ey - i, "at", i, "A:", repr(x[max(0, i - 80):min(ex, i + 160)][:300]))
        print("     B:", repr(y2[max(0, i - 80):min(ey, i + 160)][:300]))
