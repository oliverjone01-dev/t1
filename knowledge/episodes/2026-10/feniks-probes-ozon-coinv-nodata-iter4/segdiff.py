"""Full text of the differing segments between two built pages (no truncation). Usage: python3 -I segdiff.py <a.html> <b.html>"""
import difflib
import html as H
import re
import sys


def segs(p):
    t = H.unescape(re.sub(r"<script[\s\S]*?</script>", " ", p))
    return [x for x in (re.sub(r"\s+", " ", s).strip() for s in re.split(r"<[^>]+>", t)) if x]


a = segs(open(sys.argv[1], encoding="utf-8").read())
b = segs(open(sys.argv[2], encoding="utf-8").read())
for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
    if op == "equal":
        continue
    x, y = " / ".join(a[i1:i2]), " / ".join(b[j1:j2])
    k = 0
    while k < min(len(x), len(y)) and x[k] == y[k]:
        k += 1
    print(f"{op}: common prefix {k} chars")
    print(f"   A: ...{x[max(0, k - 80):k + 400]}")
    print(f"   B: ...{y[max(0, k - 80):k + 400]}")
