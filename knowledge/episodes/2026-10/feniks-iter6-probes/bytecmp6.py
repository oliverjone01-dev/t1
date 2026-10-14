#!/usr/bin/env python3
"""Compare built pages of sandbox A vs B (timestamps masked); for differing pages report whether the diff is only the nav button.
usage: bytecmp6.py A B [--raw]   (--raw: no timestamp masking, report exact byte equality too)"""
import hashlib, os, re, sys
S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6"
A, B = sys.argv[1], sys.argv[2]
pa, pb = f"{S}/{A}/analytics-mvp/public", f"{S}/{B}/analytics-mvp/public"
TS = re.compile(rb"\d\d\.\d\d\.\d{4},? \d\d:\d\d(:\d\d)?( \xd0\x9c\xd0\xa1\xd0\x9a)?")
ISO = re.compile(rb"20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z?")
BTN = re.compile(rb'<a [^>]*href="katya-reklama-kartochki\.html"[^>]*>.*?</a>')


def pages(root):
    out = {}
    for sub in ("", "market"):
        d = os.path.join(root, sub)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith(".html"):
                raw = open(os.path.join(d, f), "rb").read()
                out[os.path.join(sub, f)] = (raw, ISO.sub(b"ISO", TS.sub(b"TS", raw)))
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
print(f"pages {A} {len(a)} {B} {len(b)} only in A {sorted(set(a) - set(b))} only in B {sorted(set(b) - set(a))}")
same, diff = [], []
for k in sorted(set(a) & set(b)):
    (same if a[k][1] == b[k][1] else diff).append(k)
print("equal (timestamps masked)", len(same), "differ", len(diff))
for k in ("katya-report.html",):
    if k in a and k in b:
        ra, rb_ = a[k][0], b[k][0]
        print(f"  {k}: raw md5 A {hashlib.md5(ra).hexdigest()[:10]} B {hashlib.md5(rb_).hexdigest()[:10]} raw-equal {ra == rb_} masked-equal {a[k][1] == b[k][1]} size {len(ra)} / {len(rb_)}")
        if ra != rb_:
            i, ex, ey = pdiff(ra, rb_)
            print("     first raw diff at", i, "A:", repr(ra[max(0, i - 60):min(ex, i + 60)][:200]), "B:", repr(rb_[max(0, i - 60):min(ey, i + 60)][:200]))
for k in diff:
    x, y = a[k][1], b[k][1]
    x2, y2 = BTN.sub(b"", x), BTN.sub(b"", y)
    eq = x2 == y2
    print(f"  {k}: {len(x)} -> {len(y)}, button A={len(BTN.findall(x))} B={len(BTN.findall(y))}, equal after removing button: {eq}")
    if not eq:
        i, ex, ey = pdiff(x2, y2)
        print("     span A", ex - i, "B", ey - i, "at", i)
        print("     A:", repr(x2[max(0, i - 100):min(ex, i + 200)][:320]))
        print("     B:", repr(y2[max(0, i - 100):min(ey, i + 200)][:320]))
