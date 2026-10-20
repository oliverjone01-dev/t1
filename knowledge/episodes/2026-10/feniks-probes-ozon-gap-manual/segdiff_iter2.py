"""Full text of differing segments between two built pages (anpages_gm.py truncates at 150 chars). Read-only.
Usage: python3 -I segdiff_iter2.py <scratch dir> <vA@revA> <vB@revB> [more pairs as vA@revA:vB@revB ...]
For each differing segment prints the first differing character position and 80 chars around it on both sides.
"""
import difflib
import html as H
import re
import sys

S = sys.argv[1]


def segs(v, rev):
    p = open(f"{S}/pb/{v}/out_{rev}/katya-tests.html", encoding="utf-8").read()
    t = H.unescape(re.sub(r"<(script|style)[\s\S]*?</\1>", " ", p))
    return [x for x in (re.sub(r"\s+", " ", s).strip() for s in re.split(r"<[^>]+>", t)) if x]


for pair in sys.argv[2:]:
    a, b = pair.split(":")
    (va, ra), (vb, rb) = a.split("@"), b.split("@")
    sa, sb = segs(va, ra), segs(vb, rb)
    ops = [o for o in difflib.SequenceMatcher(None, sa, sb, autojunk=False).get_opcodes() if o[0] != "equal"]
    print(f"== {a} -> {b}: differing blocks {len(ops)}")
    for op, i1, i2, j1, j2 in ops[:8]:
        x, y = " / ".join(sa[i1:i2]), " / ".join(sb[j1:j2])
        k = next((n for n in range(min(len(x), len(y))) if x[n] != y[n]), min(len(x), len(y)))
        print(f"  {op} at char {k}: {x[max(0, k - 40):k + 80]!r}")
        print(f"  {' ' * len(op)}          -> {y[max(0, k - 40):k + 80]!r}")
