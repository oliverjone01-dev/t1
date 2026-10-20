"""Проба (г2): имена 29 артикулов плана против offer в orders_daily и prices_daily (ноль заказов = нет продаж или
несовпадение имени?). Кириллица в артикуле, символ «|» (ключ odArt режется по нему), строки за всю историю.
Запуск: python3 -I p_g2_names.py <data_dir>
ФЕНИКС 2026-10-20, аудит PR #490."""
import sys, json, collections

DATA = sys.argv[1]
P = json.load(open(f"{DATA}/plan_2026-10-15_v4.json", encoding="utf-8"))
rows = [json.loads(l) for l in open(f"{DATA}/orders_daily.ndjson", encoding="utf-8") if l.strip()]
cnt = collections.Counter(r["offer"] for r in rows)
last = {}
for r in rows:
    last[r["offer"]] = max(last.get(r["offer"], ""), r["d"])
pr = collections.Counter(json.loads(l)["offer"] for l in open(f"{DATA}/prices_daily.ndjson", encoding="utf-8") if l.strip())
print("offer с символом | в orders_daily:", [o for o in cnt if "|" in o] or "нет")
print("offer с не-ASCII в orders_daily:", sorted(o for o in cnt if any(ord(c) >= 128 for c in o)) or "нет")
zero_ever = []
for p in P["price"]:
    a = p["art"]
    na = [c for c in a if ord(c) >= 128]
    if cnt.get(a, 0) == 0:
        zero_ever.append(a)
    print(f"  {a:22s} строк orders_daily за всё время: {cnt.get(a, 0):3d}  последний день: {last.get(a, '-'):10s}  строк prices_daily: {pr.get(a, 0):3d}  не-ASCII: {na or '-'}")
print("артикулы плана без единой строки в orders_daily за всю историю:", zero_ever or "нет")
