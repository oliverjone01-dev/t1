"""Корректировка плана 15.10 (Иван 15.10, сообщение в сессии):
- 27 артикулов выводятся - убрать из минимального клика (с 15.10, пороги как в Excel, факт по ним не показывать);
- в снижении цены GGT-12-2 заменить на GGT-03-3-3-E-16080 (TRUBIS 160): снижение 15.10, -10% до 87 210 ₽.
Старый план не правится: пишется новая заморозка data/plan_2026-10-15_v2.json.
Запуск из корня репо: python3 -I knowledge/episodes/2026-10/ozon-testy-scripts/v8/correct_plan_1510.py
"""
import json, sys
SRC = "analytics-mvp/data/plan_2026-10-15.json"
DST = "analytics-mvp/data/plan_2026-10-15_v2.json"
OUT = set("""GGT-03-3-1-E-12080 GGT-03-3-4-E-12080 GGM-03-2-2 GGM-08-3-M GGM-16-1-1 GGM-16-2-1 GGM-02-2-1 GGM-02-3-1
GGM-17-1-1 GGM-17-2-3 GGT-03-3-1-L-80 GGL-01-M-2 GGL-01-S-2 GGL-11 GGK-02-1-3-80 GGK-02-1-4-80 GGK-02-2-3-80
GGK-02-2-4-80 GGK-02-2-5-80 GGK-02-3-3-80 GGK-02-3-5-80 GGM-15-1-1 GGM-15-1-2-M GGM-15-2-2-L GGM-15-3-2-M
GGM-24-1-M GGM-24-3""".split())
assert len(OUT) == 27
P = json.load(open(SRC, encoding="utf-8"))
found = set()
for c in P["cards"]:
    assert c["main_art"] not in OUT, c["main_art"]
    keep = [a for a in c["min_arts"] if a not in OUT]
    found |= set(c["min_arts"]) - set(keep)
    c["min_arts"] = keep; c["n_min"] = len(keep)
missing = OUT - found
if missing: sys.exit(f"не найдены в min_arts: {sorted(missing)}")
before = len(P["price"])
P["price"] = [p for p in P["price"] if p["art"] != "GGT-12-2"]
assert len(P["price"]) == before - 1
tr = [p for p in P["price"] if p["art"] == "GGT-03-3-3-E-16080"]
assert len(tr) == 1
tr[0]["when"] = "15.10"; tr[0]["when_note"] = "15.10 (Иван 15.10: вместо GGT-12-2; было 22.10)"
P["source"] = P.get("source", "") + " | v2 15.10: -27 артикулов из минимального клика, GGT-12-2 -> TRUBIS 160 с 15.10 (Иван 15.10)"
json.dump(P, open(DST, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("min:", [(c["short"], c["n_min"]) for c in P["cards"]], "| цена:", len(P["price"]), "арт.,", sum(p["when"] == "15.10" for p in P["price"]), "с 15.10")
