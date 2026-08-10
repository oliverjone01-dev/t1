#!/usr/bin/env python3
"""msgs.jsonl -> cases.json: показательные кейсы переговоров по каждому менеджеру.

Зачем отдельно от dialogs-analyze.py: тот считает доли и медианы, а человеку в
кабинете нужны не доли, а его собственные реплики. Один кейс это пара «что сказал
клиент, что ответил менеджер» плюс готовая замена из фразебука.

Отбор: 8-15 кейсов на менеджера, из них обязательно 2-3 сильных. Сильные не
украшение: разбор из одних косяков перестают читать за неделю, это прямое
требование методики Кости (каждый его документ открывался сильными сторонами).

Диверсификация обязательна. Без неё список превращается в двенадцать одинаковых
«обещание без даты»: у этого дефекта сотни срабатываний, он вытеснит всё
остальное. Поэтому отбор идёт раундами: в первом раунде берётся по одному кейсу
каждого типа, дефицит добивается вторым раундом.

Запуск:
  python3 dialogs-cases.py msgs.jsonl cases.json [--min-out 25]
"""
import json, re, sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta

WORK_START, WORK_END = 9, 19   # рабочее окно МСК, [ГИПОТЕЗА - калибровка]
QUOTE = 200                    # предел цитаты, знаков
TARGET_TOTAL = 15              # верхняя граница кейсов на человека
TARGET_DEFECTS = 12
MAX_STRONG = 3
MIN_OUT = 25                   # тот же порог, что в build-pages.py: ниже выборка не разбор

# --- Вычистка персональных данных из цитат -----------------------------------
# Цитаты уезжают в файл, который читает человек и который лежит вне CRM. Телефон
# и почта клиента там не нужны ни для одного вывода, а утекают навсегда.
# До двух разделителей между цифрами: «+7 (925) ...» содержит пробел и скобку
# подряд, и с одним необязательным разделителем такой номер проходил в цитату.
PHONE = re.compile(r"(?:\+?\d[\s()-]{0,2}){9,14}\d")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
URL = re.compile(r"https?://\S+")
# Эмодзи приехали из выгрузки байтовыми кодами вида :f09f998c:. Убирать их надо
# до измерения длины: «Очень ждем» с двумя смайлами иначе проходит как
# содержательная реплика клиента на 30 знаков и тянет за собой ложный флаг.
EMOJI = re.compile(r":[0-9a-f]{6,}:")
ATTACH_PREFIX = re.compile(r"^(Отправлено|Принято)\s+(Изображение|Файл|Видео|Аудиосообщение)\s*", re.I)
# Фамилию режем, имя оставляем: «Ирина Кузнецова» -> «Ирина». Пара срабатывает
# только когда второе слово имеет фамильное окончание, иначе под нож попадали бы
# «Компания Гласс» и «Добрый День».
SURNAME = re.compile(
    r"\b([А-ЯЁ][а-яё]{2,})\s+([А-ЯЁ][а-яё]+(?:ов|ова|ев|ева|ёв|ёва|ин|ина|ын|ына|"
    r"ский|ская|цкий|цкая|енко|ук|юк|ян|их|ых|ко)\b)")
# Обратный порядок «Фамилия Имя [Отчество]»: клиенты представляются и так
# («Друсинова Дарья Федоровна»). Остаётся имя, отчество уходит вместе с фамилией.
SURNAME_FIRST = re.compile(
    r"\b([А-ЯЁ][а-яё]+(?:ов|ова|ев|ева|ёв|ёва|ин|ина|ын|ына|"
    r"ский|ская|цкий|цкая|енко|ук|юк|ян|их|ых))\s+([А-ЯЁ][а-яё]{2,})"
    r"(\s+[А-ЯЁ][а-яё]+(?:вич|вна|чна))?\b")
# Адреса: улица с домом и любая единица точнее дома (квартира, корпус, этаж,
# апартаменты). Город не режется: точной привязки он не даёт, а контекст
# «доставка в Казань» из цитаты пропадать не должен.
ADDR_STREET = re.compile(
    r"\b(?:ул|улица|просп\w*|пр-?т|пр|пер|переулок|шоссе|наб\w*|бульвар|б-р|проезд)"
    r"\.?\s+[А-ЯЁа-яё0-9][а-яё0-9-]*(?:\s+[а-яё0-9-]+)?\s*,?\s*(?:д\.?\s*)?\d*\S*", re.I)
