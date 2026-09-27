"""Данные для страницы «Детализация»: недельные показатели + смысловая разметка.

Вход:  data/weekly.json, data/chats.json, data/labels.jsonl (если есть), data/comments.json (если есть)
Выход: data/page.json

Репозиторий публичный, поэтому в цитаты не попадают телефоны, почты, имена, отчества и даты с годом.
"""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from build_weekly import week_bounds

ROOT = Path(__file__).parent
DETAIL_WEEKS = 8  # подробный разбор: последние 8 полных недель

# Имена собираем из самих диалогов: менеджер обращается «Ирина, добрый день»
NAME_AT_START_RE = re.compile(r"(?:^|[.!?]\s*|добрый (?:день|вечер)!?\s*)([А-ЯЁ][а-яё]{2,14})\s*,")
PATRONYMIC_RE = re.compile(r"\b[А-ЯЁ][а-яё]+(?:овна|евна|ична|инична|ович|евич|ич)\b")
DATE_YEAR_RE = re.compile(r"\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|\b(19|20)\d{2}\s*(г\.?|года?)?\s*[-–]\s*(19|20)\d{2}")
PHONEISH_RE = re.compile(r"\d[\d\s\-()]{8,}\d")
NOT_NAMES = {"Добрый", "Здравствуйте", "Спасибо", "Стоимость", "Например", "Хорошо", "Размер", "Добрый", "Москва",
             "Домодедово", "Портрет", "Стекло", "Доброе", "Подскажите", "Уважаемый", "Уважаемая", "Если"}


def collect_names():
    names = Counter()
    for f in sorted((ROOT / "data/transcripts").glob("*.jsonl")):
        for line in f.open():
            for m in NAME_AT_START_RE.finditer(json.loads(line)["text"]):
                names[m.group(1)] += 1
    # Слово, которое в переписке часто пишут со строчной, не имя («нет», «думаю», «день»)
    low = Counter()
    for f in sorted((ROOT / "data/transcripts").glob("*.jsonl")):
        for line in f.open():
            low.update(re.findall(r"\b[а-яё]{3,15}\b", json.loads(line)["text"]))
    keep_anyway = {"Вера", "Надежда", "Любовь"}
    return {n for n in names if n not in NOT_NAMES and (low[n.lower()] < 3 or n in keep_anyway)}


NAMES = set()


def anon(t):
    if not t:
        return t
    t = PHONEISH_RE.sub("[телефон]", t)
    t = PATRONYMIC_RE.sub("[отчество]", t)
    t = re.sub(r"\b(" + "|".join(sorted(NAMES, key=len, reverse=True)) + r")\b", "[имя]", t) if NAMES else t
    return DATE_YEAR_RE.sub("[дата]", t)


def sensitive(t):
    return bool(t and re.search(r"позывн|погиб|умер|скончал", t, re.I))


