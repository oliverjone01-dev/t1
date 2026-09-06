#!/usr/bin/env python3
"""Пересобирает src/content/*.json из выгрузки исследования в data/source.

Запуск:  python3 scripts/build_content.py
Источник: data/source/{sieve.json, knowhow.json, audit.json, cards/*.json}

Модель «маржа сегодня» (rentToday) считается здесь и только здесь, по тем же
допущениям, что и сито. Формула опубликована на странице /method.
"""
import json, glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "source")
OUT = os.path.join(ROOT, "src", "content")

# ── допущения модели (совпадают с ситом) ────────────────────────────────
ADS = 0.08        # реклама, доля предельной цены [ГИПОТЕЗА]
RETURNS = 0.02    # резерв на возвраты и брак [ГИПОТЕЗА]
ACQ = 0.01        # эквайринг [ДАННЫЕ]
LAST_MILE = 25    # ₽ [ДАННЫЕ]
KGT_FEE = 280     # ₽ [ДАННЫЕ]
COMM_FACT = 0.46  # подтверждённая комиссия по текущему ассортименту [ДАННЫЕ]
NET_FLOOR = 0.05  # если чистая выручка ниже 5% цены, процент не считаем: он теряет смысл

PHOTOS = {
 "N005":"photo-1593850577500-e09291dee089","N010":"photo-1470549584009-d347338fc0ff",
 "N011":"photo-1598833775803-99eea89ad6a1","N014":"photo-1586058584825-c1e87ed735b4",
 "N016":"photo-1571040195944-85a412548a43","N020":"photo-1587717415723-8c89fe42c76c",
 "N025":"photo-1560185128-e173042f79dd","N029":"photo-1558769132-cb1aea458c5e",
 "N035":"photo-1601027864736-b6121f34797e","N043":"photo-1611284446314-60a58ac0deb9",
 "N054":"photo-1705747075445-9b93f4d0984f","N066":"photo-1669725341213-7379ff6c90d5",
 "N067":"photo-1635604866833-70844856de75","N077":"photo-1607883567304-8ac65a46c331",
 "N089":"photo-1629893250923-eff7863b6e7d","N090":"photo-1717497043540-d45bf85e5d38",
 "N109":"photo-1706823871410-ed8b01faef7e","N139":"photo-1688650963441-a4ce8fa08d50",
 "N144":"photo-1513519245088-0e12902e5a38","N146":"photo-1556037843-347ddff9f4b0",
 "N147":"photo-1685389213849-088712cbd3fe","N148":"photo-1531403009284-440f080d1e12",
 "M174":"photo-1513716875652-59c99449ee70","M190":"photo-1773314963888-6ecec50555a6",
}
HERO = {"workshop":"photo-1608126841548-dfad1d420a0f",
        "logistics":"photo-1587293852726-70cdb56c2866",
        "steel":"photo-1501166222995-ff31c7e93cef"}

SHOPS = ("metal", "combo", "glass", "print", "mdf", "led")

def norm_shop(value):
    """Приводит свободный текст цеха к коду. Возвращает (код, исходная строка)."""
    raw = (value or "").strip()
    low = raw.lower()
    if low in SHOPS:
        return low, None
    for code, words in (
        ("print", ("керамопеч", "печат")),
        ("glass", ("стекл", "зеркал", "пескостру", "закал")),
        ("mdf", ("мдф", "лдсп", "шпон")),
        ("led", ("led", "подсветк", "светодиод")),
        ("metal", ("металл", "лазер", "труб", "лист", "сварк", "порош", "гибк")),
    ):
        if any(w in low for w in words):
            # если в строке несколько материалов, это комбинированное изделие
            hits = sum(1 for c, ws in (
                ("print", ("керамопеч", "печат")), ("glass", ("стекл", "зеркал")),
                ("mdf", ("мдф", "лдсп", "шпон")), ("metal", ("металл", "лазер", "труб", "лист"))
            ) if any(w in low for w in ws))
            return ("combo" if hits > 1 else code), (raw if raw.lower() != code else None)
    return "", (raw or None)

