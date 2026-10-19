"""Z1/Z3/U1 page analysis: stop of test 4, plan chip, and every text difference against v0 of the same code.
Usage: python3 -I anpages4.py <scratch dir>
"""
import difflib
import filecmp
import html as H
import re
import sys

S = sys.argv[1]
REVS = ["0bb36b5", "b0096cf"]
VARS = ["v0", "vZ", "vN", "vE", "vU", "vM"]


def page(rev, v):
    return open(f"{S}/pb/{v}/out_{rev}/katya-tests.html", encoding="utf-8").read()


def segs(p):
    t = H.unescape(re.sub(r"<script[\s\S]*?</script>", " ", p))
    return [x for x in (re.sub(r"\s+", " ", s).strip() for s in re.split(r"<[^>]+>", t)) if x]


def plan_cell(p, art="GGT-48-2-2-100-180"):
    i0 = p.find("Скидка OZON 14.10")
    j = p.find(art, i0)
    if j < 0:
        return "-"
    k = p.find("</tr>", j)
    cells = [re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", c))).strip() for c in re.findall(r"<td[^>]*>([\s\S]*?)</td>", p[j:k])]
    return " | ".join(c for c in cells[-4:])


for rev in REVS:
    base = page(rev, "v0")
    for v in VARS:
        try:
            p = page(rev, v)
        except FileNotFoundError:
            print(f"{rev} {v}: no page")
            continue
        stop = re.findall(r"разрыв обвалился к нулю у ([^<]*?) - товар", p)
        same = filecmp.cmp(f"{S}/pb/v0/out_{rev}/katya-tests.html", f"{S}/pb/{v}/out_{rev}/katya-tests.html", shallow=False)
        print(f"{rev} {v:3} identical_to_v0={same} stop={stop}")
        print(f"      plan GGT-48-2-2-100-180: {plan_cell(p)}")
        if not same and v != "v0":
            a, b = segs(base), segs(p)
            for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
                if op != "equal":
                    print(f"      {op}: {' / '.join(a[i1:i2])[:150]!r} -> {' / '.join(b[j1:j2])[:150]!r}")
            sa, sb = re.findall(r"<script[\s\S]*?</script>", base), re.findall(r"<script[\s\S]*?</script>", p)
            nd = sum(1 for x, y in zip(sa, sb) if x != y)
            print(f"      script blocks differing: {nd} of {len(sa)}")
