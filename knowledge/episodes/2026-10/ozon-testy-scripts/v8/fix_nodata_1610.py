"""Иван 16.10: «пиши нет данных», 19.10: то же для строк со SKU. Ложные нули соинвеста -> пусто, по тем же
правилам, что код:
- prices_daily: день, где price == before у >= 90% товаров (OZON с 15.10 отдаёт нашу цену в обоих полях) -
  before, coinv, coinv_paid = null (prices-daily.ts NO_BEFORE_SHARE). Правило применяется ко всем дням ряда;
- coinv_daily: цена сайта равна нашей (coinv_paid_pct == 0 или site_paid == cap) - поле удаляется, метка
  no_site = true (coinv-merge.ts noSite);
- gap_daily: gap_pct == 0 или site_to_seller == 1 - gap_pct и site_to_seller = null, метка no_site = true
  (gap-daily.ts noSite). SKU остаётся.
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

def fix2(r):
    zero = r.get("coinv_paid_pct") == 0
    same = r.get("site_paid") is not None and r.get("cap") is not None and round(r["site_paid"]) == round(r["cap"])
    if not (zero or same) or (not zero and r.get("coinv_paid_pct") is not None): return None
    if r.get("no_site") is True and "coinv_paid_pct" not in r: return None
    r = dict(r); r.pop("coinv_paid_pct", None); r["no_site"] = True; return r
n2 = rewrite("coinv_daily.ndjson", fix2)

def fix3(r):
    if r.get("gap_pct") != 0 and r.get("site_to_seller") != 1: return None
    return {**r, "site_to_seller": None, "gap_pct": None, "no_site": True}
n3 = rewrite("gap_daily.ndjson", fix3)
print(f"prices_daily: {n1} строк -> пусто; coinv_daily: {n2} строк -> no_site; gap_daily: {n3} строк -> no_site")
