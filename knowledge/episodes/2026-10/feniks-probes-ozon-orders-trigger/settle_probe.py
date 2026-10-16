#!/usr/bin/env python3
"""ФЕНИКС #484, проба M2: дозревает ли «вчера» OZON после 07:50 МСК.
Сравниваем два независимых съёма одного дня по одним артикулам:
  - кабинет на маке (funnel_tests.ndjson, роль reference/test, срез «утро» с full, ts ~07:1x МСК);
  - Seller API (sku_views.ndjson, дописан ozon-snapshots в момент прогона).
День 14.10: кабинет снят 15.10 ~13:00 МСК, API 15.10 13:22-13:41 МСК (почти одно время) - базовое
расхождение определений. День 15.10: кабинет 16.10 ~07:12 МСК, API 16.10 ~09:40-09:55 МСК (ручной
прогон 174). Если API за 15.10 систематически выше кабинета, а за 14.10 нет - день дозревал после 07:12.
Файлы берутся REST raw на нужных коммитах (main продвинулся после клона). Только чтение.
"""
import json
import os
import subprocess
from collections import defaultdict

REPO = "oliverjone01-dev/t1"
OUT = "/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/fx484/m2"
os.makedirs(OUT, exist_ok=True)


def raw(path, ref):
    f = os.path.join(OUT, f"{ref[:8]}-{os.path.basename(path)}")
    if not os.path.exists(f) or os.path.getsize(f) == 0:
        with open(f, "wb") as fh:
            subprocess.run(["gh", "api", f"repos/{REPO}/contents/{path}?ref={ref}", "-H", "Accept: application/vnd.github.raw"], stdout=fh, check=True)
    return f


def nd(f):
    for l in open(f, encoding="utf-8"):
        l = l.strip()
        if l:
            try:
                yield json.loads(l)
            except Exception:
                pass


sv = raw("analytics-mvp/data/sku_views.ndjson", "a195c436")
ft = raw("analytics-mvp/data/funnel_tests.ndjson", "710ec0d8")
so = raw("analytics-mvp/data/sku_offer.json", "a195c436")
offer = json.load(open(so))
if isinstance(offer, dict) and "map" in offer:
    offer = offer["map"]
sku2off = {}
for k, v in (offer.items() if isinstance(offer, dict) else []):
    o = v if isinstance(v, str) else (v.get("offer_id") if isinstance(v, dict) else None)
    if o:
        sku2off[str(k)] = o
print(f"sku_offer: {len(sku2off)} пар; пример {list(sku2off.items())[:1]}")

api = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))  # date -> offer -> field
for r in nd(sv):
    d = r.get("date")
    if d not in ("2026-10-14", "2026-10-15"):
        continue
    o = sku2off.get(str(r.get("sku")))
    if not o:
        continue
    a = api[d][o]
    a["vsearch"] += r.get("vsearch") or 0
    a["pdp"] += r.get("pdp") or 0
    a["cart"] += r.get("cart") or 0
    a["units"] += r.get("units") or 0
    a["views"] += r.get("views") or 0

cab = defaultdict(dict)  # date -> offer -> row (последний full-срез)
snaps = defaultdict(set)
for r in nd(ft):
    d = r.get("date")
    if d not in ("2026-10-14", "2026-10-15") or r.get("role") not in ("reference", "test", "control", "sku", None):
        continue
    if str(r.get("art", "")).startswith("AGG:"):
        continue
    snaps[d].add((r.get("snap"), r.get("ts", "")[:16], r.get("full")))
    prev = cab[d].get(r["art"])
    if prev is None or (r.get("full"), r.get("ts", "")) > (prev.get("full"), prev.get("ts", "")):
        cab[d][r["art"]] = r
for d in ("2026-10-14", "2026-10-15"):
    print(f"\n== {d}: срезы кабинета {sorted(snaps[d])[:6]}")
    both = [o for o in cab[d] if o in api[d]]
    print(f"   артикулов: кабинет {len(cab[d])}, API {len(api[d])}, общих {len(both)}")
    for fc, fa in (("search_views", "vsearch"), ("pdp_views", "pdp"), ("hits_to_cart", "cart"), ("ordered_units", "units")):
        sc = sum((cab[d][o].get(fc) or 0) for o in both)
        sa = sum(api[d][o][fa] for o in both)
        eq = sum(1 for o in both if (cab[d][o].get(fc) or 0) == api[d][o][fa])
        hi = sum(1 for o in both if api[d][o][fa] > (cab[d][o].get(fc) or 0))
        lo = sum(1 for o in both if api[d][o][fa] < (cab[d][o].get(fc) or 0))
        print(f"   {fc:>14} кабинет {sc:>8} | API {sa:>8} | API/кабинет {sa / sc if sc else float('nan'):.4f} | равны {eq}, API выше {hi}, ниже {lo}")
