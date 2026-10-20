"""Page analysis for iter2 probes of PR #488: notice on the page (R4), test-4 stop text (R8), plan chips (R5),
WARNING in the build log, «разрыв по», rows of chosen articles, text diff of v0 head vs v0 main.
Usage: python3 -I anpages2.py <scratch dir> <revs, comma-separated> [variants...]
"""
import difflib
import html as H
import os
import re
import sys

S = sys.argv[1]
REVS = sys.argv[2].split(",")
VARS = sys.argv[3:] or ["v0", "vZ19", "vZ20", "vMass", "vS90", "vS89", "vW15", "vW14", "vN50", "vN49", "vKeep", "vP",
                        "vPfix", "vZfix", "vReal2b", "vReal3", "vSysWarn", "vOld", "vWarnOld", "vZsib"]
ROWS = {"vP": ["GGK-02-3-3-80"], "vPfix": ["GGK-02-3-3-80"], "vZ19": ["GGK-02-3-3-80"], "vZfix": ["GGK-02-3-3-80"],
        "vZ20": ["GGK-02-3-3-80"], "vKeep": ["GGK-05-2-3-7040", "GGK-02-3-3-80"], "vS90": ["GGK-05-2-3-7040"]}


def page(rev, v):
    p = f"{S}/pb/{v}/out_{rev}/katya-tests.html"
    return open(p, encoding="utf-8").read() if os.path.exists(p) else None


def text(p):
    t = H.unescape(re.sub(r"<(script|style)[\s\S]*?</\1>", " ", p))
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t)).strip()


def segs(p):
    t = H.unescape(re.sub(r"<(script|style)[\s\S]*?</\1>", " ", p))
    return [x for x in (re.sub(r"\s+", " ", s).strip() for s in re.split(r"<[^>]+>", t)) if x]


def row_of(p, art):
    i = p.find(f'<td class="nw">{art}</td>')
    if i < 0:
        return "-"
    k = p.find("</tr>", i)
    cells = [re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", c))).strip() for c in re.findall(r"<td[^>]*>([\s\S]*?)</td>", p[i:k])]
    return " | ".join(cells[:5])


for rev in REVS:
    for v in VARS:
        p = page(rev, v)
        if p is None:
            print(f"{rev} {v:8} NO PAGE")
            continue
        txt = H.unescape(p)
        m = re.search(r'<div class="wrap"><div class="mrow warnv">([\s\S]*?)</div>', p)
        notice = re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", m.group(1)))).strip() if m else ""
        stop = re.findall(r"разрыв обвалился к нулю у (.*?) - (?:товар|OZON)", txt)
        items = re.findall(r"[A-Z]{3}-[0-9A-Za-z-]+ \(с [0-9.]+(?:, сейчас [0-9,]+% на [0-9.]+)?\)", stop[0]) if stop else []
        chips_new = txt.count(">OZON не доплачивает?<")
        chips_old = txt.count("выпал из бустинга?")
        logp = f"{S}/pb/{v}/log_{rev}.txt"
        warns = [l.strip() for l in open(logp, encoding="utf-8") if "WARNING" in l] if os.path.exists(logp) else []
        razr = re.findall(r"разрыв по ([0-9-]+)", txt)[:1]
        print(f"{rev} {v:8} notice={'yes' if notice else 'no'} stops={len(items)} chips={chips_new} old_chips={chips_old} warn={len(warns)} razryv_po={razr}")
        if notice:
            print(f"      notice: {notice[:600]}")
        full = re.findall(r"Стоп:</b> (.*?)\.</div>", txt)
        if full:
            print(f"      stop text: {full[0][:700]}")
        for w in warns:
            print(f"      log: {w[:220]}")
        for a in ROWS.get(v, []):
            print(f"      row {a}: {row_of(txt, a)}")
    a, b = page(rev, "v0"), None
for v in ("v0",):
    a, b = page(REVS[0], v), page(REVS[-1], v) if len(REVS) > 1 else None
    if a and b:
        sa, sb = segs(a), segs(b)
        n = 0
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, sa, sb, autojunk=False).get_opcodes():
            if op != "equal":
                n += 1
                if n <= 8:
                    print(f"  diff {REVS[0]}->{REVS[-1]} {v}: {op}: {' / '.join(sa[i1:i2])[:160]!r} -> {' / '.join(sb[j1:j2])[:160]!r}")
        print(f"  {v}: text segments differing between {REVS[0]} and {REVS[-1]}: {n}")
