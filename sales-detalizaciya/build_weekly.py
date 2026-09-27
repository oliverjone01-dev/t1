"""Сборка недельных показателей ОП по кабинетам Авито из сырых выгрузок мессенджера.

Вход:  data/raw/*.json (getChats v5 + history v2, время в 1e-7 с от эпохи)
Выход: data/weekly.json (показатели кабинет x неделя) и data/chats.json (разметка каждого чата)

Все правила разметки собраны вверху файла, чтобы их можно было поправить в одном месте.
"""
import json
import re
import statistics
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).parent
MSK = timezone(timedelta(hours=3))

ACCOUNTS = [
    # файл, код кабинета в отчёте, название в Авито
    ("data/raw/avito-glassmemory-raw-apr-sep.json", "OLD-B", "Glass Memory"),
    ("data/raw/avito-glassmemory2-raw-apr-sep.json", "OLD-G", "GLASS MEMORY"),
]

PERIOD_FROM = datetime(2026, 4, 1, tzinfo=MSK)

# Рабочее время по автоответу кабинета: пн-пт 9-18, обед 13-14
WORK_SLOTS = [(9, 13), (14, 18)]

# Автоответы: приходят за секунды после сообщения клиента, живым ответом не считаются
AUTO_RE = re.compile(
    r"Добро пожаловать в компанию|Вам ответит первый освободившийся|Спасибо за обращение"
    r"|Мы работаем с понедельника по пятницу",
    re.I,
)
AUTO_MAX_DELAY_S = 20

# Рассылки: пишем первыми тем, кто смотрел объявление, или всей базе
MAILING_RE = re.compile(
    r"^Добрый день! Вы просматривали наше объявление|Спешим сообщить, что с \d+ по \d+ \w+ действует акция"
    r"|Выбор памятника - важное и непростое решение",
    re.I,
)

PRICE_ASK_RE = re.compile(r"сколько|цен[аыуеой]|стоимост|стоит|почём|почем|прайс|бюджет", re.I)
PRICE_NAMED_RE = re.compile(
    r"\d[\d\s]*\s?(тыс|т\.\s?р|руб|р\.|₽|р\b)|\b\d{1,3}\s?000\b", re.I
)
SIZE_ASK_RE = re.compile(r"размер|толщин|какой.*нужен|пришлите фото|фотографи", re.I)
CONTACT_ASK_RE = re.compile(r"номер|телефон|почт|whats|ватсап|вотсап|вацап|позвон|перезвон", re.I)
PHONE_RE = re.compile(r"(?:\+7|8|7)[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}")
EMAIL_RE = re.compile(r"[\w.\-]+@[\w\-]+\.[a-z]{2,}", re.I)
VISIT_RE = re.compile(
    r"приед|приезж|подъед|ждем вас|ждём вас|посмотреть образц|в офис|на производств", re.I
)
DEAL_RE = re.compile(r"оплат|предоплат|договор|реквизит|счёт на|счет на|выставить сч|макет", re.I)
THANKS_ONLY_RE = re.compile(
    r"^\W*(спасибо|благодарю|ок|окей|хорошо|понятно|ясно|поняла?|договорились|до свидания|всего доброго)[\W\s]*$",
    re.I,
)
# Клиент закрыл разговор сам: благодарит или берёт паузу подумать
CLOSING_RE = re.compile(
    r"спасибо|благодар|подума|будем думать|посовету|не решил|пока не|позже|напишу|свяжусь|позвоню|наберу|обсуд", re.I
)
# Перевели разговор из Авито в телефон или мессенджер
OFFPLATFORM_RE = re.compile(r"\bmax\b|макс[е]?\b|телеграм|whats|ватсап|вотсап|перезвон|позвон|на почту|отправил[аи]? информац", re.I)
DELETED_TEXT = "Сообщение удалено"

FOLLOWUP_GAP_H = 20  # сами вернулись к молчащему клиенту через 20+ часов
FAST_ANSWER_MIN = 15  # норматив первого ответа в рабочих минутах (черновой, уточняется)


def ts(x):
    return datetime.fromtimestamp(x / 1e7, tz=MSK)


def week_key(dt):
    y, w, _ = dt.isocalendar()
    return f"{y}-W{w:02d}"


def week_bounds(key):
    y, w = key.split("-W")
    mon = datetime.fromisocalendar(int(y), int(w), 1)
    return mon.date(), (mon + timedelta(days=6)).date()


