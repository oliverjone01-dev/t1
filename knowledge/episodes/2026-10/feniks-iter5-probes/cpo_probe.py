#!/usr/bin/env python3
"""FENIKS iter5: independent recomputation of CPO revenue / units / DRR from the raw xlsx + orders_daily (Seller API)
and of the «Отчет» rule from cpo_orders.ndjson. Usage: cpo_probe.py <sandbox>"""
import json, sys, re, datetime as dt
import openpyxl

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad"
SB = sys.argv[1] if len(sys.argv) > 1 else "br"
D = f"{S}/{SB}/analytics-mvp/data"
X = f"{D}/raw/ozon-cpo/2026-09_cpo_orders.xlsx"


def nd(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


# 1. raw xlsx, not the converter output
ws = openpyxl.load_workbook(X, read_only=True, data_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
per = [str(r[0]) for r in rows[:3] if r and r[0] and "Период" in str(r[0])]
hi = next(i for i, r in enumerate(rows[:6]) if r and "Номер заказа" in [str(c or "") for c in r])
H = [str(c or "") for c in rows[hi]]
ci = {h: i for i, h in enumerate(H)}
xl = []
for r in rows[hi + 1:]:
    if not r or not r[ci["Номер заказа"]]:
        continue
    dd, mm, yy = str(r[ci["Дата"]]).split(".")
    xl.append({"d": f"{yy}-{mm}-{dd}", "order": str(r[ci["Номер заказа"]]), "sku": str(r[ci["SKU"]]),
               "n": int(r[ci["Количество"]] or 0), "line": float(r[ci["Стоимость, ₽"]] or 0),
               "price": float(r[ci["Стоимость продажи, ₽"]] or 0), "sp": float(r[ci["Расход, ₽"]] or 0)})
print("xlsx", per, "rows", len(xl), "orders", len({x["order"] for x in xl}), "line", round(sum(x["line"] for x in xl)),
      "sp", round(sum(x["sp"] for x in xl), 2), "n", sum(x["n"] for x in xl))

# converter output must be the same multiset (d, order, sku, n, rev, sp)
cv = nd(f"{D}/cpo_card_orders.ndjson")
key = lambda d, o, s, n, rv, sp: (d, o, s, n, round(rv, 2), round(sp, 2))
a = sorted(key(x["d"], x["order"], x["sku"], x["n"], x["line"], x["sp"]) for x in xl)
b = sorted(key(x["d"], x["order"], x["sku"], x["n"], x["rev"], x["sp"]) for x in cv)
print("converter output == raw xlsx multiset:", a == b, len(a), len(b))

# 2. orders_daily postings (Seller API)
post = {}
for r in nd(f"{D}/orders_daily.ndjson"):
    o = str(r.get("order") or "")
    post.setdefault(o[:o.rfind("-")], []).append(r)

# 3. per-row: tab rule vs posting-level rule
tab_day, pst_day, tab_u, pst_u = {}, {}, {}, {}
diff_rows, partial, date_shift, out_win, miss = [], [], 0, [], 0
for x in xl:
    ps = post.get(x["order"], [])
    same = [p for p in ps if str(p.get("sku")) == x["sku"]]
    if not ps:
        miss += 1
    allc = bool(ps) and all(p["status"] == "cancelled" for p in ps)
    nonec = all(p["status"] != "cancelled" for p in ps)
    canc = bool(ps) and (allc or (not nonec and bool(same) and all(p["status"] == "cancelled" for p in same)))
    d = min(p["d"] for p in ps) if ps else x["d"]
    if d != x["d"]:
        date_shift += 1
    if not ("2026-09-01" <= d <= "2026-09-30"):
        out_win.append((x["order"], x["d"], d, x["line"], canc))
    if not canc:
        tab_day[d] = tab_day.get(d, 0) + x["line"]
        tab_u[d] = tab_u.get(d, 0) + x["n"]
    # posting-level: same-SKU postings that are not cancelled (Seller API revenue)
    allrev = sum(float(p.get("revenue") or 0) for p in same)
    okrev = sum(float(p.get("revenue") or 0) for p in same if p["status"] != "cancelled")
    oku = sum(int(p.get("units") or 0) for p in same if p["status"] != "cancelled")
    pst_day[d] = pst_day.get(d, 0) + okrev
    pst_u[d] = pst_u.get(d, 0) + oku
    if abs(allrev - x["line"]) > 1:
        diff_rows.append((x["order"], x["sku"], x["n"], x["line"], allrev, [p["status"] for p in same]))
    if same and any(p["status"] == "cancelled" for p in same) and any(p["status"] != "cancelled" for p in same):
        partial.append((x["order"], x["sku"], x["line"], okrev, canc))
print("rows without postings", miss, "date shifted", date_shift, "order date outside window", out_win)
print("rows: xlsx line != sum same-SKU postings revenue (all statuses):", len(diff_rows), diff_rows[:6])
print("rows with partially cancelled same-SKU postings:", partial)

# 4. «Отчет» rule from report-page.ts on cpo_orders.ndjson (per order, all postings non-cancelled)
co = nd(f"{D}/cpo_orders.ndjson")
cnt = {}
for r in co:
    cnt[r["order"]] = cnt.get(r["order"], 0) + 1
dup = {k: v for k, v in cnt.items() if v > 1}
rep_day = {}
for r in co:
    ps = post.get(str(r["order"]))
    if not ps:
        continue
    d = str(ps[0]["d"])
    rep_day[d] = rep_day.get(d, 0) + sum(float(p.get("revenue") or 0) for p in ps if p["status"] != "cancelled")
sk = nd(f"{D}/cpo_sku_daily.ndjson")
cf, ct = min(r["d"] for r in sk), max(r["d"] for r in sk)
print("cpo_orders rows", len(co), "dup orders", len(dup), "cpo_sku_daily coverage", cf, ct)
xo = {x["order"] for x in xl}
co_sep = {r["order"] for r in co if post.get(r["order"]) and "2026-09-01" <= min(p["d"] for p in post[r["order"]]) <= "2026-09-30"}
print("Sep orders: xlsx", len(xo), "cpo_orders (by min posting date)", len(co_sep), "xlsx-only", sorted(xo - co_sep)[:5], "cpo_orders-only", sorted(co_sep - xo)[:5])

# 5. CPO spend per day from ads_daily (Performance API), campaign by name
ad = nd(f"{D}/ads_daily.ndjson")
cpo_sp = {}
for r in ad:
    if re.search("за заказ", str(r.get("off") or r.get("name") or ""), re.I):
        cpo_sp[r["d"]] = cpo_sp.get(r["d"], 0) + float(r.get("sp") or 0)
xl_sp = {}
for x in xl:
    xl_sp[x["d"]] = xl_sp.get(x["d"], 0) + x["sp"]
print("CPO spend Sep: API", round(sum(v for d, v in cpo_sp.items() if "2026-09-01" <= d <= "2026-09-30"), 2), "xlsx", round(sum(xl_sp.values()), 2))
WIN = json.load(open(f"{D}/cpo_card_windows.json"))

P = [("2026-06-01", "2026-06-30"), ("2026-07-01", "2026-07-31"), ("2026-08-01", "2026-08-31"), ("2026-09-01", "2026-09-30"), ("2026-10-01", "2026-10-12"),
     ("2026-07-01", "2026-07-15"), ("2026-07-16", "2026-07-31"), ("2026-08-01", "2026-08-15"), ("2026-08-16", "2026-08-31"), ("2026-09-01", "2026-09-15"), ("2026-09-16", "2026-09-30"),
     ("2026-09-01", "2026-09-07"), ("2026-09-08", "2026-09-14"), ("2026-09-15", "2026-09-21"), ("2026-09-22", "2026-09-28"), ("2026-08-29", "2026-08-31"), ("2026-09-29", "2026-10-05"),
     ("2026-10-01", "2026-10-10"), ("2026-07-01", "2026-09-30"), ("2026-08-15", "2026-09-15"), ("2026-09-20", "2026-10-10"), ("2026-06-15", "2026-07-15"), ("2026-09-04", "2026-09-04"), ("2026-06-01", "2026-10-12"),
     ("2026-08-31", "2026-08-31"), ("2026-09-30", "2026-09-30"), ("2026-08-25", "2026-09-05")]


def ssum(m, f, t):
    return sum(v for d, v in m.items() if f <= d <= t)


out = {}
for f, t in P:
    nall = (dt.date.fromisoformat(t) - dt.date.fromisoformat(f)).days + 1
    cov = [(max(w[0], f), min(w[1], t)) for w in WIN if max(w[0], f) <= min(w[1], t)]
    ncov = sum((dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days + 1 for a, b in cov)
    rv, u = round(ssum(tab_day, f, t)), ssum(tab_u, f, t)
    spc = sum(ssum(cpo_sp, a, b) for a, b in cov)
    spall = ssum(cpo_sp, f, t)
    repcov = (f >= cf[:7] + "-01" and t <= ct) or not round(spall)
    rep = round(ssum(rep_day, f, t)) if repcov else None
    out[f"{f}..{t}"] = {"tab_rev": rv, "tab_u": u, "pst_rev": round(ssum(pst_day, f, t)), "pst_u": ssum(pst_u, f, t),
                       "drr_win": round(spc / rv * 100, 1) if rv else None, "days": f"{ncov} из {nall}", "sp_win": round(spc), "sp_all": round(spall),
                       "drr_all": round(spall / rv * 100, 1) if rv else None, "report_rule": rep, "report_rule_nocov": round(ssum(rep_day, f, t))}
    print(f, t, json.dumps(out[f"{f}..{t}"], ensure_ascii=False))
json.dump(out, open(f"{S}/cpo_probe_{SB}.json", "w"), ensure_ascii=False)