ADDR_UNIT = re.compile(
    r"\b(?:кв|квартира|корп|корпус|стр|строение|под[ъь]езд|апартаменты|офис|дом|д)"
    r"\.?\s*№?\s*\d+\w*|\b\d+\s*(?:этаж|под[ъь]езд)\b|\bэтаж\s*№?\s*\d+\w*", re.I)
ADDR_COLLAPSE = re.compile(r"\[адрес\](?:[\s,.;/-]*\[адрес\])+")

# Фамилии собственного ростера вычищаются отдельно и жёстче: общая эвристика
# ловит только порядок «Имя Фамилия», а менеджеры в переписке представляются
# и наоборот («руководитель - Лысенко Ольга»). Ростер известен из выгрузки,
# поэтому режем по стему с хвостом склонения. Изоляция кабинетов держится на
# том, что чужая фамилия не выживает в цитате ни в какой форме.
ROSTER_RE = None

def set_roster(names):
    """names: полные имена менеджеров из выгрузки, формат «Фамилия Имя»."""
    global ROSTER_RE
    stems = set()
    for n in names:
        tok = re.split(r"\s+", (n or "").strip())[0]
        if len(tok) < 4:
            continue
        stems.add(re.escape(tok[:-1] if tok.endswith(("а", "я")) else tok))
    ROSTER_RE = re.compile(r"\b(?:" + "|".join(sorted(stems)) + r")[а-яё]{0,3}\b") if stems else None

# --- Детекторы --------------------------------------------------------------
GREET = re.compile(r"(добр\w+\s+(?:день|утро|вечер)|здравствуйте|приветству)", re.I)
# Обращение по имени в начале реплики. Это не приветствие, но клиент видит, что
# пишут ему, а не рассылкой, поэтому под T02 такое сообщение не подводится.
NAME_ADDRESS = re.compile(r"^\W{0,3}[А-ЯЁ][а-яё]{2,}\s*[,!]")
PROMISE = re.compile(
    r"\b(отправлю|пришлю|вернусь|уточню|перезвоню|позвоню|подготовлю|посчитаю|сообщу|напишу"
    r"|отвечу|скину|направлю|предоставлю|согласую|проверю|запрошу|сделаю|передам|выставлю"
    r"|будет\s+готов\w*|сможем\s+отгрузить|отгрузим|привезём|привезем)\b", re.I)
# Два уровня конкретики срока. HARD_DATE - жёсткая дата или время: по ней
# засчитывается похвала STRONG_СРОК («обещание с конкретной датой» обязано
# содержать дату, иначе заголовок врёт). SOFT_HINT - голые «сегодня/завтра»:
# этого достаточно, чтобы НЕ обвинять в «обещании без даты» («завтра отправлю»
# проверяемо; расширение сняло 93 из 675 срабатываний, замер 10.08.2026), но
# мало, чтобы хвалить за конкретную дату.
HARD_DATE = re.compile(
    r"(\bдо\s+\d{1,2}[:.]\d{2}|\bк\s+\d{1,2}[:.]\d{2}|\b\d{1,2}[:.]\d{2}\b"
    r"|\b\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\w*"
    r"|\b\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\b|завтра\s+до|сегодня\s+до"
    r"|\b(?:понедельник|вторник|сред[ыуа]|четверг|пятниц[ыуа])\w*)", re.I)
SOFT_HINT = re.compile(r"\b(?:сегодня|завтра|послезавтра)\b|до\s+конца\s+(?:дня|недели)", re.I)
class _Concrete:
    """Объединение HARD_DATE и SOFT_HINT под старым интерфейсом .search()."""
    @staticmethod
    def search(t):
        return HARD_DATE.search(t) or SOFT_HINT.search(t)
CONCRETE = _Concrete()
VAGUE = re.compile(
    r"(в\s+ближайш|в\s+скором\s+времени|постара\w+|как\s+только\s+(?:смогу|получ|будет)"
    r"|чуть\s+позже|на\s?сколько\s+это\s+возможно|как\s+будет\s+готов|думаю[, ]+(?:после|что успе)"
    r"|надеюсь\s+(?:успе|завтра)|попозже|в\s+течени[еи]\s+дня)", re.I)
