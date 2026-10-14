#!/usr/bin/env python3
"""FENIKS iter6: how much CPO revenue (rule «Отчет»: all non-cancelled postings of the order) sits in multi-posting orders,
and the charge rate sp/revenue for single vs multi posting orders. For September compare with xlsx «Стоимость» per order."""
import collections, json, statistics, sys
import openpyxl

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6"
D = f"{S}/{sys.argv[1]}/analytics-mvp/data/"
nd = lambda f: [json.loads(l) for l in open(D + f, encoding="utf-8") if l.strip()]
cpo = nd("cpo_orders.ndjson")
post = collections.defaultdict(list)
for r in nd("orders_daily.ndjson"):
    o = str(r.get("order") or "")
    post[o[: o.rfind("-")]].append(r)
mon = collections.defaultdict(lambda: collections.Counter())
rates = collections.defaultdict(list)
multi = []
for r in cpo:
    ps = post.get(str(r["order"]), [])
    if not ps:
        continue
    m = ps[0]["d"][:7]
    live = [p for p in ps if p.get("status") != "cancelled"]
    rev_all = sum(float(p.get("revenue") or 0) for p in ps)
    rev_live = sum(float(p.get("revenue") or 0) for p in live)
    skus = {p.get("sku") for p in ps}
    kind = "single" if len(ps) == 1 else ("multi_same_sku" if len(skus) == 1 else "multi_sku")
    mon[m][kind + "_orders"] += 1
    mon[m][kind + "_rev_live"] += rev_live
    if rev_all:
        rates[kind].append(float(r["sp"]) / rev_all)
    if kind != "single" and rev_live:
        multi.append((m, r["order"], len(ps), len(skus), round(float(r["sp"])), round(rev_all), round(rev_live), round(float(r["sp"]) / rev_all * 100, 1) if rev_all else None))
for m in sorted(mon):
    c = mon[m]
    tot = sum(v for k, v in c.items() if k.endswith("_rev_live"))
    print(m, {k: round(v) for k, v in c.items()}, "share of rev in multi-SKU orders %.1f%%" % (100 * c["multi_sku_rev_live"] / tot if tot else 0))
for k, v in rates.items():
    print("charge rate sp/rev_all", k, "n", len(v), "median %.3f p10 %.3f p90 %.3f" % (statistics.median(v), sorted(v)[len(v) // 10], sorted(v)[len(v) * 9 // 10]))
print("multi-posting orders with live revenue (month, order, postings, skus, sp, rev_all, rev_live, rate%):")
for x in sorted(multi):
    print("  ", x)
# September: xlsx per order «Стоимость» (rows, all) vs postings revenue (all) per order
xl = f"{S}/{sys.argv[1]}/analytics-mvp/data/raw/ozon-cpo/2026-09_cpo_orders.xlsx"
try:
    wb = openpyxl.load_workbook(xl, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    hi = next(i for i, r in enumerate(rows[:10]) if r and any(str(c or "").strip() == "Номер заказа" for c in r))
    h = [str(c or "").strip() for c in rows[hi]]
    io, ic, iq = h.index("Номер заказа"), h.index("Стоимость, ₽"), next(i for i, x in enumerate(h) if x.startswith("Количество"))
    xs = collections.defaultdict(lambda: [0.0, 0])
    for r in rows[hi + 1:]:
        if r and r[io]:
            xs[str(r[io]).strip()][0] += float(r[ic] or 0)
            xs[str(r[io]).strip()][1] += int(r[iq] or 0)
    ne = []
    for o, (v, q) in xs.items():
        ps = post.get(o, [])
        pv = sum(float(p.get("revenue") or 0) for p in ps)
        pq = sum(int(p.get("units") or 0) for p in ps)
        if abs(pv - v) > 1 or pq != q:
            ne.append((o, round(v), q, round(pv), pq, [(p.get("sku"), p.get("units"), p.get("revenue"), p.get("status")) for p in ps]))
    print("September xlsx orders", len(xs), "orders where xlsx Стоимость/Количество != postings (all statuses):", len(ne))
    for x in ne[:12]:
        print("  ", x)
except Exception as e:
    print("xlsx check skipped:", e)
