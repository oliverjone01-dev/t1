"""Иван 16.10: «пиши нет данных». Ложные нули соинвеста за 15-16.10 -> пусто, по тем же правилам, что код:
- prices_daily: день, где price == before у >= 90% товаров (OZON перестал отдавать цену до акций с 15.10) -
  before, coinv, coinv_paid = null (prices-daily.ts NO_BEFORE_SHARE);
- coinv_daily: строка без sku с coinv_paid_pct == 0 (витрина не снята) - поле удаляется (coinv-merge.ts).
Остальные строки байт в байт. Запуск из корня: python3 -I knowledge/episodes/2026-10/ozon-testy-scripts/v8/fix_nodata_1610.py
"""
import json, collections
DD = "analytics-mvp/data/"

def rewrite(f, fix):
    L = open(DD + f, encoding="utf-8").read().split("\n")
    out, n = [], 0
    for l in L:
        if not l.strip(): out.append(l); continue
        r = json.loads(l); r2 = fix(r)
        if r2 is None: out.append(l); continue
        out.append(json.dumps(r2, ensure_ascii=False, separators=(",", ":") if '":' in l and '": ' not in l else (", ", ": "))); n += 1
    open(DD + f, "w", encoding="utf-8").write("\n".join(out))
    return n

rows = [json.loads(l) for l in open(DD + "prices_daily.ndjson", encoding="utf-8") if l.strip()]
tot, same = collections.Counter(), collections.Counter()
for r in rows:
    tot[r["d"]] += 1; same[r["d"]] += r.get("before") is not None and r["price"] == r["before"]
bad = {d for d in tot if same[d] / tot[d] >= 0.9}
print("дни без цены до акций:", sorted(bad))
assert bad <= {"2026-10-15", "2026-10-16", "2026-10-17"}, bad
n1 = rewrite("prices_daily.ndjson", lambda r: {**r, "before": None, "coinv": None, "coinv_paid": None} if r["d"] in bad and r.get("before") is not None else None)
def fix2(r):
    if str(r.get("sku", "")).strip() or r.get("coinv_paid_pct") != 0: return None
    r = dict(r); del r["coinv_paid_pct"]; return r
n2 = rewrite("coinv_daily.ndjson", fix2)
print(f"prices_daily: {n1} строк -> пусто; coinv_daily: {n2} ложных нулей -> пусто")