SLANG = re.compile(r"(закрут\w*ся|забыл\w*ся|замотал\w*ся|запар\w+|проворонил|проспал)", re.I)
DEFENSE = re.compile(r"(вы\s+не\s+указал|вы\s+же\s+сами|я\s+вам\s+говорил\w*|это\s+не\s+наша\s+вина)", re.I)
STAMP = re.compile(
    r"(длительное\s+ожидание|судьб\w+\s+рассмотрен|в\s+рамках\s+данного\s+вопроса"
    r"|осуществл\w+\s+отправк|имеет\s+место\s+быть)", re.I)
PRICE_OBJ = re.compile(r"(дорог\w+|дороже|дешевл\w+|не проход\w+ по цен|высок\w+ цен|бюджет не)", re.I)
LEGAL = re.compile(
    r"(претензи\w+|юрист|пеня|пени\b|расторг\w+|досудеб\w+|жалоб\w+|верните деньги"
    r"|сколько можно|это безобрази|номер директор|тел\w*\s+руководител)", re.I)
ALTERNATIVE = re.compile(
    r"(вариант|пересчит\w+|альтернатив\w+|друг\w+ стекл|друг\w+ профил|рассрочк\w+"
    r"|график платеж|частями|можем уступ|подберём|подберем|предлож\w+ реш|удешев\w+)", re.I)
APOLOGY = re.compile(r"(извин\w+|прошу прощени|сожале\w+|мне очень жаль|моя ошибка|наша ошибка)", re.I)
QUALIFY = re.compile(
    r"(какой бюджет|на какую сумму|в какой бюджет|ориентир по бюджет|рассматриваете сумм"
    r"|когда планируете|к какому сроку|когда нужн\w+ готов|сроки реализац"
    r"|кто принимает решени|с кем согласов|кто утвержда)", re.I)
SHIFT = re.compile(r"(сдвиг\w+|перенос\w*|задерж\w+|не успева\w+|позже срока|новая дата|сместил\w*)", re.I)
CLOSING = re.compile(
    r"(оплата получена|оплату получил\w*|запускаем\s+\w*\s*производств|спасибо за доверие"
    r"|заказ готов|отгрузили|передали в доставку)", re.I)
CLOSED_STAGE = re.compile(r"сделка\s+(успешна|провалена)", re.I)
TRIVIAL = re.compile(
    r"^(спасибо|поняла|понял|хорошо|ок|окей|да|нет|принято|ясно|благодарю|отлично|супер"
    r"|договорились|до свидания|всего доброго)[\s.,!)]*$", re.I)
CAPITULATE = re.compile(
    r"^\W*(спасибо|благодар\w+|поняла|понял|принято|хорошо|ясно|жаль|очень жаль)", re.I)

