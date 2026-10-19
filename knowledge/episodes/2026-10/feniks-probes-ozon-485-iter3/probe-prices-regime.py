#!/usr/bin/env python3
# ФЕНИКС #485 iter3, проба P2: смена режима prices_daily 15.10 (before == price, coinv = 0 у всех офферов?).
# Если 15.10 срез устроен иначе, чем 14.10, база «цена 15.10» у 6 новых строк несравнима с базой 14.10 у 23 строк v3.
# Только чтение. Запуск: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-485-iter3/probe-prices-regime.py
import collections
import json

DD = "/home/user/t1/analytics-mvp/data/"
plan = {p["art"] for p in json.load(open(DD + "plan_2026-10-15_v3.json", encoding="utf-8"))["price"]}
D = collections.defaultdict(dict)
for line in open(DD + "prices_daily.ndjson", encoding="utf-8"):
    if line.strip():
        r = json.loads(line)
        if str(r["d"]) > "2026-10-07":
            D[r["d"]][r["offer"]] = r
print("день | строк | before==price | coinv>0 | paid не пусто | coinv_paid не пусто")
for d in sorted(D):
    B = D[d]
    print(d, len(B), sum(B[o].get("before") == B[o].get("price") for o in B), sum((B[o].get("coinv") or 0) > 0 for o in B),
          sum(B[o].get("paid") is not None for o in B), sum(B[o].get("coinv_paid") is not None for o in B))
days = sorted(D)
for a, b in zip(days, days[1:]):
    A, B = D[a], D[b]
    ch = [o for o in set(A) & set(B) if A[o]["price"] != B[o]["price"]]
    off = [(B[o]["price"] / A[o]["price"] - 1) * 100 for o in ch if o not in plan]
    rng = f"вне плана {min(off):.1f}..{max(off):.1f} проц., ниже {sum(x < 0 for x in off)}, выше {sum(x > 0 for x in off)}" if off else "вне плана 0"
    print(f"{a} -> {b}: смена цены у {len(ch)} (в плане v3 {sum(o in plan for o in ch)}); {rng}")

g = collections.defaultdict(dict)
for line in open(DD + "gap_daily.ndjson", encoding="utf-8"):
    if line.strip():
        r = json.loads(line)
        if r.get("date") in ("2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"):
            g[r["date"]][r["art"]] = r
print("\ngap_daily поля:", sorted(next(iter(g["2026-10-15"].values())).keys()))
for d in sorted(g):
    vals = [float(x["gap_pct"]) for x in g[d].values() if x.get("gap_pct") is not None]
    vals.sort()
    med = vals[len(vals) // 2] if vals else None
    print(d, "артикулов", len(g[d]), "медиана gap_pct", med, "gap_pct меньше 10:", sum(v < 10 for v in vals))
for a in ("GGT-48-2-2-100-180", "GGT-46-3-3-100"):
    print(a, [(d[5:], g[d].get(a, {}).get("gap_pct"), g[d].get(a, {}).get("site_to_seller")) for d in sorted(g)])
