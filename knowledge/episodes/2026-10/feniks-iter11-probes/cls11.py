#!/usr/bin/env python3
"""FENIKS iter11: class N2 verdict per fixture - pages whose content differs from p11 (apart from the red mark and
REP.readBad) but carry NO red mark = numbers changed silently (FAIL). usage: cls11.py <sb>..."""
import os, re, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11/"
MARK = re.compile(r'<div style="margin:8px 16px;padding:8px 12px;border:1px solid #FF5A5F;border-radius:8px;color:#FF5A5F;font-weight:600">⚠ Файлы данных повреждены[^<]*</div>')
RB = re.compile(r'"readBad":\[[^\]]*\]')
TS = re.compile(r'\d\d\.\d\d\.\d{4} \d\d:\d\d МСК')  # BUILD_TS «обновлено ...» differs between build batches
pb = S + "p11/analytics-mvp/public/"
pages = sorted(f for f in os.listdir(pb) if f.endswith(".html"))
base = {f: TS.sub('TS', RB.sub('"readBad":[]', open(pb + f, encoding="utf-8").read())) for f in pages}
fails = 0
for sb in sys.argv[1:]:
    px = S + sb + "/analytics-mvp/public/"
    marked, changed, silent = [], [], []
    for f in pages:
        b = open(px + f, encoding="utf-8").read()
        has = bool(MARK.search(b))
        if has:
            marked.append(f)
        if TS.sub('TS', RB.sub('"readBad":[]', MARK.sub("", b))) != base[f]:
            changed.append(f)
            if not has:
                silent.append(f)
    fails += bool(silent)
    print(f"{'FAIL' if silent else 'PASS'} {sb}: marked {len(marked)} | changed {len(changed)} {[c.replace('.html', '') for c in changed]} | changed WITHOUT mark {silent}")
print("fixtures with silent change:", fails)