# code -> (заголовок, готовая реплика «как надо было», вес отбора)
# Реплики взяты из references/phrasebook.md. Своих не сочинять: разделы фразебука
# указаны в комментариях, чтобы правка шла в одном месте.
DEFECTS = {
    "ESC_БЕЗ_ИЗВИНЕНИЯ": ("Претензия, а извинения нет", 100,          # фразебук 4 и 16
        "Мне очень жаль, что так вышло, приношу извинения. Разбираюсь с производством "
        "и сегодня до 17:00 вернусь к вам с новой датой и с тем, что мы делаем за свой счёт."),
    "PRICE_КАПИТУЛЯЦИЯ": ("Капитуляция на «дорого»", 95,              # фразебук 6
        "Спасибо, что сказали прямо. Уточню: дорого в целом или конкретная позиция выбивается? "
        "Назовите рабочую цифру, скажу честно, попадаем или нет. Если не попадаем целиком, "
        "пересоберу комплектацию или разобью оплату на два платежа."),
    "IGNOR_ВОПРОСА": ("Вопрос клиента остался без ответа", 90,        # фразебук 2
        "Вижу ваш вопрос. Уточняю у производства и отвечаю сегодня до 17:00. "
        "Если ответа к этому времени не будет, всё равно напишу и назову новый срок."),
    "SLOW_ОТВЕТ": ("Ответ на живой вопрос дольше рабочего дня", 85,   # фразебук 3
        "Прошу прощения, ответ задержался по моей вине. Расчёт у технолога, "
        "пришлю завтра до 12:00."),
    "T06_ЗАЩИТА": ("Защита вместо извинения", 80,                     # фразебук 4
        "Мне очень жаль, что результат вас расстроил. Приношу извинения. "
        "Переделаем за наш счёт, готовность 3 апреля, проконтролирую лично."),
    "T04_ЖАРГОН": ("Жаргон вместо извинения", 75,                     # фразебук 3
        "Приношу извинения, ответ задержался по моей вине. Сегодня до 17:00 пришлю расчёт."),
    "T03_ОБЕЩАНИЕ_БЕЗ_СРОКА": ("Обещание без даты", 70,               # фразебук 1
        "Расчёт готовлю, отправлю завтра до 12:00. Если что-то сдвинется, "
        "напишу раньше срока, а не после."),
    "T01_ПУСТОЕ_ВЛОЖЕНИЕ": ("Файл без сопроводительного текста", 65,  # фразебук 8
        "Добрый день, [Имя]! Направляю договор и ссылку на оплату по вашему заказу. "
        "Прошу подтвердить получение."),
    "T05_БЕЗ_КОНТЕКСТА": ("Касание после паузы без контекста", 60,    # фразебук 5
        "[Имя], это [ваше имя], компания GENGLASS. Мы обсуждали перегородку и договаривались "
        "о замере 17 февраля. Подскажите, как обстоят дела с решением?"),
    "T03_РАЗМЫТЫЙ_СРОК": ("Размытый срок вместо даты", 55,            # фразебук 1
        "По срокам конкретно: чертежи у вас в четверг до конца дня, "
        "спецификация в пятницу утром."),
    "T09_ШТАМП": ("Штамп не к месту", 50,                             # фразебук 12
        "Удалось ли ознакомиться с предложением? Если удобнее голосом, "
        "наберу вас сегодня после 15:00."),
    "T02_БЕЗ_ПРИВЕТСТВИЯ": ("Первое сообщение дня без приветствия", 45,  # фразебук 8
        "Добрый день, [Имя]! Возвращаюсь по вашему заказу."),
}

# В текстах STRONG цифр нет сознательно: числа на страницу подаются только из
# счётчиков реестра, второй источник той же цифры в хардкоде разъезжается с
# первым при каждом пересчёте (вердикт ФЕНИКСА 10.08.2026).
STRONG = {
    "STRONG_АЛЬТЕРНАТИВА": ("На «дорого» ответили вариантом, а не скидкой", 100,
        "Так и держать: клиент назвал цену проблемой, вы дали ход, а не согласие. "
        "По отделу такой ответ - редкость."),
    "STRONG_ИЗВИНЕНИЕ": ("Извинение и конкретное действие", 95,
        "Так и держать: сначала извинение, потом пояснение, потом действие с датой. "
        "Именно этот порядок снимает требование «дайте телефон директора»."),
    "STRONG_ПРОАКТИВ": ("О сдвиге срока клиент узнал от вас", 90,
        "Так и держать: о сдвиге клиент узнал от вас, а не наоборот. "
        "Эскалации начинаются ровно с обратного порядка."),
    "STRONG_КВАЛИФИКАЦИЯ": ("Квалифицирующий вопрос задан", 85,
        "Так и держать: вопрос про бюджет в отделе почти не звучит, это провал "
        "команды, и вы из него выбиваетесь."),
    "STRONG_СРОК": ("Обещание с конкретной датой", 80,
        "Так и держать: обещание с датой можно проверить, и именно таких "
        "обещаний отделу не хватает."),
    "STRONG_БЫСТРО": ("Ответ на вопрос клиента за минуты", 75,
        "Так и держать: содержательный ответ внутри десяти рабочих минут, "
        "а не отписка «принято»."),
    "STRONG_ЗАКРЫТИЕ": ("Чистое завершение цикла", 70,
        "Так и держать: после оплаты и отгрузки отдел обычно молчит, "
        "и клиент остаётся один на один с ожиданием."),
}


