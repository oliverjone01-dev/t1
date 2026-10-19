"""Collect the key lines of scratch outputs (L3 live tests, P1, K2, T1, T2) into one text file next to the probes.
Usage: python3 -I collect.py <scratch dir> <out file>"""
import re
import sys

S, OUT = sys.argv[1], sys.argv[2]
lines = []


def grab(title, path, pat, limit=40):
    lines.append(f"===== {title} ({path.replace(S, '$S')})")
    try:
        txt = open(path, encoding="utf-8", errors="replace").read()
    except FileNotFoundError:
        lines.append("   (no file)")
        return
    n = 0
    if path.endswith(".html"):
        for m in re.findall(r"разрыв обвалился к нулю у [^<]*", txt)[:limit]:
            lines.append("   " + m)
        return
    for l in txt.splitlines():
        if re.search(pat, l):
            lines.append("   " + l.rstrip()[:300])
            n += 1
            if n >= limit:
                break


grab("T1 vitest HEAD", f"{S}/vitest.txt", r"Test Files|Tests  |Duration")
grab("T2 tsc HEAD", f"{S}/tsc.txt", r"error TS", limit=60)
for v in ("v0", "vZ", "vU", "vW"):
    grab(f"L3 live tests on {v}", f"{S}/lt_{v}.txt", r"✓ src|×|FAIL|AssertionError|Tests  |^\+ |^- |\+   \"|expected")
for rev in ("0bb36b5", "b0096cf"):
    grab(f"K2 systemic day, stop row ({rev})", f"{S}/pb/vMass/out_{rev}/katya-tests.html", r"разрыв обвалился к нулю", limit=2)
grab("P1 one-day glitch 15.10, page 19.10 (0bb36b5)", f"{S}/pb/vP/out_0bb36b5/katya-tests.html", r"разрыв обвалился к нулю", limit=2)
open(OUT, "w", encoding="utf-8").write("\n".join(re.sub(r"<[^>]+>", " ", l) for l in lines) + "\n")
print(f"{len(lines)} lines -> {OUT}")
