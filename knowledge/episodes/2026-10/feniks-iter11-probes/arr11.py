#!/usr/bin/env python3
"""FENIKS iter11: which window.__X arrays differ between p11 and a fixture on a template page (katya.html,
katya-tovary.html - pages without kshell), and at which positions. usage: arr11.py <sb> <page>..."""
import json, re, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11/"
sb = sys.argv[1]
for page in sys.argv[2:]:
    a = open(S + "p11/analytics-mvp/public/" + page, encoding="utf-8").read()
    b = open(S + sb + "/analytics-mvp/public/" + page, encoding="utf-8").read()
    names = re.findall(r"window\.(__[A-Z_0-9]+)\s*=", a)
    print(page, "window vars:", names[:40])
    for name in names:
        xa = re.search(r"window\." + name + r"\s*=\s*(\[.*?\]);", a)
        xb = re.search(r"window\." + name + r"\s*=\s*(\[.*?\]);", b)
        if not (xa and xb) or xa.group(1) == xb.group(1):
            continue
        try:
            va, vb = json.loads(xa.group(1)), json.loads(xb.group(1))
        except Exception as e:
            print("  ", name, "not json", e)
            continue
        d = [(i, va[i], vb[i]) for i in range(min(len(va), len(vb))) if va[i] != vb[i]]
        print("  ", name, "len", len(va), "->", len(vb), "| differing positions", d[:6])
    print("  red mark on page:", "Файлы данных повреждены" in b)