def bmin(a, b):
    """Рабочие минуты между a и b (пн-пт, WORK_START..WORK_END)."""
    if b <= a:
        return 0
    total, cur = 0, a
    while cur < b:
        d0 = cur.replace(hour=WORK_START, minute=0, second=0, microsecond=0)
        d1 = cur.replace(hour=WORK_END, minute=0, second=0, microsecond=0)
        if cur.weekday() < 5:
            s, e = max(cur, d0), min(b, d1)
            if e > s:
                total += int((e - s).total_seconds() // 60)
        cur = (cur + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return total


def norm(text):
    """Текст без эмодзи-кодов и лишних пробелов. Применяется до всех измерений."""
    return re.sub(r"\s+", " ", EMOJI.sub(" ", text or "")).strip()


def clean(text, limit=QUOTE):
    """Цитата, пригодная для показа человеку: без контактов, без фамилий, без хвоста."""
    t = ATTACH_PREFIX.sub("", (text or "").strip())
    t = URL.sub("[ссылка]", t)
    t = EMAIL.sub("[почта]", t)
    t = PHONE.sub("[телефон]", t)
    t = SURNAME_FIRST.sub(r"\2", t)
    t = SURNAME.sub(r"\1", t)
    if ROSTER_RE is not None:
        t = ROSTER_RE.sub("", t)
    t = ADDR_STREET.sub("[адрес]", t)
    t = ADDR_UNIT.sub("[адрес]", t)
    t = ADDR_COLLAPSE.sub("[адрес]", t)
    # Длинное тире меняется на дефис даже внутри цитаты: правило типографики
    # действует на всю страницу, а смысл реплики от знака не меняется. Цитата и
    # так нормализована, она обрезана и очищена от контактов.
    t = t.replace("—", "-").replace("–", "-")
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) > limit:
        cut = t[:limit].rstrip()
        sp = cut.rfind(" ")
        if sp > limit * 0.6:
            cut = cut[:sp]
        t = cut + "..."
    return t


def body_len(m):
    """Длина текста без служебной шапки вложения. «Отправлено Файл» это не текст."""
    return len(ATTACH_PREFIX.sub("", (m["text"] or "").strip()).strip())


def scan_deal(seq, add):
    """Один диалог. add(code, verdict, msg, client_msg) копит кейсы."""
    prev_in = None          # реплика клиента, на которую ещё не ответили
    seen_days = set()
    last_dt = None
    out_text_dts = [m["dt"] for m in seq if m["direction"] == "out" and body_len(m) >= 10]

    for m in seq:
        d = m["direction"]
        txt = (m["text"] or "").strip()
        if d == "in":
            if prev_in is None:
                prev_in = m
            last_dt = m["dt"]
            continue
        if d != "out":
            continue

        strong_code = defect_code = None
        cl = prev_in
        answered = bmin(cl["dt"], m["dt"]) if cl else None
        blen = body_len(m)

        ctext = (cl["text"] or "") if cl else ""
        # --- сильное ---------------------------------------------------------
        if cl and PRICE_OBJ.search(ctext) and (ALTERNATIVE.search(txt) or QUALIFY.search(txt)):
            strong_code = "STRONG_АЛЬТЕРНАТИВА"
        elif cl and LEGAL.search(ctext) and APOLOGY.search(txt) and CONCRETE.search(txt):
            strong_code = "STRONG_ИЗВИНЕНИЕ"
        elif cl is None and SHIFT.search(txt) and CONCRETE.search(txt) and blen >= 60:
            strong_code = "STRONG_ПРОАКТИВ"
        elif QUALIFY.search(txt) and "?" in txt:
            strong_code = "STRONG_КВАЛИФИКАЦИЯ"
        elif PROMISE.search(txt) and HARD_DATE.search(txt) and blen >= 40:
            strong_code = "STRONG_СРОК"
        elif (cl is not None and answered is not None and answered <= 10 and blen >= 80
              and "?" in ctext and len(ctext) >= 40):
            strong_code = "STRONG_БЫСТРО"
        elif CLOSING.search(txt) and blen >= 40:
            strong_code = "STRONG_ЗАКРЫТИЕ"

        # --- дефект ----------------------------------------------------------
        if cl and len(ctext) >= 20 and LEGAL.search(ctext) and not APOLOGY.search(txt):
            defect_code = "ESC_БЕЗ_ИЗВИНЕНИЯ"
        elif (cl and PRICE_OBJ.search(ctext) and CAPITULATE.match(txt)
              and "?" not in txt and not ALTERNATIVE.search(txt) and blen < 220):
            defect_code = "PRICE_КАПИТУЛЯЦИЯ"
        elif (cl is not None and answered is not None and answered > 480
              and (len(ctext) >= 40 or "?" in ctext) and not TRIVIAL.match(ctext[:40])
              and not CLOSED_STAGE.search(cl["stage"] or "")):
            defect_code = "SLOW_ОТВЕТ"
        elif DEFENSE.search(txt) and len(ctext) >= 25:
            # Защита засчитывается только в ответ на содержательную реплику клиента:
            # «я вам говорила» после «супер» это не отбивание претензии.
            defect_code = "T06_ЗАЩИТА"
        elif SLANG.search(txt):
            defect_code = "T04_ЖАРГОН"
        elif m["attach"] == "sent" and blen < 5 and not any(
                abs((x - m["dt"]).total_seconds()) <= 180 for x in out_text_dts):
            defect_code = "T01_ПУСТОЕ_ВЛОЖЕНИЕ"
        elif PROMISE.search(txt) and not CONCRETE.search(txt) and blen >= 20:
            defect_code = "T03_ОБЕЩАНИЕ_БЕЗ_СРОКА"
        elif (last_dt is not None and (m["dt"] - last_dt).days >= 10
              and not GREET.search(txt[:80]) and blen >= 15):
            defect_code = "T05_БЕЗ_КОНТЕКСТА"
        elif VAGUE.search(txt) and blen >= 20:
            defect_code = "T03_РАЗМЫТЫЙ_СРОК"
        elif STAMP.search(txt):
            defect_code = "T09_ШТАМП"
        elif (blen >= 20 and m["dt"].date() not in seen_days
              and not GREET.search(txt[:80]) and not NAME_ADDRESS.match(txt)):
            defect_code = "T02_БЕЗ_ПРИВЕТСТВИЯ"

        if blen >= 10:
            seen_days.add(m["dt"].date())
        if strong_code:
            add(strong_code, "strong", m, cl)
        if defect_code:
            add(defect_code, "defect", m, cl)
        prev_in, last_dt = None, m["dt"]

    # Диалог, оборванный на вопросе клиента. Закрытая сделка и вежливое «спасибо»
    # не считаются: обвинить менеджера в молчании после «Хорошо» по выигранной
    # сделке значит получить справедливое возражение и потерять весь инструмент.
    if prev_in is not None and prev_in is seq[-1]:
        t = (prev_in["text"] or "").strip()
        if ("?" in t and len(t) >= 25 and not TRIVIAL.match(t[:40])
                and prev_in["attach"] != "received"
                and not CLOSED_STAGE.search(prev_in["stage"] or "")):
            add("IGNOR_ВОПРОСА", "defect", None, prev_in)


def pick(pool, want, meta):
    """Раундовый отбор: сначала по одному кейсу каждого типа, потом добор.

    Без раундов список забивает один самый частый дефект, и человек видит
    двенадцать копий одной претензии вместо карты своих проблем.
    """
    codes = sorted(pool, key=lambda c: -meta[c][1])
    # Кейс без реплики клиента читается наполовину: видно, что менеджер написал,
    # и не видно, на что. Поэтому сначала пары, и только потом одиночные реплики.
    for c in codes:
        pool[c].sort(key=lambda x: (0 if x["client"] else 1, -(x["_amount"] or 0), x["when"]))
    out, r = [], 0
    while len(out) < want and any(len(pool[c]) > r for c in codes):
        for c in codes:
            if len(out) >= want:
                break
            if len(pool[c]) > r:
                out.append(pool[c][r])
        r += 1
    return out


def main(src, dst, min_out=MIN_OUT):
    M = []
    for line in open(src, encoding="utf-8"):
        o = json.loads(line)
        if o["kind"] != "msg" or o["sysmsg"] or not o["ts"]:
            continue
        if o["direction"] not in ("in", "out"):
            continue
        o["dt"] = datetime.fromisoformat(o["ts"])
        o["text"] = norm(o["text"])
        M.append(o)
    set_roster({o["mgr"] for o in M})

    by_deal = defaultdict(list)
    for m in M:
        by_deal[m["dealId"]].append(m)

    pools = defaultdict(lambda: defaultdict(list))   # mgr -> code -> кейсы
    counts = defaultdict(Counter)                    # mgr -> code -> уникальных срабатываний
    out_n = Counter()
    # Одна и та же переписка попадает в две сделки: клиент ведёт один диалог, а в
    # CRM у него два номера (13.4% строк выгрузки - такие дубли, замер ФЕНИКСА
    # 10.08.2026). Дедупликация стоит ДО счётчика: иначе счётчик завышен на
    # 9-27% по кодам, а по пустым вложениям в разы. Ключ - время сообщения плюс
    # головы цитат; для пустого вложения текстов нет, хватает времени.
    seen_msgs = defaultdict(set)
    # Вторая, более грубая дедупликация только для карточек: одинаковая пара
    # цитат в разные дни это одна и та же претензия, две карточки не нужны.
    seen_pairs = defaultdict(set)

    for deal, seq in by_deal.items():
        seq.sort(key=lambda x: x["dt"])
        owner = seq[0]["mgr"]
        out_n[owner] += sum(1 for m in seq if m["direction"] == "out")

        def add(code, verdict, mmsg, cmsg, _owner=owner, _deal=deal, _seq=seq):
            title, _w, should = (STRONG if verdict == "strong" else DEFECTS)[code]
            ref = mmsg or cmsg
            cli = clean(cmsg["text"]) if cmsg is not None else ""
            man = clean(mmsg["text"]) if mmsg is not None else ""
            tkey = ((code, ref["ts"]) if code == "T01_ПУСТОЕ_ВЛОЖЕНИЕ"
                    else (code, ref["ts"], cli[:60].lower(), man[:60].lower()))
            if tkey in seen_msgs[_owner]:
                return
            seen_msgs[_owner].add(tkey)
            counts[_owner][code] += 1
            key = (code, cli[:60].lower(), man[:60].lower())
            if key in seen_pairs[_owner]:
                return
            seen_pairs[_owner].add(key)
            if not man:
                man = ("[файл ушёл без единой строки текста]" if code == "T01_ПУСТОЕ_ВЛОЖЕНИЕ"
                       else "[ответа не последовало, диалог оборвался здесь]")
            pools[_owner][code].append({
                "deal": _deal,
                "when": ref["dt"].strftime("%d.%m.%Y"),
                "stage": ref["stage"],
                "client": cli,
                "manager": man,
                "verdict": verdict,
                "code": code,
                "title": title,
                "should": should,
                "_amount": ref.get("amount") or 0,
            })

        scan_deal(seq, add)

    res = {}
    for mgr, pool in pools.items():
        if out_n[mgr] < min_out:
            continue
        d_pool = {c: v for c, v in pool.items() if c in DEFECTS}
        s_pool = {c: v for c, v in pool.items() if c in STRONG}
        strong = pick(dict(s_pool), MAX_STRONG, STRONG) if s_pool else []
        room = min(TARGET_DEFECTS, TARGET_TOTAL - len(strong))
        defects = pick(dict(d_pool), room, DEFECTS) if d_pool else []
        cases = defects + strong
        for c in cases:
            c.pop("_amount", None)
        if not cases:
            continue

        top = [{"code": c, "title": DEFECTS[c][0], "n": counts[mgr][c]}
               for c, _ in counts[mgr].most_common() if c in DEFECTS][:3]
        strengths = [{"code": c, "title": STRONG[c][0], "n": counts[mgr][c]}
                     for c, _ in counts[mgr].most_common() if c in STRONG][:2]
        res[mgr] = {"cases": cases,
                    "summary": {"top_defects": top, "strengths": strengths,
                                "defectCases": len(defects), "strongCases": len(strong)}}

    payload = {"meta": {"source": src, "generated_at": datetime.now().isoformat(),
                        "quoteLimit": QUOTE, "minOut": min_out,
                        "note": "Цитаты обрезаны, телефоны и почта вычищены, фамилии сокращены до имени."},
               "managers": res}
    json.dump(payload, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    for mgr in sorted(res, key=lambda x: -len(res[x]["cases"])):
        s = res[mgr]["summary"]
        print(f"  {mgr:22} кейсов {len(res[mgr]['cases']):2}  "
              f"(дефектов {s['defectCases']}, сильных {s['strongCases']})")
    print(f"менеджеров: {len(res)}, файл: {dst}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    mo = MIN_OUT
    for a in sys.argv[1:]:
        if a.startswith("--min-out"):
            mo = int(a.split("=", 1)[1]) if "=" in a else MIN_OUT
    main(args[0], args[1], mo)