def ops_line(ops, shop_raw):
    """Операции изделия: список из выгрузки, иначе уточнение цеха из свободного текста."""
    if isinstance(ops, list) and ops:
        return ", ".join(str(o).strip() for o in ops if str(o).strip())
    return ops or shop_raw

def net_revenue(price, ss_total, commission, logistics, kgt):
    """Чистая выручка продавца с одной продажи по цене price."""
    share = 1 - commission - ACQ - ADS - RETURNS
    fixed = (logistics or 800) + LAST_MILE + (KGT_FEE if kgt else 0)
    return price * share - fixed

def margin(price, ss_total, commission, logistics, kgt):
    """Рентабельность к чистой выручке. None, если выручка практически нулевая."""
    if not price or not ss_total:
        return None
    net = net_revenue(price, ss_total, commission, logistics, kgt)
    if net <= price * NET_FLOOR:
        return None          # убыток съедает всю выручку, процент не информативен
    return round((net - ss_total) / net, 4)

def build():
    sieve = json.load(open(f"{SRC}/sieve.json", encoding="utf-8"))
    rows, assumptions = sieve["rows"], sieve["assumptions"]
    audit = json.load(open(f"{SRC}/audit.json", encoding="utf-8"))["audit"]
    audit_by = {a["id"]: a for a in audit["items"]}
    kh = json.load(open(f"{SRC}/knowhow.json", encoding="utf-8"))["all"]
    cards = {}
    for f in glob.glob(f"{SRC}/cards/*.json"):
        c = json.load(open(f, encoding="utf-8"))
        cards[c.get("id") or os.path.basename(f)[:-5]] = c

    niches = []
    for r in rows:
        shop, shop_raw = norm_shop(r.get("workshop"))
        n = {
            "id": r["id"], "name": r.get("name"), "query": r.get("query"),
            "workshop": shop, "workshopRaw": shop_raw, "verdict": r.get("verdict"),
            "verdictNote": r.get("verdict_note"),
            "demand": r.get("demand_rub_28d") or 0, "units": r.get("demand_units_28d") or 0,
            "pop": r.get("c_pop"), "dyn": r.get("c_dyn28"), "competitors": r.get("c_competitors"),
            "avgPrice": r.get("c_avg_price"), "q1": r.get("w_price_q1"), "med": r.get("w_price_med"),
            "q3": r.get("w_price_q3"), "ssLow": r.get("ss_proizv_low"), "ssBase": r.get("ss_proizv_base"),
            "ssHigh": r.get("ss_proizv_high"), "ssTotal": r.get("ss_total_base"),
            "market": r.get("S_market"), "commission": r.get("commission"),
            "p10": r.get("P_r10_base"), "p15": r.get("P_r15_base"),
            "ssMax55": r.get("ss_max15_k055"), "ssMax45": r.get("ss_max15_k045"),
            "gapBase": r.get("gap15_base_k055"), "gapLow": r.get("gap15_low_k055"),
            "rent45": r.get("rent_x4.5"), "laserH": r.get("laser_hours_month"),
            "weldH": r.get("weld_hours_month"), "kgt": r.get("kgt"), "flags": r.get("flags") or "",
            "score": r.get("score"), "spec": r.get("product_spec"), "confidence": r.get("confidence"),
            "risks": r.get("risks"), "bottleneck": r.get("bottleneck"),
            "certification": r.get("certification"), "purchased": r.get("purchased_parts"),
            "anchor": r.get("anchor_used"), "position": r.get("market_position"),
            "logistics": r.get("logistics_fbs"), "logisticsReal": r.get("logistics_realfbs"),
            "netMonth": r.get("net_month_rub_at15"), "targetUnits": r.get("target_units_month"),
            "noCabinetData": r.get("c_pop") is None,
            "belowDemandFloor": bool(r.get("c_pop") is not None
                                     and (r.get("demand_rub_28d") or 0) < assumptions["DEMAND_MIN"]),
        }
        comm = r.get("commission") or assumptions["COMM_DEFAULT"]
        n["rentToday"] = margin(r.get("S_market"), r.get("ss_total_base"), comm,
                                r.get("logistics_fbs"), r.get("kgt"))
        n["rent46"] = margin(r.get("S_market"), r.get("ss_total_base"), COMM_FACT,
                             r.get("logistics_fbs"), r.get("kgt"))
        niches.append(n)

    by_id = {n["id"]: n for n in niches}
    cases = []
    for cid, c in cards.items():
        n = by_id.get(cid)
        if not n:
            continue
        a = audit_by.get(cid)
        cases.append({**n, "photo": PHOTOS.get(cid), "competitors": c.get("competitors") or [],
            "seasonality": c.get("seasonality"), "gaps": c.get("gaps"), "angle": c.get("our_angle"),
            "cardNotes": c.get("notes"),
            "audit": {"verdict": a.get("verdict"), "audience": a.get("q1_audience"),
                      "assumptions": a.get("q2_assumptions"), "gaps": a.get("q3_data_gaps"),
                      "downside": a.get("q4_downside"), "checkpoint": a.get("q5_checkpoint"),
                      "bogdan": a.get("bogdan_reaction"), "redLines": a.get("red_lines")} if a else None})
    cases.sort(key=lambda x: -(x.get("score") or 0))

    ideas = []
    for k in kh:
        shop, shop_raw = norm_shop(k.get("workshop"))
        ideas.append({"name": k.get("name"), "what": k.get("what"), "evidence": k.get("evidence"),
            "whyNobody": k.get("why_nobody"), "whyUs": k.get("why_us"), "workshop": shop,
            "ops": ops_line(k.get("ops"), shop_raw), "ss": k.get("ss_guess"), "price": k.get("price_guess"),
            "logistics": k.get("logistics"), "season": k.get("season"), "ttm": k.get("ttm_weeks"),
            "risk": k.get("risk"), "refuted": bool(k.get("refuted")),
            "reason": k.get("refute_reason"), "fix": k.get("fix")})

    PASS = ("PASS", "PASS_CERT", "PASS_PREMIUM", "PASS_SERIAL_ONLY", "PASS_SERIAL_ONLY_CERT",
            "BORDER", "BORDER_SERIAL")
    priced = [n for n in niches if n["rentToday"] is not None]
    from collections import Counter
    passing = [n for n in niches if n["verdict"] in PASS]
    def median(values):
        v = sorted(values)
        if not v:
            return None
        mid = len(v) // 2
        return v[mid] if len(v) % 2 else (v[mid - 1] + v[mid]) / 2

    valid = [n for n in niches if n["rentToday"] is not None and n["rent46"] is not None]
    med_delta = median([n["rent46"] - n["rentToday"] for n in valid])
    # по нишам, реально прошедшим сито: там выручка не околонулевая и дельта не разлетается
    passing_valid = [n for n in valid if n["verdict"] in PASS]
    med_delta_passing = median([n["rent46"] - n["rentToday"] for n in passing_valid])
    # то же в деньгах: убыток на изделие при 52% и при 46%
    def loss(n, comm):
        net = net_revenue(n["market"], n["ssTotal"], comm, n["logistics"], n["kgt"])
        return net - n["ssTotal"]
    med_loss_52 = median([loss(n, n["commission"] or assumptions["COMM_DEFAULT"]) for n in valid])
    med_loss_46 = median([loss(n, COMM_FACT) for n in valid])
    profitable46 = sum(1 for n in valid if n["rent46"] >= 0.10)

    meta = {
        "date": "2026-09-04",
        "counts": {
            "niches": len(niches), "withEcon": sum(1 for n in niches if n["verdict"] != "NO_ECON"),
            "noEcon": sum(1 for n in niches if n["verdict"] == "NO_ECON"),
            "withCabinet": sum(1 for n in niches if n.get("pop") is not None),
            "cases": len(cases), "knowhow": len(ideas),
            "knowhowKept": sum(1 for i in ideas if not i["refuted"]),
            "knowhowWithFix": sum(1 for i in ideas if i.get("fix") and len(i["fix"]) > 40),
            "priced": len(priced), "profitableToday": sum(1 for n in priced if n["rentToday"] >= 0.10),
            "passing": len(passing),
            "passingBelowFloor": sum(1 for n in passing if n["belowDemandFloor"]),
            "marginal": sum(1 for n in niches if n["verdict"] == "PASS_ONLY_MARGINAL"),
            "fails": sum(1 for n in niches if n["verdict"] == "FAIL"),
            "lossExceedsRevenue": sum(1 for n in niches
                                      if n["rentToday"] is None and n.get("market") and n.get("ssTotal")),
        },
        "verdicts": dict(Counter(n["verdict"] for n in niches)),
        "assumptions": assumptions,
        "model": {"ads": ADS, "returns": RETURNS, "acq": ACQ, "lastMile": LAST_MILE,
                  "kgtFee": KGT_FEE, "commFact": COMM_FACT, "netFloor": NET_FLOOR},
        "medianDelta46": round(med_delta, 4) if med_delta is not None else None,
        "medianDelta46Passing": round(med_delta_passing, 4) if med_delta_passing is not None else None,
        "medianLoss52": round(med_loss_52) if med_loss_52 is not None else None,
        "medianLoss46": round(med_loss_46) if med_loss_46 is not None else None,
        "profitableAt46": profitable46,
        "commissionRange": sorted({round(n["commission"], 2) for n in niches if n.get("commission")}),
        "hero": HERO,
        "audit": {"overall": audit["overall"],
                  "noGo": sum(1 for a in audit["items"] if a["verdict"] == "NO_GO"),
                  "needData": sum(1 for a in audit["items"] if a["verdict"] == "NEED_DATA"),
                  "goWithFixes": sum(1 for a in audit["items"] if a["verdict"] == "GO_WITH_FIXES"),
                  "go": sum(1 for a in audit["items"] if a["verdict"] == "GO"),
                  "total": len(audit["items"])},
        "bestToday": max(priced, key=lambda n: n["rentToday"]) if priced else None,
    }

    os.makedirs(OUT, exist_ok=True)
    # длинное тире в русском тексте не используется, невидимые переносы вычищаются
    def clean(obj):
        if isinstance(obj, str):
            return (obj.replace(" — ", " - ").replace("—", "-").replace(" – ", " - ").replace("–", "-")
                       .replace("−", "-").replace("\u00ad", "").replace("\u200b", ""))
        if isinstance(obj, list):
            return [clean(x) for x in obj]
        if isinstance(obj, dict):
            return {k: clean(v) for k, v in obj.items()}
        return obj

    for name, data in (("niches.json", niches), ("cases.json", cases),
                       ("knowhow.json", ideas), ("meta.json", meta)):
        json.dump(clean(data), open(f"{OUT}/{name}", "w", encoding="utf-8"),
                  ensure_ascii=False, separators=(",", ":"))
    print(f"ниш {len(niches)}, кейсов {len(cases)}, идей {len(ideas)}")
    print(f"проходят {meta['counts']['passing']} (из них ниже порога спроса "
          f"{meta['counts']['passingBelowFloor']}), прибыльных сегодня "
          f"{meta['counts']['profitableToday']} из {meta['counts']['priced']}")
    print(f"медианная дельта при 46%: всё {meta['medianDelta46']}, по проходным {meta['medianDelta46Passing']}")
    print(f"убыток на изделие: {meta['medianLoss52']} -> {meta['medianLoss46']} ₽, прибыльных при 46%: {profitable46}")
    print(f"комиссии в данных: {meta['commissionRange']}")
    print(f"без метрик кабинета: {sum(1 for n in niches if n['noCabinetData'])}")
    print(f"убыток превышает выручку у {meta['counts']['lossExceedsRevenue']} ниш")
    shops = Counter(n["workshop"] for n in ideas)
    print("цеха идей:", dict(shops))

if __name__ == "__main__":
    build()
