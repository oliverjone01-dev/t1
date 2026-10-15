#!/usr/bin/env python3
"""FENIKS iter11: where does a fixture page differ from p11 (apart from the red mark / REP.readBad)? Prints up to N spots
(char-level, via difflib on ';'/','-split tokens). usage: where11.py <sb> <page.html> [N]"""
import difflib, re, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11/"
MARK = re.compile(r'<div style="margin:8px 16px;padding:8px 12px;border:1px solid #FF5A5F;border-radius:8px;color:#FF5A5F;font-weight:600">⚠ Файлы данных повреждены[^<]*</div>')
RB = re.compile(r'"readBad":\[[^\]]*\]')
sb, page = sys.argv[1], sys.argv[2]
n = int(sys.argv[3]) if len(sys.argv) > 3 else 6
a = RB.sub('"readBad":[]', open(S + "p11/analytics-mvp/public/" + page, encoding="utf-8").read())
b = RB.sub('"readBad":[]', MARK.sub("", open(S + sb + "/analytics-mvp/public/" + page, encoding="utf-8").read()))
ta, tb = re.split(r"(?<=[;\]\}>])", a), re.split(r"(?<=[;\]\}>])", b)
sm = difflib.SequenceMatcher(None, ta, tb, autojunk=False)
k = 0
for op, i1, i2, j1, j2 in sm.get_opcodes():
    if op == "equal":
        continue
    k += 1
    if k <= n:
        ctx = "".join(ta[max(0, i1 - 1):i1])[-80:]
        print(f"[{op}] ctx «{ctx}»\n   p11: «{''.join(ta[i1:i2])[:220]}»\n   fx : «{''.join(tb[j1:j2])[:220]}»")
print("spots:", k)