def business_minutes(a, b):
    """Рабочие минуты между a и b (пн-пт 9-13, 14-18 МСК)."""
    if b <= a:
        return 0.0
    total = 0.0
    day = a.date()
    while day <= b.date():
        if day.weekday() < 5:
            for h1, h2 in WORK_SLOTS:
                s = datetime(day.year, day.month, day.day, h1, tzinfo=MSK)
                e = datetime(day.year, day.month, day.day, h2, tzinfo=MSK)
                lo, hi = max(a, s), min(b, e)
                if hi > lo:
                    total += (hi - lo).total_seconds() / 60
        day += timedelta(days=1)
    return total


def in_work_time(dt):
    return dt.weekday() < 5 and any(h1 <= dt.hour < h2 for h1, h2 in WORK_SLOTS)


def text_of(m):
    b = m["body"]
    return b.get("text") or ""


def classify_chat(chat, items, own, export_dt):
    msgs = sorted(
        [m for m in items if m["type"] != "system"],
        key=lambda m: m["created"],
    )
    # звонки идут отдельным потоком, в переписку не входят
    calls = [m for m in msgs if m["type"] == "appCall"]
    msgs = [m for m in msgs if m["type"] != "appCall" and text_of(m) != DELETED_TEXT]
    bot = [m for m in items if m["type"] == "system"]

    tagged = []  # (dt, who, kind, msg) who: C клиент, O мы; kind: live|auto|mailing
    prev_client_dt = None
    for m in msgs:
        dt = ts(m["created"])
        if m["fromUid"] == own:
            t = text_of(m)
            if MAILING_RE.search(t) and prev_client_dt is None:
                kind = "mailing"  # тот же шаблон в ответ на сообщение клиента считаем живым ответом
            elif AUTO_RE.search(t) or (
                prev_client_dt and (dt - prev_client_dt).total_seconds() < AUTO_MAX_DELAY_S
                and m["type"] == "text"
            ):
                kind = "auto"
            else:
                kind = "live"
            tagged.append((dt, "O", kind, m))
        else:
            tagged.append((dt, "C", "client", m))
            prev_client_dt = dt

    client = [t for t in tagged if t[1] == "C"]
    live = [t for t in tagged if t[1] == "O" and t[2] == "live"]
    mailing = [t for t in tagged if t[1] == "O" and t[2] == "mailing"]
    first_any = tagged[0] if tagged else None

    r = {
        "id": chat["channelId"],
        "item": (chat.get("context", {}).get("value") or {}).get("title"),
        "calls_in_ok": sum(1 for c in calls if c["body"].get("status") == "success"),
        "calls_missed": sum(1 for c in calls if c["body"].get("status") == "missed"),
        "call_dts": [ts(c["created"]).isoformat() for c in calls],
        "phone_viewed": any(
            "посмотрел номер" in " ".join(
                (ch.get("value") or {}).get("text", "") for ch in b["body"].get("chunks", [])
            )
            for b in bot
        ),
        "avito_reminders": sum(1 for b in bot if b["body"].get("flow") == "flower_460478"),
    }

    if first_any and first_any[2] == "mailing":
        r["origin"] = "mailing"
        r["start"] = first_any[0]
        r["client_replied"] = bool(client)
    elif client:
        r["origin"] = "inbound"
        r["start"] = client[0][0]
    elif calls:
        r["origin"] = "call_only"
        r["start"] = ts(calls[0]["created"])
    else:
        r["origin"] = "no_dialog"
        r["start"] = ts(chat["created"])
        return r

    r["client_msgs"] = len(client)
    r["live_msgs"] = len(live)

    # Первый живой ответ на первое обращение клиента.
    # Обращение: сообщение, звонок или просьба перезвонить через Авито.
    # Ответ: наше живое сообщение или состоявшийся звонок.
    callback_req = [
        ts(b["created"]) for b in bot
        if "попросил вас позвонить" in " ".join(
            (ch.get("value") or {}).get("text", "") for ch in b["body"].get("chunks", []))
    ]
    events = sorted(
        [t[0] for t in client] + [ts(c["created"]) for c in calls] + callback_req
    )
    ok_calls = [ts(c["created"]) for c in calls if c["body"].get("status") == "success"]
    if events:
        c0 = events[0]
        resp = sorted([t[0] for t in live if t[0] >= c0] + [x for x in ok_calls if x >= c0])
        if resp:
            r["first_resp_bmin"] = round(business_minutes(c0, resp[0]), 1)
            r["first_resp_min"] = round((resp[0] - c0).total_seconds() / 60, 1)
            r["first_in_work"] = in_work_time(c0)
        r["answered"] = bool(resp)
        r["auto_only"] = not resp and any(t[2] == "auto" for t in tagged if t[1] == "O")

    # Цена
    price_ask = next((t for t in client if PRICE_ASK_RE.search(text_of(t[3]))), None)
    r["price_asked"] = bool(price_ask) and business_minutes(price_ask[0], export_dt) >= 8 * 60
    if r["price_asked"]:
        later = [t for t in live if t[0] >= price_ask[0]]
        r["price_named"] = any(PRICE_NAMED_RE.search(text_of(t[3])) for t in later)
        r["size_asked"] = any(SIZE_ASK_RE.search(text_of(t[3])) for t in later)
    # Прайс могли назвать и без вопроса
    r["price_any"] = any(PRICE_NAMED_RE.search(text_of(t[3])) for t in live)

    r["photos_sent"] = sum(1 for t in live if t[3]["type"] in ("image", "video", "file"))
    r["contact_asked"] = any(CONTACT_ASK_RE.search(text_of(t[3])) for t in live)
    r["contact_got"] = any(
        PHONE_RE.search(text_of(t[3])) or EMAIL_RE.search(text_of(t[3])) for t in client
    )
    r["moved_offline"] = r["contact_got"] or any(OFFPLATFORM_RE.search(text_of(t[3])) for t in live)
    alltext = " ".join(text_of(t[3]) for t in tagged if t[2] in ("live", "client"))
    r["visit_talk"] = bool(VISIT_RE.search(alltext))
    r["deal_talk"] = bool(DEAL_RE.search(alltext))

    # Сами вернулись к молчащему клиенту
    fu = 0
    conv = [t for t in tagged if t[2] in ("live", "client")]
    for a, b in zip(conv, conv[1:]):
        if a[1] == "O" and b[1] == "O" and (b[0] - a[0]) >= timedelta(hours=FOLLOWUP_GAP_H):
            fu += 1
    r["followups"] = fu

    # Клиент написал последним и ждёт ответа (не «спасибо»), прошло больше рабочего дня
    if conv and conv[-1][1] == "C":
        last = conv[-1]
        txt = text_of(last[3]).strip()
        waiting_bmin = business_minutes(last[0], export_dt)
        is_closing = bool(THANKS_ONLY_RE.match(txt)) or (len(txt) < 80 and CLOSING_RE.search(txt)) \
            or (last[3]["type"] == "text" and len(txt) <= 2)
        gave_contact = bool(PHONE_RE.search(txt) or EMAIL_RE.search(txt))
        r["contact_waiting"] = gave_contact and waiting_bmin >= 8 * 60
        r["left_hanging"] = (not is_closing) and (not gave_contact) and waiting_bmin >= 8 * 60
        r["hang_since"] = last[0].isoformat()
    else:
        r["left_hanging"] = False

    # Клиент замолчал после нашего ответа, а мы больше не написали (напоминание бота Авито не в счёт)
    if conv and conv[-1][1] == "O" and client:
        last_c = client[-1][0]
        ours_after = [t for t in conv if t[1] == "O" and t[0] > last_c]
        r["no_dozhim"] = (export_dt - conv[-1][0]) >= timedelta(days=2) and not any(
            (t[0] - ours_after[0][0]) >= timedelta(hours=FOLLOWUP_GAP_H) for t in ours_after
        )
        r["no_dozhim_after_price"] = r["no_dozhim"] and any(
            PRICE_NAMED_RE.search(text_of(t[3])) for t in ours_after
        )
    else:
        r["no_dozhim"] = r["no_dozhim_after_price"] = False

    # Пропущенный звонок без реакции: после него ни звонка, ни нашего сообщения в течение 4 рабочих часов
    miss_no_react = 0
    for c in calls:
        if c["body"].get("status") != "missed":
            continue
        cdt = ts(c["created"])
        reacted = any(
            t[0] > cdt and business_minutes(cdt, t[0]) <= 240 for t in live
        ) or any(
            ts(o["created"]) > cdt and o["body"].get("status") == "success" for o in calls
        )
        miss_no_react += 0 if reacted else 1
    r["missed_no_reaction"] = miss_no_react
    return r


