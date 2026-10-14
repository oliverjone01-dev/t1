#!/usr/bin/env python3
"""FENIKS iter7 fixtures (scratch copies of p7 only):
fzA (N6): export starts mid-month - cpo_orders rows whose order date (first posting) < 2026-06-15 and cpo_sku_daily rows < 2026-06-15 removed.
          The campaign spent from 05.06, so 05-14.06 have spend but no known revenue.
fzB (N5): ads_daily without any row of 28753239 (export campaign absent from the API series).
usage: fuzz7.py fzA|fzB"""
import json, sys

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i7"
which = sys.argv[1]
D = f"{S}/{which}/analytics-mvp/data/"


def rd(f):
    return [json.loads(l) for l in open(D + f, encoding="utf-8") if l.strip()]


def wr(f, rows):
    with open(D + f, "w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")


if which == "fzA":
    od = rd("orders_daily.ndjson")
    first = {}
    for r in od:
        o = str(r.get("order") or "")
        k = o[: o.rfind("-")]
        first.setdefault(k, r["d"])
    cpo = rd("cpo_orders.ndjson")
    keep = [r for r in cpo if first.get(str(r["order"]), "9999") >= "2026-06-15"]
    sku = rd("cpo_sku_daily.ndjson")
    keep2 = [r for r in sku if str(r["d"]) >= "2026-06-15"]
    wr("cpo_orders.ndjson", keep)
    wr("cpo_sku_daily.ndjson", keep2)
    print("fzA cpo_orders", len(cpo), "->", len(keep), "cpo_sku_daily", len(sku), "->", len(keep2))
elif which == "fzB":
    ads = rd("ads_daily.ndjson")
    keep = [r for r in ads if str(r["id"]) != "28753239"]
    wr("ads_daily.ndjson", keep)
    print("fzB ads_daily", len(ads), "->", len(keep))
