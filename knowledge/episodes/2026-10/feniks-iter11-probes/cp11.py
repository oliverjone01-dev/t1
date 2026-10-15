#!/usr/bin/env python3
"""Copy iter10 helper scripts to feniks-iter11-probes with paths f10 -> f11 (writes only inside knowledge/episodes/)."""
import os

O = "/home/user/t1/knowledge/episodes/2026-10/feniks-iter10-probes/"
P = "/home/user/t1/knowledge/episodes/2026-10/feniks-iter11-probes/"
for f in ("build10.sh", "buildmany10.sh", "render10.sh", "fx10_report.mjs", "fx10_rows.mjs", "fx10_full.mjs",
          "listdiff10.py", "mklink10.py", "vt10.sh", "periods10.json"):
    t = open(O + f, encoding="utf-8").read()
    for a, b in (("scratchpad/f10", "scratchpad/f11"), ("fx10_", "fx11_"), ("build10.sh", "build11.sh"),
                 ("periods10.json", "periods11.json"), ("iter10", "iter11")):
        t = t.replace(a, b)
    n = P + f.replace("10", "11")
    open(n, "w", encoding="utf-8").write(t)
    os.chmod(n, 0o755)
    print(n, "f10" in t)
