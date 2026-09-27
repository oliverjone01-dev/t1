"""Таблица показателей для согласования смыслов (шаг 1). Читает data/weekly.json, пишет METRICS.md."""
import json
from pathlib import Path

ROOT = Path(__file__).parent
FIRST_WEEK = "2026-W31"


def f(v, suffix=""):
    if v is None:
        return "нет"
    if isinstance(v, float):
        v = round(v) if abs(v) >= 10 else round(v, 1)
    return f"{v}{suffix}"


def wlabel(w):
    d1 = w["from_"][8:10] + "." + w["from_"][5:7]
    d2 = w["to"][8:10] + "." + w["to"][5:7]
    return f"{w['week'][5:]} {d1}-{d2}" + (" (неполная)" if w["partial"] else "")


FLOW = [
    ("Обращений", "inbound", ""),
    ("Написали первыми / ответили", None, ""),
    ("Звонки принято / пропущено", None, ""),
    ("Ответили, %", "answered_pct", "%"),
    ("1-й ответ, медиана, раб. мин", "first_resp_work_bmin_med", ""),
    ("1-й ответ вне графика, медиана, ч", None, ""),
    ("Ответ за 15 раб. мин, %", "fast_pct", "%"),
]
QUALITY = [
    ("Спросили цену", "price_asked", ""),
    ("Назвали цену, %", "price_named_pct", "%"),
    ("Цену не назвали и не перевели в звонок", "price_not_named", ""),
    ("Фото примеров, %", "photos_pct", "%"),
    ("Получили телефон, %", "contact_got_pct", "%"),
    ("Перевели в телефон или MAX, %", "moved_offline_pct", "%"),
    ("Сами вернулись к клиенту, %", "followup_pct", "%"),
]
MISSES = [
    ("Клиент ждёт ответа", "left_hanging", ""),
    ("Оставил телефон, в чате тишина", "contact_waiting", ""),
    ("Замолчал после нашего ответа, не дожали", "no_dozhim", ""),
    ("из них после названной цены", "no_dozhim_after_price", ""),
    ("Без живого ответа вообще", "unanswered", ""),
    ("Пропущенный звонок без реакции", "missed_no_reaction", ""),
]


def cell(w, key, suf, label):
    if key:
        return f(w[key], suf)
    if label.startswith("Написали"):
        return f"{w['mailing_sent']} / {w['mailing_replied']}"
    if label.startswith("Звонки"):
        return f"{w['calls_ok']} / {w['calls_missed']}"
    if label.startswith("1-й ответ вне"):
        v = w["first_resp_offh_min_med"]
        return "нет" if v is None else f"{v / 60:.1f}"
    return ""


def table(weeks, rows):
    head = "| Показатель | " + " | ".join(wlabel(w) for w in weeks) + " |"
    sep = "|---|" + "---:|" * len(weeks)
    body = [
        f"| {label} | " + " | ".join(cell(w, key, suf, label) for w in weeks) + " |"
        for label, key, suf in rows
    ]
    return "\n".join([head, sep, *body])


def main():
    o = json.loads((ROOT / "data/weekly.json").read_text())
    out = []
    for code, acc in o["accounts"].items():
        weeks = [w for w in acc["weeks"] if w["week"] >= FIRST_WEEK]
        out.append(f"## {code} (в Авито «{acc['avito_name']}»), выгрузка {acc['exported'][:16].replace('T', ' ')} МСК\n")
        out.append("**Поток и скорость**\n\n" + table(weeks, FLOW) + "\n")
        out.append("**Что делаем хорошо**\n\n" + table(weeks, QUALITY) + "\n")
        out.append("**Косяки, штук**\n\n" + table(weeks, MISSES) + "\n")
    return "\n".join(out)


if __name__ == "__main__":
    print(main())
