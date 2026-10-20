"""Проба iter3: что изменили снимки main в data/ и задевают ли они входы раздела 5.
Входы раздела 5 по plan-tab.ts: orders_daily.ndjson, prices_daily.ndjson, gap_daily.ndjson, gap_manual.ndjson,
plan_2026-10-15_v4.json, plan_card_groups_1510.json, cabinet_orders_check.ndjson (если есть).
Запуск: python3 -I p_data_iter3.py <data_old> <data_new>
ФЕНИКС 2026-10-20, PR #490 iter3."""
import sys, os, json, hashlib, datetime as dt

OLD, NEW = sys.argv[1], sys.argv[2]


def sha(p):
    h = hashlib.sha1()
    with open(p, "rb") as fh:
        h.update(fh.read())
    return h.hexdigest()[:12]


fo = {f for f in os.listdir(OLD) if os.path.isfile(os.path.join(OLD, f))}
fn = {f for f in os.listdir(NEW) if os.path.isfile(os.path.join(NEW, f))}
print(f"файлов: old={len(fo)} new={len(fn)}; только в old: {sorted(fo - fn)}; только в new: {sorted(fn - fo)}")
diff = sorted(f for f in fo & fn if sha(os.path.join(OLD, f)) != sha(os.path.join(NEW, f)))
print(f"изменённые файлы ({len(diff)}): {diff}")

SEC5 = ["orders_daily.ndjson", "prices_daily.ndjson", "gap_daily.ndjson", "gap_manual.ndjson",
        "plan_2026-10-15_v4.json", "plan_card_groups_1510.json", "cabinet_orders_check.ndjson"]
print("\nвходы раздела 5:")
for f in SEC5:
    po, pn = os.path.join(OLD, f), os.path.join(NEW, f)
    if not os.path.exists(po) and not os.path.exists(pn):
        print(f"  {f}: нет ни в old, ни в new")
        continue
    so = sha(po) if os.path.exists(po) else "нет"
    sn = sha(pn) if os.path.exists(pn) else "нет"
    print(f"  {f}: old {so} new {sn} -> {'без изменений' if so == sn else 'ИЗМЕНЁН'}")


def nd(p):
    with open(p, encoding="utf-8") as fh:
        return [json.loads(l) for l in fh if l.strip()]


def msk(r):
    t = r.get("t")
    return (dt.datetime.fromisoformat(t.replace("Z", "+00:00")) + dt.timedelta(hours=3)).date().isoformat() if t else r["d"]


for tag, D in (("old", OLD), ("new", NEW)):
    od = nd(os.path.join(D, "orders_daily.ndjson"))
    raw_last = max(r["d"] for r in od)
    ml = max(m for m in (msk(r) for r in od) if m <= raw_last)
    keys = {(r["order"], r["sku"]) for r in od}
    pr = nd(os.path.join(D, "prices_daily.ndjson"))
    gp = nd(os.path.join(D, "gap_daily.ndjson"))
    days = (min(dt.date.fromisoformat(ml), dt.date(2026, 10, 28)) - dt.date(2026, 10, 15)).days + 1
    print(f"\n[{tag}] orders_daily: строк {len(od)}, (order, sku) уникальных {len(keys)}, последний сырой d {raw_last}, "
          f"последний день по Москве не позже сырого {ml}")
    print(f"[{tag}] prices_daily: строк {len(pr)}, последний d {max(r['d'] for r in pr)}; "
          f"gap_daily: строк {len(gp)}, последняя date {max(r['date'] for r in gp)}")
    print(f"[{tag}] окно раздела 5: 2026-10-15..min({ml}, 2026-10-28) = {days} дн")
