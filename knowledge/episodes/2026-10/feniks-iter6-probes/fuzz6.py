#!/usr/bin/env python3
"""FENIKS iter6: identical adversarial mutations of CPO inputs in two sandboxes (pre/post code) to check «Отчет» byte-equality
beyond the real data. usage: fuzz6.py <sandbox> ..."""
import json, random, sys

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6"
for sb in sys.argv[1:]:
    D = f"{S}/{sb}/analytics-mvp/data/"
    od = [l for l in open(D + "orders_daily.ndjson", encoding="utf-8") if l.strip()]
    cpo = [l for l in open(D + "cpo_orders.ndjson", encoding="utf-8") if l.strip()]
    sku = [l for l in open(D + "cpo_sku_daily.ndjson", encoding="utf-8") if l.strip()]
    rnd = random.Random(20261013)
    # 1) shuffle postings file order (first posting of an order is no longer the earliest)
    rnd.shuffle(od)
    # 2) an existing CPO order gets an extra posting dated earlier, appended at the end of the file (ps[0] stays the old one)
    first = json.loads(cpo[10])["order"]
    base = next(json.loads(l) for l in od if json.loads(l)["order"].rsplit("-", 1)[0] == first)
    extra = dict(base, order=first + "-9", d="2026-06-02", revenue=12345, units=3, status="delivered")
    od.append(json.dumps(extra, ensure_ascii=False) + "\n")
    # 3) posting without units and with string revenue; a cancelled posting of another CPO order
    o2 = json.loads(cpo[20])["order"]
    b2 = next(json.loads(l) for l in od if json.loads(l)["order"].rsplit("-", 1)[0] == o2)
    nu = {k: v for k, v in b2.items() if k != "units"}
    nu.update(order=o2 + "-8", revenue="777", status="delivering")
    od.append(json.dumps(nu, ensure_ascii=False) + "\n")
    o3 = json.loads(cpo[30])["order"]
    b3 = next(json.loads(l) for l in od if json.loads(l)["order"].rsplit("-", 1)[0] == o3)
    od.append(json.dumps(dict(b3, order=o3 + "-7", revenue=50000, units=1, status="cancelled"), ensure_ascii=False) + "\n")
    # 4) duplicate CPO order line and an order unknown to orders_daily
    cpo.append(cpo[40])
    cpo.append(json.dumps({"order": "99999999-9999", "sp": 1000.0}) + "\n")
    # 5) coverage: drop cpo_sku_daily rows of the first day
    d0 = min(json.loads(l)["d"] for l in sku)
    sku = [l for l in sku if json.loads(l)["d"] != d0]
    open(D + "orders_daily.ndjson", "w", encoding="utf-8").writelines(od)
    open(D + "cpo_orders.ndjson", "w", encoding="utf-8").writelines(cpo)
    open(D + "cpo_sku_daily.ndjson", "w", encoding="utf-8").writelines(sku)
    print(sb, "mutated: orders_daily", len(od), "cpo_orders", len(cpo), "cpo_sku_daily", len(sku), "dropped day", d0, "orders", first, o2, o3)