def main():
    global NAMES
    NAMES = collect_names()
    weekly = json.loads((ROOT / "data/weekly.json").read_text())
    chats = json.loads((ROOT / "data/chats.json").read_text())
    labels = {}
    lp = ROOT / "data/labels.jsonl"
    if lp.exists():
        for line in lp.open():
            if line.strip():
                x = json.loads(line)
                labels[x["id"]] = x
    comments = {}
    cp = ROOT / "data/comments.json"
    if cp.exists():
        comments = json.loads(cp.read_text())

    out = {"generated": weekly["generated"], "cabs": {}, "labels_n": len(labels)}
    for code, acc in weekly["accounts"].items():
        weeks = acc["weeks"]
        full = [w for w in weeks if not w["partial"]]
        detail = [w["week"] for w in full[-DETAIL_WEEKS:]]
        series = []
        for w in weeks:
            mon, sun = week_bounds(w["week"])
            row = {k: v for k, v in w.items() if k not in ("from_", "to")}
            row.update(date=str(sun), from_=mon.strftime("%d.%m"), to=sun.strftime("%d.%m"))
            n = w["inbound"] or 0
            row["no_dozhim_pct"] = round(100 * w["no_dozhim"] / n, 1) if n else None
            row["hanging_pct"] = round(100 * w["left_hanging"] / n, 1) if n else None
            row = {k: (round(v, 1) if isinstance(v, float) else v) for k, v in row.items()}
            series.append(row)

        # Разметка по неделям
        agg = defaultdict(lambda: defaultdict(Counter))
        quotes = defaultdict(list)  # тип -> [{week, id, text, ...}]
        modules = []
        examples = defaultdict(list)  # косяк -> [{week,id,summary}]
        for r in chats[code]:
            wk = r["week"]
            lab = labels.get(r["id"])
            summ = anon(lab.get("summary")) if lab else None
            for flag in ("left_hanging", "no_dozhim_after_price", "no_dozhim", "contact_waiting", "missed_no_reaction"):
                if r.get(flag) and r["origin"] == "inbound":
                    examples[flag].append({"w": wk, "id": r["id"], "s": summ})
            if r["origin"] == "inbound" and r.get("price_asked") and not r.get("price_named") and not r.get("moved_offline"):
                examples["price_not_named"].append({"w": wk, "id": r["id"], "s": summ})
            if not lab:
                continue
            a = agg[wk]
            a["segment"][lab.get("segment") or "unclear"] += 1
            if lab.get("segment") == "b2b":
                a["b2b_type"][lab.get("b2b_type") or "другое"] += 1
            a["category"][lab.get("category") or "none"] += 1
            for q in lab.get("questions") or []:
                a["questions"][q] += 1
            for o in lab.get("objections") or []:
                a["objections"][o] += 1
            a["price_reaction"][lab.get("price_reaction") or "not_applicable"] += 1
            a["stage"][str(lab.get("stage", 0))] += 1
            if lab.get("lost_reason"):
                a["lost_reason"][lab["lost_reason"]] += 1
            for i in lab.get("mgr_issues") or []:
                a["mgr_issues"][i] += 1
            a["cat_stage"][f"{lab.get('category')}|{lab.get('stage', 0)}"] += 1
            a["seg_stage"][f"{lab.get('segment')}|{lab.get('stage', 0)}"] += 1
            oq, pq = lab.get("objection_quote"), lab.get("price_quote")
            if oq and not sensitive(oq):
                quotes["objection"].append({"w": wk, "id": r["id"], "t": anon(oq)[:220],
                                            "o": (lab.get("objections") or ["other"])[0], "st": lab.get("stage", 0)})
            if pq and not sensitive(pq):
                quotes["price"].append({"w": wk, "id": r["id"], "t": anon(pq)[:220],
                                        "r": lab.get("price_reaction"), "st": lab.get("stage", 0)})
            for m in lab.get("success_modules") or []:
                if not m.get("manager") or sensitive(m.get("manager")) or sensitive(m.get("client_next")):
                    continue
                modules.append({"w": wk, "id": r["id"], "cat": lab.get("category"), "seg": lab.get("segment"),
                                "m": anon(m["manager"])[:320], "r": anon(m.get("client_next") or "")[:160],
                                "st": m.get("stage_after")})
        out["cabs"][code] = {
            "avito_name": acc["avito_name"],
            "exported": acc["exported"],
            "detail_weeks": detail,
            "series": series,
            "labels": {wk: {k: dict(v) for k, v in d.items()} for wk, d in agg.items()},
            "quotes": quotes,
            "modules": modules,
            "examples": examples,
            "comments": comments.get(code, {}),
        }
    (ROOT / "data/page.json").write_text(json.dumps(out, ensure_ascii=False))
    print("page.json", round((ROOT / "data/page.json").stat().st_size / 1024), "KB, labels", len(labels))


if __name__ == "__main__":
    main()
