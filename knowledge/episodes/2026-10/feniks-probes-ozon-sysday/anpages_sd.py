"""Page analysis for K2 / P1 probes: test-4 stop, plan chips, WARNING in the build log, «разрыв по», verdict date,
GGK-02-3-3-80 row, and text differences against v0 of the same code.
Usage: python3 -I anpages_sd.py <scratch dir> [variants...]
"""
import difflib
import filecmp
import html as H
import os
import re
import sys

S = sys.argv[1]
VARS = sys.argv[2:] or ["v0", "vZ", "vU", "vMass", "vS90", "vS89", "vKeep", "vN50", "vN49", "vP", "vPfix", "vZfix"]
REVS = ["30abf83", "ada2e83"]


def page(rev, v):
    p = f"{S}/pb/{v}/out_{rev}/katya-tests.html"
    return open(p, encoding="utf-8").read() if os.path.exists(p) else None


def segs(p):
    t = H.unescape(re.sub(r"<script[\s\S]*?</script>", " ", p))
    return [x for x in (re.sub(r"\s+", " ", s).strip() for s in re.split(r"<[^>]+>", t)) if x]


def row_of(p, art):
    i = p.find(f'<td class="nw">{art}</td>')
    if i < 0:
        return "-"
    k = p.find("</tr>", i)
    cells = [re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", c))).strip() for c in re.findall(r"<td[^>]*>([\s\S]*?)</td>", p[i:k])]
    return " | ".join(cells[:4])


for rev in REVS:
    base = page(rev, "v0")
    for v in VARS:
        p = page(rev, v)
        if p is None:
            continue
        txt = H.unescape(p)
        stop = re.findall(r"разрыв обвалился к нулю у (.*?) - (?:товар|OZON)", txt)
        items = stop[0].split(", ") if stop else []
        chips = txt.count("выпал из бустинга?")
        logp = f"{S}/pb/{v}/log_{rev}.txt"
        warns = [l.strip() for l in open(logp, encoding="utf-8") if "WARNING" in l] if os.path.exists(logp) else []
        razr = re.findall(r"разрыв по ([0-9-]+)", txt)[:1]
        verd = re.findall(r"(Промежуточно|Итог) по показателям на ([0-9.]+)", txt)[:1]
        same = base is not None and filecmp.cmp(f"{S}/pb/v0/out_{rev}/katya-tests.html", f"{S}/pb/{v}/out_{rev}/katya-tests.html", shallow=False)
        print(f"{rev} {v:6} identical_to_v0={same} stops={len(items)} chips={chips} warn={len(warns)} razryv_po={razr} verdict={verd}")
        if items:
            print(f"      stop items: {items[:10]}")
        full = re.findall(r"Стоп:</b> (.*?)\.</div>", txt)
        if full:
            print(f"      stop text: {full[0][:400]}")
        for w in warns:
            print(f"      log: {w[:200]}")
        if v in ("vP", "vPfix", "vZ", "vZfix"):
            print(f"      GGK-02-3-3-80 row: {row_of(txt, 'GGK-02-3-3-80')}")
        if base is not None and not same and v != "v0" and v in ("vMass", "vS90", "vKeep", "vN50"):
            a, b = segs(base), segs(p)
            n = 0
            for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
                if op != "equal":
                    n += 1
                    if n <= 12:
                        print(f"      {op}: {' / '.join(a[i1:i2])[:140]!r} -> {' / '.join(b[j1:j2])[:140]!r}")
            print(f"      text segments differing: {n}")