def pct(a, b):
    return round(100 * a / b, 1) if b else None


def median(xs):
    return round(statistics.median(xs), 1) if xs else None


def aggregate(rows):
    inbound = [r for r in rows if r["origin"] == "inbound"]
    mail = [r for r in rows if r["origin"] == "mailing"]
    answered = [r for r in inbound if r.get("answered")]
    work = [r for r in answered if r.get("first_in_work")]
    offh = [r for r in answered if r.get("first_in_work") is False]
    price_ask = [r for r in inbound if r.get("price_asked")]
    calls_ok = sum(r["calls_in_ok"] for r in rows)
    calls_miss = sum(r["calls_missed"] for r in rows)
    return {
        "inbound": len(inbound),
        "mailing_sent": len(mail),
        "mailing_replied": sum(1 for r in mail if r.get("client_replied")),
        "call_only": sum(1 for r in rows if r["origin"] == "call_only"),
        "answered_pct": pct(len(answered), len(inbound)),
        "unanswered": len(inbound) - len(answered),
        "auto_only": sum(1 for r in inbound if r.get("auto_only")),
        "first_resp_work_bmin_med": median([r["first_resp_bmin"] for r in work]),
        "first_resp_offh_min_med": median([r["first_resp_min"] for r in offh]),
        "fast_pct": pct(
            sum(1 for r in answered if r["first_resp_bmin"] <= FAST_ANSWER_MIN), len(answered)
        ),
        "price_asked": len(price_ask),
        "price_named_pct": pct(sum(1 for r in price_ask if r.get("price_named")), len(price_ask)),
        "price_not_named": sum(1 for r in price_ask if not r.get("price_named") and not r.get("moved_offline")),
        "moved_offline_pct": pct(sum(1 for r in inbound if r.get("moved_offline")), len(inbound)),
        "contact_waiting": sum(1 for r in inbound if r.get("contact_waiting")),
        "photos_pct": pct(sum(1 for r in inbound if r.get("photos_sent")), len(inbound)),
        "contact_asked_pct": pct(sum(1 for r in inbound if r.get("contact_asked")), len(inbound)),
        "contact_got_pct": pct(sum(1 for r in inbound if r.get("contact_got")), len(inbound)),
        "visit_talk_pct": pct(sum(1 for r in inbound if r.get("visit_talk")), len(inbound)),
        "deal_talk_pct": pct(sum(1 for r in inbound if r.get("deal_talk")), len(inbound)),
        "followup_pct": pct(sum(1 for r in inbound if r.get("followups")), len(inbound)),
        "left_hanging": sum(1 for r in inbound if r.get("left_hanging")),
        "no_dozhim": sum(1 for r in inbound if r.get("no_dozhim")),
        "no_dozhim_after_price": sum(1 for r in inbound if r.get("no_dozhim_after_price")),
        "calls_ok": calls_ok,
        "calls_missed": calls_miss,
        "missed_no_reaction": sum(r.get("missed_no_reaction", 0) for r in rows),
        "phone_viewed": sum(1 for r in rows if r["phone_viewed"]),
    }


