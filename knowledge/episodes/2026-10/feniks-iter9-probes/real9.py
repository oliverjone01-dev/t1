#!/usr/bin/env python3
"""FENIKS iter9: the real September export through the branch collectors (p9), starting from the committed (legacy) outputs.
Independent re-implementation of cpoOrdersByDay in Python (sum charges per order, day = earliest posting, revenue/units of
non-cancelled postings) to compare legacy vs converted cpo_orders. Temp dirs only."""
import collections, filecmp, importlib.util, json, os, shutil, sys, tempfile

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9"
P = S + "/p9/analytics-mvp"
X = P + "/data/raw/ozon-cpo/2026-09_cpo_orders.xlsx"
T = P + "/tools"
sys.path.insert(0, T + "/cpo")
from cpo_raw import read_raw  # noqa: E402


def load(p, n):
    s = importlib.util.spec_from_file_location(n, p)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


def nd(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


postings = collections.defaultdict(list)
for r in nd(P + "/data/orders_daily.ndjson"):
    o = str(r.get("order") or "")
    postings[o[: o.rfind("-")]].append(r)


def by_day(cpo_rows):
    sp = collections.defaultdict(float)
    for r in cpo_rows:
        sp[str(r["order"])] += float(r["sp"])
    day = collections.defaultdict(lambda: [0.0, 0.0, 0])
    miss = 0
    for o, v in sp.items():
        ps = postings.get(o)
        if not ps:
            miss += 1
            continue
        d0 = min(str(p["d"]) for p in ps)
        a = day[d0]
        a[0] += v
        for p in ps:
            if p.get("status") != "cancelled":
                a[1] += float(p.get("revenue") or 0)
                a[2] += int(p.get("units") or 0)
    return {d: (round(a[0], 2), round(a[1], 2), a[2]) for d, a in day.items()}, miss, round(sum(sp.values()), 2), len(sp)


def run(raw, data, tag):
    jo = load(T + "/orders/build_order_joins.py", "jo_" + tag)
    jo.CPO_RAW, jo.OUT_CPO, jo.CPO_ONLY = raw, os.path.join(data, "cpo_orders.ndjson"), True
    jo.main()
    sk = load(T + "/cpo/build_cpo_sku_daily.py", "sk_" + tag)
    sk.RAW, sk.OUT = raw, os.path.join(data, "cpo_sku_daily.ndjson")
    sk.main()


res = {}
legacy = nd(P + "/data/cpo_orders.ndjson")
res["committed cpo_orders rows"] = len(legacy)
res["committed rows with d"] = sum(1 for r in legacy if r.get("d"))
L_day, L_miss, L_tot, L_n = by_day(legacy)
res["legacy: orders, total, miss, days"] = (L_n, L_tot, L_miss, len(L_day))

# cross-month check: September raw per-order sums vs legacy per-order sp
rows, used, _ = read_raw(os.path.dirname(X))
raw_sp = collections.defaultdict(float)
raw_days = collections.defaultdict(set)
for r in rows:
    if r["order"]:
        raw_sp[r["order"]] += r["sp"]
        raw_days[r["order"]].add(r["d"])
leg = {str(r["order"]): float(r["sp"]) for r in legacy}
diff = {o: (round(leg.get(o, 0), 2), round(v, 2)) for o, v in raw_sp.items() if abs(leg.get(o, 0) - v) > 0.005}
res["Sep raw: window, orders, total"] = (used[0][1], len(raw_sp), round(sum(raw_sp.values()), 2))
res["Sep raw orders whose legacy sp != raw sp (cross-month parts that conversion would drop)"] = diff
res["Sep raw orders with >1 charge day"] = {o: sorted(d) for o, d in raw_days.items() if len(d) > 1}

for tag, names in (("once", ["2026-09_cpo_orders.xlsx"]), ("with (1) copy", ["2026-09_cpo_orders.xlsx", "2026-09_cpo_orders (1).xlsx"])):
    root = tempfile.mkdtemp(prefix="r9_", dir=S)
    raw, data = os.path.join(root, "raw"), os.path.join(root, "data")
    os.makedirs(raw); os.makedirs(data)
    for n in names:
        shutil.copy(X, os.path.join(raw, n))
    for f in ("cpo_orders.ndjson", "cpo_sku_daily.ndjson"):
        shutil.copy(P + "/data/" + f, os.path.join(data, f))
    run(raw, data, tag.replace(" ", "_") + "1")
    first = open(os.path.join(data, "cpo_orders.ndjson"), "rb").read()
    run(raw, data, tag.replace(" ", "_") + "2")
    second = open(os.path.join(data, "cpo_orders.ndjson"), "rb").read()
    conv = nd(os.path.join(data, "cpo_orders.ndjson"))
    C_day, C_miss, C_tot, C_n = by_day(conv)
    res[tag] = {
        "rows": len(conv), "rows with d": sum(1 for r in conv if r.get("d")),
        "months of d": dict(collections.Counter(str(r.get("d"))[:7] for r in conv)),
        "orders, total, miss, days": (C_n, C_tot, C_miss, len(C_day)),
        "per-day (sp, rev, units) equal to legacy": C_day == L_day,
        "second run byte-equal to first": first == second,
        "cpo_sku_daily byte-equal committed": filecmp.cmp(os.path.join(data, "cpo_sku_daily.ndjson"), P + "/data/cpo_sku_daily.ndjson", shallow=False),
    }
    if C_day != L_day:
        res[tag]["day diffs"] = {d: (L_day.get(d), C_day.get(d)) for d in sorted(set(L_day) | set(C_day)) if L_day.get(d) != C_day.get(d)}
print("=== RESULTS ===")
for k, v in res.items():
    print(k, "=>", json.dumps(v, ensure_ascii=False, default=str))
