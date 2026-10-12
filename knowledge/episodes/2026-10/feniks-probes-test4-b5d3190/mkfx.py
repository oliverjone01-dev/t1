"""Fixture maker for FENIKS probes (writes only inside the given scratch tree).
argv: <tree analytics-mvp root> <mode>
mode: unexclude_cpc            - remove the 2 CPC products from "исключены" (builder must detect CPC itself)
      unexclude_cpc_stale_ads  - same + ads_sku_daily truncated to d < 2026-09-29 (ads sync stalled)
"""
import json, sys
root, mode = sys.argv[1], sys.argv[2]
assert root.startswith("/tmp/"), root
tp = root + "/tools/tests/tests.json"
T = json.load(open(tp, encoding="utf-8"))
t4 = T["тесты_цены"][0]
for a in ("GGM-15-2-2", "GGM-23-1-1"):
    t4["исключены"].pop(a, None)
with open(tp, "w", encoding="utf-8") as f:
    json.dump(T, f, ensure_ascii=False, indent=2)
print("исключены now:", list(t4["исключены"]))
if mode == "unexclude_cpc_stale_ads":
    ap = root + "/data/ads_sku_daily.ndjson"
    keep = [l for l in open(ap, encoding="utf-8") if l.strip() and json.loads(l)["d"] < "2026-09-29"]
    with open(ap, "w", encoding="utf-8") as f:
        f.writelines(keep)
    print("ads rows kept:", len(keep), "max d:", max(json.loads(l)["d"] for l in keep))
