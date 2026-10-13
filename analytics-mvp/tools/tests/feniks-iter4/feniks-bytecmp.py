#!/usr/bin/env python3
"""Compare every built page A vs B sandbox; for differing pages show prefix/suffix diff after removing the nav button."""
import os, re, sys
S = "/tmp/claude-0/-home-user-t1/ab784862-23d6-55b0-ac5d-13cc753c25dd/scratchpad"
A = sys.argv[1] if len(sys.argv) > 1 else "feniks-main"
B = sys.argv[2] if len(sys.argv) > 2 else "feniks-br"
pa, pb = f"{S}/{A}/analytics-mvp/public", f"{S}/{B}/analytics-mvp/public"


def pages(root):
    out = {}
    for sub in ("", "market"):
        d = os.path.join(root, sub)
        for f in sorted(os.listdir(d)):
            if f.endswith(".html"):
                out[os.path.join(sub, f)] = open(os.path.join(d, f), "rb").read()
    return out


def pdiff(x, y):
    i = 0
    n = min(len(x), len(y))
    while i < n and x[i] == y[i]:
        i += 1
    j = 0
    while j < n - i and x[len(x) - 1 - j] == y[len(y) - 1 - j]:
        j += 1
    return i, len(x) - j, len(y) - j


a, b = pages(pa), pages(pb)
only_a = sorted(set(a) - set(b)); only_b = sorted(set(b) - set(a))
print("pages", A, len(a), B, len(b), "only in A", only_a, "only in B", only_b, flush=True)
same, diff = [], []
for k in sorted(set(a) & set(b)):
    (same if a[k] == b[k] else diff).append(k)
print("byte-equal", len(same), "differ", len(diff), flush=True)
BTN = re.compile(rb'<a [^>]*href="katya-reklama-kartochki\.html"[^>]*>.*?</a>')
for k in diff:
    x, y = a[k], b[k]
    nb = len(BTN.findall(y)); na = len(BTN.findall(x))
    y2 = BTN.sub(b"", y)
    eq = (x == y2)
    print(f"  {k}: size {len(x)} -> {len(y)}, button A={na} B={nb}, equal after removing button: {eq}", flush=True)
    if not eq:
        i, ex, ey = pdiff(x, y2)
        print("     first diff at", i, "A:", repr(x[max(0, i - 120):min(ex, i + 200)][:500]), flush=True)
        print("                       B:", repr(y2[max(0, i - 120):min(ey, i + 200)][:500]), flush=True)
        print("     differing span A", ex - i, "bytes, B", ey - i, "bytes", flush=True)
    else:
        m = BTN.search(y)
        print("     button:", m.group(0).decode("utf-8")[:300] if m else None, flush=True)
