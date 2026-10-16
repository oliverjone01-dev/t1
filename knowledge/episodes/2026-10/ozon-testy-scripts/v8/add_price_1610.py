"""V4 (Иван 16.10): «добавь три артикула QUATRIS и три артикула PROFIX на снижение цены с 16.10», размер -10% от цены 15.10
(ответ на вопрос, вариант «рекомендую»). План v3 не правится: пишется новая заморозка data/plan_2026-10-15_v4.json.
- QUATRIS GGT-48-2-2/3-3/5-1-100-180, PROFIX GGT-46-2-2/3-3/5-1-100. GGT-48-2-2 (было с 15.10) и GGT-48-5-1 (было с 22.10)
  уже стояли в таблице: строки заменяются, срок 16.10, база - цена 15.10;
- price_now = наша цена 15.10 из prices_daily (с 23.09 там предельная, как у остальных строк плана);
- price_new = price_now * 0.9, округление до 10 ₽, как в Excel плана (79282 -> 71350);
- site_now = price_now * site_to_seller из gap_daily за 15.10, site_new = site_now * 0.9 (справочно, страница не читает);
- карточки, пороги и окно плана не меняются. QUATRIS в группе карточки KONUX, PROFIX - TRUBIS L120: их заказы там и так считаются.
Запуск из корня репо: python3 -I knowledge/episodes/2026-10/ozon-testy-scripts/v8/add_price_1610.py
"""
import json
DD = "analytics-mvp/data/"
SRC, DST = DD + "plan_2026-10-15_v3.json", DD + "plan_2026-10-15_v4.json"
DAY, WHEN, CUT = "2026-10-15", "16.10", 0.10
ARTS = ["GGT-48-2-2-100-180", "GGT-48-3-3-100-180", "GGT-48-5-1-100-180", "GGT-46-2-2-100", "GGT-46-3-3-100", "GGT-46-5-1-100"]

P = json.load(open(SRC, encoding="utf-8"))
nd = lambda f: (json.loads(l) for l in open(DD + f, encoding="utf-8") if l.strip())
price = {r["offer"]: float(r["price"]) for r in nd("prices_daily.ndjson") if r.get("d") == DAY and r.get("offer") in ARTS}
s2s = {r["art"]: float(r["site_to_seller"]) for r in nd("gap_daily.ndjson") if r.get("date") == DAY and r.get("art") in ARTS and r.get("site_to_seller")}
assert set(price) == set(ARTS), ("нет цены 15.10", set(ARTS) - set(price))
assert set(s2s) == set(ARTS), ("нет витрины 15.10", set(ARTS) - set(s2s))
live = {x["offer"]: x["name"] for x in json.load(open(DD + "skus_live_30d.json", encoding="utf-8"))["sku_table"]}
tax = {v["offer"]: f'{v["sub"]} {v["model"]}' for v in json.load(open(DD + "sku_taxonomy.json", encoding="utf-8")).values() if isinstance(v, dict) and v.get("offer")}
names = {a: live.get(a) or tax.get(a) or a for a in ARTS}       # имя: карточка за 30 дней, иначе таксономия
old = {p["art"]: p for p in P["price"]}
assert not set(ARTS) & set(P["withdrawn"]), "артикул в выводимых"

n0 = len(P["price"])
P["price"] = [p for p in P["price"] if p["art"] not in ARTS]
rows = []
for a in ARTS:
    now = round(price[a]); new = int(round(now * (1 - CUT) / 10) * 10)
    site = round(now * s2s[a])
    name = old[a]["name"] if a in old else names[a]
    assert new < now and abs(new / now - (1 - CUT)) < 0.001, (a, now, new)
    rows.append({"art": a, "name": name, "when": WHEN, "when_note": "16.10 (Иван 16.10, QUATRIS и PROFIX)",
                 "price_now": now, "step": "-10%", "price_new": new, "site_now": site, "site_new": round(site * (1 - CUT))})
P["price"] += rows
assert len(P["price"]) == n0 - len(set(ARTS) & set(old)) + len(ARTS) == 29, len(P["price"])
P["source"] += " | v4 16.10: +QUATRIS и PROFIX на -10% от цены 15.10 с 16.10, QUATRIS 100 из 15.10 и 22.10 перенесены (Иван 16.10)"
json.dump(P, open(DST, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("артикул | было | цена 15.10 -> целевая")
for r in rows:
    o = old.get(r["art"]); print(f'{r["art"]} | {o["when"] + " " + str(o["price_now"]) + "->" + str(o["price_new"]) if o else "нет"} | {r["price_now"]} -> {r["price_new"]}')
