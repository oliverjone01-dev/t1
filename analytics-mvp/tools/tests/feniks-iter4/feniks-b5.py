#!/usr/bin/env python3
"""B5: numbers hardcoded in the tab's template text (writeCardPage, CPC_CARD_*, cardSub strings) in build-katya.ts at b243b28.
Also em dash count in branch-added lines."""
import re, subprocess
src = subprocess.run(["git", "-C", "/home/user/t1", "show", "b243b28:analytics-mvp/src/scripts/build-katya.ts"], capture_output=True, text=True).stdout
i0 = src.find("const CPC_CARD_")
i1 = src.find("function writeCardPage")
j = src.find("\n}\n", src.find("writeFileSync(op(\"katya-reklama-kartochki.html\")") if "katya-reklama-kartochki.html" in src else i1)
seg = src[i0:j + 3]
print("segment chars", len(seg))
# Russian text fragments with numbers (outside of code identifiers): look inside quotes / template text
cands = set()
for m in re.finditer(r"[^\n]{0,60}(?<![\w.\[])(\d[\d  ]{2,}\d|\d+[,.]\d+ ?%|\d{1,2}\.\d{2}(?:\.\d{2,4})?)(?![\w\]])[^\n]{0,40}", seg):
    s = m.group(0)
    if re.search(r"[А-Яа-яЁё]", s):
        cands.add(s.strip()[:160])
for c in sorted(cands):
    print("  ", c)
# em dash in lines the branch added vs main
d = subprocess.run(["git", "-C", "/home/user/t1", "diff", "e0ad2dc", "b243b28", "--", "analytics-mvp/src/scripts/build-katya.ts", "analytics-mvp/src/scripts/cpc-card-spread.ts", "analytics-mvp/tools/cpo/build_cpo_card_orders.py", "analytics-mvp/src/scripts/katya-nav.ts", "knowledge/semantic/metrics/ozon-cpc-card-spread.yaml", "knowledge/decisions.md"], capture_output=True, text=True).stdout
added = [l for l in d.split("\n") if l.startswith("+") and not l.startswith("+++")]
print("added lines", len(added), "with U+2014:", sum(1 for l in added if "—" in l))
for l in added:
    if "—" in l:
        print("   EM:", l[:200])