def main():
    out = {"generated": datetime.now(MSK).isoformat(timespec="minutes"), "accounts": {}}
    chats_out = {}
    for path, code, avito_name in ACCOUNTS:
        d = json.loads((ROOT / path).read_text())
        own = d["ownerId"]
        export_dt = datetime.fromisoformat(d["exported"].replace("Z", "+00:00")).astimezone(MSK)
        rows = []
        for chat in d["chats"]:
            if chat.get("context", {}).get("type") == "system":
                continue  # чаты от самого Авито
            items = d["history"].get(chat["channelId"], {}).get("result", {}).get("items", [])
            r = classify_chat(chat, items, own, export_dt)
            if r["start"] < PERIOD_FROM:
                continue
            r["week"] = week_key(r["start"])
            rows.append(r)
        by_week = defaultdict(list)
        for r in rows:
            by_week[r["week"]].append(r)
        weeks = []
        for wk in sorted(by_week):
            mon, sun = week_bounds(wk)
            a = aggregate(by_week[wk])
            a.update(week=wk, from_=str(mon), to=str(sun),
                     partial=(export_dt.date() < sun) or (mon < PERIOD_FROM.date()))
            weeks.append(a)
        out["accounts"][code] = {
            "avito_name": avito_name,
            "exported": export_dt.isoformat(timespec="minutes"),
            "total": aggregate(rows),
            "weeks": weeks,
        }
        for r in rows:
            r["start"] = r["start"].isoformat()
        chats_out[code] = rows
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data/weekly.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    (ROOT / "data/chats.json").write_text(json.dumps(chats_out, ensure_ascii=False))
    return out


if __name__ == "__main__":
    o = main()
    for code, acc in o["accounts"].items():
        print(code, json.dumps(acc["total"], ensure_ascii=False))
