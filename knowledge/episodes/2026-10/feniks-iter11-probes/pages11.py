#!/usr/bin/env python3
"""FENIKS iter11: per fixture, every page of public/ against the clean build p11.
For each html: does it carry the red kshell mark «Файлы данных повреждены»? Is it otherwise byte-equal to p11
(after removing the mark div and the REP.readBad array of «Отчет»)? If not - first differing spot (both sides).
usage: pages11.py <base> <sb>..."""
import os, re, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11/"
MARK = re.compile(r'<div style="margin:8px 16px;padding:8px 12px;border:1px solid #FF5A5F;border-radius:8px;color:#FF5A5F;font-weight:600">⚠ Файлы данных повреждены[^<]*</div>')
RB = re.compile(r'"readBad":\[[^\]]*\]')
base, sbs = sys.argv[1], sys.argv[2:]
pb = S + base + "/analytics-mvp/public/"
pages = sorted(f for f in os.listdir(pb) if f.endswith(".html"))
for sb in sbs:
    px = S + sb + "/analytics-mvp/public/"
    marked, clean_eq, other = [], [], []
    for f in pages:
        a = open(pb + f, encoding="utf-8").read()
        if not os.path.exists(px + f):
            other.append((f, "MISSING"))
            continue
        b = open(px + f, encoding="utf-8").read()
        m = MARK.search(b)
        if m:
            marked.append(f)
        a2, b2 = RB.sub('"readBad":[]', MARK.sub("", a)), RB.sub('"readBad":[]', MARK.sub("", b))
        if a2 == b2:
            clean_eq.append(f)
        else:
            i = next(k for k in range(min(len(a2), len(b2))) if a2[k] != b2[k]) if any(x != y for x, y in zip(a2, b2)) else min(len(a2), len(b2))
            other.append((f, f"len {len(a2)}->{len(b2)} at {i}: base «{a2[max(0, i - 60):i + 60]}» | fx «{b2[max(0, i - 60):i + 60]}»"))
    note = ""
    for f in marked[:1]:
        note = MARK.search(open(px + f, encoding="utf-8").read()).group(0)[150:330]
    print(f"== {sb}: pages {len(pages)} | with red mark {len(marked)} | without mark {len(pages) - len(marked)}: {[f for f in pages if f not in marked]}")
    print(f"   equal to {base} apart from mark/readBad: {len(clean_eq)} | differing: {len(other)}")
    if note:
        print("   mark:", note)
    for f, d in other[:6]:
        print("   DIFF", f, d.replace("\n", " ")[:420])
