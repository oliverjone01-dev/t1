"""V3 (Иван 15.10, ответ «б» на ФЕНИКС iter3): 27 выводимых артикулов убрать из счёта карточки в базе и в окне,
пороги пересчитать тем же правилом. План v2 не правится: пишется новая заморозка data/plan_2026-10-15_v3.json.
- withdrawn: список 27 артикулов (страница исключает их товары из карточек);
- база карточки 14.09-11.10 без отмен, день по МСК (orders_daily.t + 3 ч), без выводимых;
- порог: наименьший N, при котором карточка без эффекта (Пуассон, λ = база/2 за 14 дней) проходит не чаще 15% (cards7.threshold);
- u_wk_base = база/4; порог с ценой сдвигается на ту же разницу к порогу, что в v2 [ГИПОТЕЗА, модель цены не пересчитана].
Пересчёт только у карточек, где выводимые давали заказы в базе; у остальных пороги как в Excel.
Запуск из корня репо: python3 -I knowledge/episodes/2026-10/ozon-testy-scripts/v8/withdraw_base_1510.py
"""
import json, math, re, datetime as dt
DD = "analytics-mvp/data/"
SRC, DST = DD + "plan_2026-10-15_v2.json", DD + "plan_2026-10-15_v3.json"
BASE = ("2026-09-14", "2026-10-11")
corr = open("knowledge/episodes/2026-10/ozon-testy-scripts/v8/correct_plan_1510.py", encoding="utf-8").read()
OUT = sorted(re.search(r'OUT = set\("""(.*?)"""', corr, re.S).group(1).split())
assert len(OUT) == 27


def pois_sf(k, lam):                                   # P(X >= k), как в v7/cards7.py
    return 1 - sum(math.exp(-lam) * lam ** i / math.factorial(i) for i in range(k))


def threshold(base, alpha=0.15):
    k = 0
    while pois_sf(k, base / 2) > alpha: k += 1
    return k


def day(o):                                            # день по Москве, как orderDay в plan-tab.ts
    if not o.get("t"): return o["d"]
    return (dt.datetime.fromisoformat(o["t"].replace("Z", "+00:00")) + dt.timedelta(hours=3)).date().isoformat()


P = json.load(open(SRC, encoding="utf-8"))
G = json.load(open(DD + "card_groups.json", encoding="utf-8"))["groups"]
off2sku = {s["offer"]: str(s["sku"]) for g in G for s in g["skus"]}
assert set(OUT) <= set(off2sku), set(OUT) - set(off2sku)
od = [json.loads(l) for l in open(DD + "orders_daily.ndjson", encoding="utf-8") if l.strip()]
units = lambda ss: sum(int(o["units"]) for o in od if o["status"] != "cancelled" and str(o["sku"]) in ss and BASE[0] <= day(o) <= BASE[1])
wsku = {off2sku[a] for a in OUT}
seen, rows = set(), []
for c in P["cards"]:
    ms = off2sku[c["main_art"]]
    skus = {str(s["sku"]) for g in G if any(str(s["sku"]) == ms for s in g["skus"]) for s in g["skus"]}
    w = skus & wsku; seen |= w
    b_all, b_out = units(skus), units(w)
    if not b_out:
        rows.append((c["short"], b_all, b_out, c["threshold"], c["threshold"])); continue
    # правило воспроизводит порог Excel на полной базе - иначе пересчёт не «тем же правилом»
    assert threshold(b_all) == c["threshold"], (c["short"], b_all, threshold(b_all), c["threshold"])
    thr = threshold(b_all - b_out)
    if c["threshold_price"] is not None: c["threshold_price"] = thr + (c["threshold_price"] - c["threshold"])
    rows.append((c["short"], b_all, b_out, c["threshold"], thr))
    c["threshold"] = thr; c["u_wk_base"] = round((b_all - b_out) / 4, 2)
    c["v_wk_base"] = None                              # оборот базы без выводимых не пересчитан, страница его не читает
assert seen == wsku, "выводимые вне карточек плана"
P["withdrawn"] = OUT
P["source"] += " | v3 15.10: 27 выводимых вне счёта карточки в базе и окне, пороги по правилу 15% (Иван 15.10, «б»)"
json.dump(P, open(DST, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("карточка | база всего / от выводимых | порог v2 -> v3")
for r in rows: print(f"{r[0]} | {r[1]} / {r[2]} | {r[3]} -> {r[4]}")
