#!/usr/bin/env python3
"""ФЕНИКС, аудит PR #492 (2026-10-20): независимая сверка orders_daily.ndjson old (v2) против new (v3/v4).

Читает файлы прямо из git (ничего не копирует в репо):
  old = <base>:analytics-mvp/data/orders_daily.ndjson   (по умолчанию origin/main)
  new = <rev>:analytics-mvp/data/orders_daily.ndjson    (по умолчанию 5af7089)
  bad = 99149e2 (прогон 39439844466, выручка 0) - для подтверждения симптома E093.

Запуск из корня репо:  python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-orders-v3/compare_orders.py [rev] [base]
Логика написана заново, код сборщика не импортируется (сверка не по самому себе).
"""
import collections
import json
import subprocess
import sys

REV = sys.argv[1] if len(sys.argv) > 1 else "5af708906c20474c82c5429080ad5ae6bb7c9160"
BASE = sys.argv[2] if len(sys.argv) > 2 else "origin/main"
BAD = "99149e2"
PATH = "analytics-mvp/data/orders_daily.ndjson"


def load(ref):
    txt = subprocess.run(["git", "show", f"{ref}:{PATH}"], capture_output=True, text=True, check=True).stdout
    rows = [json.loads(l) for l in txt.split("\n") if l.strip()]
    return rows


def by_key(rows, name):
    c = collections.Counter(r["order"] for r in rows)
    d = {k: v for k, v in c.items() if v > 1}
    print(f"[{name}] строк {len(rows)}, уникальных order {len(c)}, дублей ключа {len(d)}")
    return {r["order"]: r for r in rows}


old_rows, new_rows, bad_rows = load(BASE), load(REV), load(BAD)
old, new = by_key(old_rows, "old " + BASE), by_key(new_rows, "new " + REV[:7])
bad = by_key(bad_rows, "bad " + BAD)

missing = sorted(set(old) - set(new))
added = sorted(set(new) - set(old))
print(f"\nпропало (есть в old, нет в new): {len(missing)}")
print(f"добавлено (есть в new, нет в old): {len(added)}")
print("  добавлено по d:", dict(sorted(collections.Counter(new[k]["d"] for k in added).items())))
print("  добавлено по scheme:", dict(collections.Counter(new[k]["scheme"] for k in added)))

# заказы по дням 15-19.10 в new (ряд из self-check: 19/18/25/25/24)
print("  заказов по d 15-19.10 в new:", {d: sum(1 for r in new_rows if r["d"] == d) for d in
                                           ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19"]})
print("  заказов по d 15-18.10 в old:", {d: sum(1 for r in old_rows if r["d"] == d) for d in
                                           ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19"]})

# поля у общих заказов
common = sorted(set(old) & set(new))
fields = sorted(set().union(*[set(r) for r in old_rows]) | set().union(*[set(r) for r in new_rows]))
diff = collections.Counter()
examples = collections.defaultdict(list)
for k in common:
    a, b = old[k], new[k]
    for f in fields:
        if a.get(f) != b.get(f):
            diff[f] += 1
            if len(examples[f]) < 2:
                examples[f].append((k, a.get(f), b.get(f)))
print(f"\nобщих заказов: {len(common)}")
print("поля, где old != new (число заказов):", dict(sorted(diff.items())))
for f in ["revenue", "paid", "units", "sku", "offer", "d", "t"]:
    print(f"  {f}: расхождений {diff.get(f, 0)}")
print("  scheme переходы:", dict(collections.Counter((old[k]["scheme"], new[k]["scheme"]) for k in common
                                                     if old[k]["scheme"] != new[k]["scheme"])))
print("  status переходы (топ 6):", collections.Counter((old[k]["status"], new[k]["status"]) for k in common
                                                       if old[k]["status"] != new[k]["status"]).most_common(6))

# многоштучные заказы: проверка семантики customer_price x quantity (если per-unit сменился на total - разъедется)
multi = [k for k in common if (old[k].get("units") or 0) > 1]
multi_paid = [k for k in multi if old[k].get("paid") is not None]
print(f"\nмногоштучных общих заказов: {len(multi)}, из них с paid: {len(multi_paid)}, "
      f"paid расходится: {sum(1 for k in multi_paid if old[k]['paid'] != new[k]['paid'])}, "
      f"revenue расходится: {sum(1 for k in multi if old[k]['revenue'] != new[k]['revenue'])}")

# выручка по месяцам d
def month_rev(rows):
    m = collections.defaultdict(int)
    for r in rows:
        m[r["d"][:7]] += r.get("revenue") or 0
    return dict(sorted(m.items()))
mo, mn = month_rev(old_rows), month_rev(new_rows)
print("\nвыручка по месяцам d (old | new | дельта):")
for m in sorted(set(mo) | set(mn)):
    print(f"  {m}: {mo.get(m, 0):>12,} | {mn.get(m, 0):>12,} | {mn.get(m, 0) - mo.get(m, 0):>+11,}")

# схема и paid
def scheme_stats(rows, name):
    s = collections.defaultdict(lambda: [0, 0, 0])
    for r in rows:
        x = s[r.get("scheme") or ""]
        x[0] += 1; x[1] += r.get("revenue") or 0; x[2] += (r.get("paid") is not None)
    tot_n = len(rows); tot_r = sum(r.get("revenue") or 0 for r in rows)
    print(f"[{name}] по scheme: " + "; ".join(f"{k}: n={v[0]} ({v[0]/tot_n:.2%}), revenue={v[1]:,} ({v[1]/tot_r:.2%}), paid={v[2]}" for k, v in sorted(s.items())))
print()
scheme_stats(old_rows, "old"); scheme_stats(new_rows, "new")

# t и d согласованы (d = UTC-дата t)
bad_dt = [r["order"] for r in new_rows if r.get("t") and r["t"][:10] != r["d"]]
print(f"\nnew: строк, где d != t[:10]: {len(bad_dt)}; строк без t: {sum(1 for r in new_rows if not r.get('t'))}")

# симптом E093 в плохом прогоне
print(f"\nbad {BAD}: revenue==0 у {sum(1 for r in bad_rows if not r.get('revenue'))} из {len(bad_rows)}, "
      f"paid null у {sum(1 for r in bad_rows if r.get('paid') is None)}")

# итоги, которые сравнивает checkTotals (rows, revenue, paid не null)
def totals(rows):
    return {"rows": len(rows), "revenue": sum(r.get("revenue") or 0 for r in rows),
            "paid": sum(1 for r in rows if r.get("paid") is not None)}
print("\ntotals old:", totals(old_rows))
print("totals new:", totals(new_rows))
