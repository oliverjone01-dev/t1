"""Page analysis for the audit of PR #489: notice (plashka) on the page, test-4 stop line, plan chips «OZON не
доплачивает?», WARNING / «ручных снятий» lines of the build log, and text diffs between pages.
Usage: python3 -I anpages_gm.py <scratch dir> <rev> <variants...> [--diff vA:vB[@rev2] ...]
Read-only.
"""
import difflib
import html as H
import os
import re
import sys

S, REV = sys.argv[1], sys.argv[2]
args = sys.argv[3:]
VARS = [a for a in args if not a.startswith("--") and ":" not in a]
DIFFS = [a for a in args if ":" in a]


def page(rev, v):
    p = f"{S}/pb/{v}/out_{rev}/katya-tests.html"
    return open(p, encoding="utf-8").read() if os.path.exists(p) else None


def segs(p):
    t = H.unescape(re.sub(r"<(script|style)[\s\S]*?</\1>", " ", p))
    return [x for x in (re.sub(r"\s+", " ", s).strip() for s in re.split(r"<[^>]+>", t)) if x]


def chip_rows(txt):
    out = []
    for m in re.finditer(r"<tr[^>]*>([\s\S]*?)</tr>", txt):
        row = m.group(1)
        if ">OZON не доплачивает?<" in row:
            a = re.search(r"(GG[A-Z]-[0-9A-Za-z-]+)", re.sub(r"<[^>]+>", " ", row))
            out.append(a.group(1) if a else "?")
    return out


for v in VARS:
    p = page(REV, v)
    if p is None:
        print(f"{REV} {v:9} NO PAGE")
        continue
    txt = H.unescape(p)
    m = re.search(r'<div class="mrow warnv">([\s\S]*?)</div>', p)
    notice = re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", m.group(1)))).strip() if m else ""
    stop = re.findall(r"разрыв обвалился к нулю у (.*?) - OZON", txt)
    items = re.findall(r"[A-Z]{3}-[0-9A-Za-z-]+ \(с [0-9.]+(?:, сейчас [0-9,]+% на [0-9.]+)?\)", stop[0]) if stop else []
    chips = chip_rows(p)
    logp = f"{S}/pb/{v}/log_{REV}.txt"
    log = [l.strip() for l in open(logp, encoding="utf-8")] if os.path.exists(logp) else []
    warns = [l for l in log if "WARNING" in l or "ручных снятий" in l]
    print(f"{REV} {v:9} notice={'yes' if notice else 'no'} stops={items} chips={chips} log_lines={len(warns)}")
    if notice:
        print(f"      notice: {notice[:700]}")
    full = re.findall(r"Стоп:</b> (.*?)\.</div>", txt)
    if full:
        print(f"      stop text: {re.sub(r'<[^>]+>', '', full[0])[:600]}")
    for w in warns:
        print(f"      log: {w[:230]}")

for d in DIFFS:
    ab, _, rev2 = d.partition("@")
    a, b = ab.split(":")
    pa, pb = page(REV, a), page(rev2 or REV, b)
    if not (pa and pb):
        print(f"diff {d}: missing page")
        continue
    sa, sb = segs(pa), segs(pb)
    n = 0
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, sa, sb, autojunk=False).get_opcodes():
        if op != "equal":
            n += 1
            if n <= 6:
                print(f"  diff {a}@{REV} -> {b}@{rev2 or REV}: {op}: {' / '.join(sa[i1:i2])[:150]!r} -> {' / '.join(sb[j1:j2])[:150]!r}")
    print(f"  diff {a}@{REV} -> {b}@{rev2 or REV}: text segments differing: {n}")
