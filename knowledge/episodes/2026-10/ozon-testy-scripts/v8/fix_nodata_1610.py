"""Иван 16.10: «пиши нет данных». Ложные нули соинвеста -> пусто, по тем же правилам, что код:
- prices_daily: день, где price == before у >= 90% товаров (OZON перестал отдавать цену до акций с 15.10) -
  before, coinv, coinv_paid = null (prices-daily.ts NO_BEFORE_SHARE). До слияния PR сборщик на main писал
  такие дни нулями (15-19.10), поэтому правило применяется ко всем дням ряда, а не к списку дат;
- coinv_daily: строка без sku с coinv_paid_pct == 0 (витрина не снята) - поле удаляется (coinv-merge.ts noSite);
- gap_daily (ФЕНИКС 16.10, G1): те же пары «день, товар», что без SKU в coinv_daily, если gap_pct == 0 -
  gap_pct и site_to_seller = null, метка no_site = true (gap-daily.ts noSite). SKU, который мак дописал
  вечерним срезом, остаётся. Та же метка для строки gap_daily без SKU с gap_pct == 0.
Повторный запуск ничего не меняет. Остальные строки байт в байт.
Запуск из корня: python3 -I knowledge/episodes/2026-10/ozon-testy-scripts/v8/fix_nodata_1610.py
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
assert all(d >= "2026-10-15" for d in bad), bad
n1 = rewrite("prices_daily.ndjson", lambda r: {**r, "before": None, "coinv": None, "coinv_paid": None} if r["d"] in bad and r.get("before") is not None else None)

nosku = lambda r: not str(r.get("sku", "") or "").strip()
def fix2(r):
    if not nosku(r) or r.get("coinv_paid_pct") != 0: return None
    r = dict(r); del r["coinv_paid_pct"]; return r
n2 = rewrite("coinv_daily.ndjson", fix2)

pairs = {(r["date"], r["art"]) for r in (json.loads(l) for l in open(DD + "coinv_daily.ndjson", encoding="utf-8") if l.strip())
         if nosku(r) and r.get("coinv_paid_pct") in (None, 0)}
def fix3(r):
    if r.get("gap_pct") != 0 or not ((r["date"], r["art"]) in pairs or nosku(r)): return None
    return {**r, "site_to_seller": None, "gap_pct": None, "no_site": True}
n3 = rewrite("gap_daily.ndjson", fix3)
print(f"prices_daily: {n1} строк -> пусто; coinv_daily: {n2} ложных нулей -> пусто; gap_daily: {n3} строк -> no_site (пар без SKU в coinv_daily: {len(pairs)})")
