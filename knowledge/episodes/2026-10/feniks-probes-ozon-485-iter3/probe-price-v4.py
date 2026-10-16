#!/usr/bin/env python3
# ФЕНИКС #485 iter3, проба P1: независимый пересчёт 6 строк 16.10 плана v4 из prices_daily / gap_daily,
# база остальных 23 строк (14.10 или 15.10), история цены 6 артикулов, накопленное снижение от 14.10,
# статус на 16.10 по правилу priceStatus, продажи 30 дней. Только чтение.
# Запуск: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-485-iter3/probe-price-v4.py
import json

DD = "/home/user/t1/analytics-mvp/data/"
ARTS = ["GGT-48-2-2-100-180", "GGT-48-3-3-100-180", "GGT-48-5-1-100-180", "GGT-46-2-2-100", "GGT-46-3-3-100", "GGT-46-5-1-100"]
v3 = json.load(open(DD + "plan_2026-10-15_v3.json", encoding="utf-8"))
v4 = json.load(open(DD + "plan_2026-10-15_v4.json", encoding="utf-8"))
allarts = {p["art"] for p in v4["price"]} | {p["art"] for p in v3["price"]}

hist = {}
keys0 = None
for line in open(DD + "prices_daily.ndjson", encoding="utf-8"):
    if not line.strip():
        continue
    r = json.loads(line)
    keys0 = keys0 or list(r.keys())
    if r.get("offer") in allarts and str(r.get("d", "")) > "2026-10-07":
        hist.setdefault(r["offer"], {})[r["d"]] = float(r["price"])
print("prices_daily поля:", keys0)
s2s = {}
for line in open(DD + "gap_daily.ndjson", encoding="utf-8"):
    if not line.strip():
        continue
    r = json.loads(line)
    if r.get("art") in ARTS and r.get("date") == "2026-10-15" and r.get("site_to_seller"):
        s2s[r["art"]] = float(r["site_to_seller"])

print("\n== 6 строк 16.10: пересчёт")
bad = 0
for p in v4["price"]:
    if p["art"] not in ARTS:
        continue
    h = hist[p["art"]]
    p15, p14 = h.get("2026-10-15"), h.get("2026-10-14")
    now = round(p15)
    new = int(round(now * 0.9 / 10) * 10)
    site = round(now * s2s[p["art"]])
    ok = (p["price_now"], p["price_new"], p["site_now"], p["when"]) == (now, new, site, "16.10")
    bad += not ok
    last_d = max(h)
    last = h[last_d]
    if last <= p["price_new"] * 1.005:
        st = "снижена"
    elif last < p["price_now"] * 0.995:
        st = "частично"
    elif last_d < "2026-10-16" or True:
        st = "по плану/сегодня (если цена та же)"
    cum = (p["price_new"] / p14 - 1) * 100 if p14 else None
    print(f'{p["art"]} | 14.10={p14} 15.10={p15} | v4 now={p["price_now"]} new={p["price_new"]} site={p["site_now"]} | пересчёт {now}/{new}/{site} {"OK" if ok else "РАСХОЖДЕНИЕ"} '
          f'| от 14.10 к целевой {cum:+.2f}% | последний срез {last_d} {last} -> {st}')
    print("   история:", [(d[5:], v) for d, v in sorted(h.items())])
print("расхождений:", bad)

print("\n== база price_now у остальных строк v4 (14.10 или 15.10)")
m14 = m15 = other = 0
for p in v4["price"]:
    if p["art"] in ARTS:
        continue
    h = hist.get(p["art"], {})
    a14, a15 = h.get("2026-10-14"), h.get("2026-10-15")
    if a14 is not None and round(a14) == p["price_now"]:
        m14 += 1
    elif a15 is not None and round(a15) == p["price_now"]:
        m15 += 1
    else:
        other += 1
        print("  не 14.10 и не 15.10:", p["art"], p["when"], p["price_now"], a14, a15)
print(f"совпало с 14.10: {m14}, с 15.10: {m15}, иначе: {other}")
moved = sum(1 for p in v4["price"] if p["art"] not in ARTS and hist.get(p["art"], {}).get("2026-10-14") != hist.get(p["art"], {}).get("2026-10-15"))
print("строк, у которых цена 15.10 != 14.10 (без 6 новых):", moved)

live = json.load(open(DD + "skus_live_30d.json", encoding="utf-8"))
tab = live["sku_table"]
print("\n== skus_live_30d поля:", list(tab[0].keys())[:25])
for a in ARTS:
    row = next((x for x in tab if x.get("offer") == a), None)
    print(a, "нет в skus_live_30d" if row is None else {k: row.get(k) for k in row if k in ("name", "units", "orders", "ordered_units", "revenue", "card", "group", "model")})
