#!/usr/bin/env python3
"""Собирает демо-страницу для дирекции: один HTML-файл со встроенными данными.

Запуск:  python3 scripts/build_demo.py
Источник: src/content/*.json (их сначала пересобирает build_content.py)
Результат: demo/ozon-research.html - самодостаточный файл, работает без сервера.

Фотографий в демо нет намеренно: снимки Unsplash грузятся с внешнего хоста,
в изолированной среде показа они не откроются, а пустые рамки в презентации хуже,
чем их отсутствие.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "content")
OUT = os.path.join(ROOT, "demo")

NICHE_FIELDS = (
    "id name query workshop verdict verdictNote demand units pop dyn competitors avgPrice "
    "q1 med q3 ssLow ssBase ssTotal market commission p10 p15 ssMax55 gapBase gapLow "
    "laserH weldH kgt flags score spec confidence risks bottleneck certification purchased "
    "anchor position logistics logisticsReal rentToday rent46 belowDemandFloor noCabinetData"
).split()
CASE_EXTRA = "competitors seasonality gaps angle audit ssHigh".split()
IDEA_FIELDS = "name what evidence whyNobody whyUs workshop ops ss price season ttm reason fix".split()


def pick(obj, fields):
    return {k: obj.get(k) for k in fields}


def buckets(niches):
    """Распределение маржи по целевой цене. Границы кратны 100%, чтобы читались вслух."""
    edges = [(-1.0, "от -50% до -100%"), (-2.0, "от -100% до -200%"), (-4.0, "от -200% до -400%"),
             (-10.0, "от -400% до -1000%"), (None, "хуже -1000%")]
    out = [{"label": lbl, "count": 0, "ids": []} for _, lbl in edges]
    for n in niches:
        r = n["rentToday"]
        if r is None:
            continue
        for i, (edge, _) in enumerate(edges):
            if edge is None or r >= edge:
                out[i]["count"] += 1
                if len(out[i]["ids"]) < 3:
                    out[i]["ids"].append(n["name"])
                break
    return out


def build():
    niches = json.load(open(f"{SRC}/niches.json", encoding="utf-8"))
    cases = json.load(open(f"{SRC}/cases.json", encoding="utf-8"))
    ideas = json.load(open(f"{SRC}/knowhow.json", encoding="utf-8"))
    meta = json.load(open(f"{SRC}/meta.json", encoding="utf-8"))

    case_ids = {c["id"] for c in cases}
    data = {
        "meta": meta,
        "niches": [dict(pick(n, NICHE_FIELDS), hasCase=n["id"] in case_ids) for n in niches],
        "cases": [pick(c, NICHE_FIELDS + CASE_EXTRA) for c in cases],
        "ideas": [pick(i, IDEA_FIELDS) for i in ideas],
        "buckets": buckets(niches),
        "audited": [
            {"id": c["id"], "name": c["name"], "rentToday": c["rentToday"], "rent46": c["rent46"],
             "verdict": c["audit"]["verdict"]}
            for c in cases if c.get("audit")
        ],
    }

    tpl = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_template.html"), encoding="utf-8").read()
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = tpl.replace("/*__DATA__*/null", payload)

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "ozon-research.html")
    open(path, "w", encoding="utf-8").write(html)
    kb = os.path.getsize(path) / 1024
    print(f"{path}: {kb:.0f} КБ, ниш {len(data['niches'])}, кейсов {len(data['cases'])}, идей {len(data['ideas'])}")


if __name__ == "__main__":
    build()
