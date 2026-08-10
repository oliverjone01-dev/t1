#!/usr/bin/env python3
"""Kostya-AI: персональные страницы менеджеров. По одному самодостаточному файлу на человека.

Почему N файлов, а не один с роутером: при статике без бэкенда единственный способ
не показать менеджеру данные коллег это физически не положить их в файл. Решение
Совета от 2026-08-07, ТЗ knowledge/episodes/2026-08/tz-kostya-ai-final-assembly-20260807.md,
раздел 3.

Порядок блоков определяет, прочитают страницу или закроют. Сверху идут цифры
самого человека, под ними одна задача на 14 дней, под ней разбор его
переговоров. «Не ваша зона» уехала в конец и свёрнута: она снимает претензию,
но не отвечает на вопрос «что у меня», ради которого кабинет и открывают.

Файлы попадают в .gitignore. Это НЕзашифрованные страницы: цитаты клиентской
переписки лежат в них открытым текстом, а репозиторий публичный. Коммитится и
публикуется только результат build-platform.mjs, где payload уже зашифрован.

Запуск:
  python3 build-pages.py analysis.json per_manager.json out_dir [kostya.json] [cases.json]
                         [--fragment]

cases.json готовит dialogs-cases.py. Без него секция «Разбор переговоров» не
рендерится: цитаты берутся только из выгрузки переписки, из метрик их не собрать.
"""
import json, sys, os, re, html, hashlib, statistics
from collections import Counter
from datetime import datetime, timedelta

PORTAL = "https://glassmemory.bitrix24.ru/crm/deal/details/{}/"

# Единый источник подписанных обещаний и назначенных норм. Дублировать текст в
# генераторе нельзя: раздел помечен черновиком до визы юриста, значит он будет
# меняться, и вторая копия разойдётся молча.
CONTRACT = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                       "..", "shared", "contract.json"), encoding="utf-8"))

# Набор иконок один на всю платформу: библиотека, кабинет и сводка. Второй набор
# читался бы как второй продукт, а человек ходит между ними в один день.
ICONS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                    "..", "shared", "icons.json"), encoding="utf-8"))


def ic(name):
    """Иконка блока. aria-hidden: смысл несёт заголовок рядом, а не картинка."""
    body = ICONS.get(name)
    if not body:
        return ""
    return ('<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" '
            'aria-hidden="true">' + body + '</svg>')

TRANSLIT = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'i',
    'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
    'х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
}

# Реплики «как надо было» переехали в dialogs-cases.py: там они лежат рядом с
# детектором, который их вызывает, и берутся из references/phrasebook.md. Две
# копии одной библиотеки расходятся молча, поэтому вторая здесь не держится.

SYSTEMIC = [
    "Поля «Дата решения клиента» и «Дата следующего контакта» в Bitrix24 не созданы. "
    "Пока их нет, стадия «Принимают решение» не может работать по правилу «нет даты, нет стадии».",
    "Стадии «Счёт отправлен» и «Связаться позже» из ТЗ Кости не созданы. "
    "Отложенные сделки некуда девать, поэтому они копятся на активных стадиях.",
    "Нет сравнительного листа с дешёвым аналогом и карты цены. "
    "На возражение «дорого» отвечать нечем, кроме скидки.",
    "Нет гарантийного регламента. Половина страха клиента при предоплате не закрыта ничем.",
    "Выгрузка диалогов ручная. Разбор приходит с задержкой в недели, а не на следующий день.",
]

TASK_LIB = {
    "reply_tail": ("Ни один клиент не ждёт ответа дольше 4 рабочих часов",
        "Каждый раз, когда входящее пришло, а содержательного ответа сразу нет",
        ["Отправить промежуточный ответ со сроком, не молчать",
         "Поставить дело на срок, который назвал",
         "В названный срок ответить или перенести с новой датой"],
        "Дмитрий, расчёт ещё в работе, технолог обещает к завтрашнему утру. Как получу, сразу отправлю.",
        "p90 времени ответа"),
    "unanswered": ("Последнее сообщение в диалоге всегда моё",
        "Каждый раз, когда клиент написал содержательное сообщение по живой сделке",
        ["Ответить в тот же рабочий день, даже если ответ промежуточный",
         "Если ответа нет по существу, назвать срок, когда будет",
         "Перед уходом домой проверить, нет ли диалогов, оборванных на клиенте"],
        "Елена, вижу ваше сообщение. Уточняю у производства, отвечу завтра до 12:00.",
        "число диалогов, оборванных на сообщении клиента"),
    "promise": ("Каждое моё обещание содержит дату и время",
        "Каждый раз, когда я пишу «отправлю», «уточню», «перезвоню», «сообщу»",
        ["Не отправлять сообщение с обещанием без даты",
         "Дату брать реальную, с запасом, а не удобную",
         "Поставить дело на эту же дату"],
        "Подготовлю расчёт завтра до обеда и вернусь к вам после 14:00.",
        "доля обещаний с конкретным сроком"),
    "price": ("На слово «дорого» отвечаю в тот же день, с цифрой",
        "Каждый раз, когда клиент пишет «дорого», «дороговато», «нашли дешевле» или называет бюджет",
        ["Разделить: дороже ожидания, дороже конкурента или не влезает в смету",
         "Спросить рабочую цифру клиента",
         "В тот же день дать вариант под неё либо честно сказать, что не попадаем"],
        "Спасибо, что сказали прямо. Уточню: дорого в целом или конкретная позиция выбивается? Назовите рабочую цифру, скажу честно, попадаем или нет.",
        "доля возражений «дорого» с ответом в тот же день"),
    "escalation": ("О срыве срока клиент узнаёт от меня, до наступления даты",
        "Каждый раз, когда я понимаю, что названный срок не выдерживается",
        ["Написать клиенту ДО даты, а не после его вопроса",
         "Назвать новую дату и причину одной фразой",
         "Сообщить РОПу в тот же день, до разговора с клиентом"],
        "Ирина, предупреждаю заранее: по вашему заказу сдвигается срок, будет готово 12 сентября вместо 5. Причина в поставке фурнитуры. Держу на контроле лично.",
        "число эскалаций, инициированных клиентом"),
    "tasks": ("В 17:40 ни одного дела с сегодняшним сроком не остаётся открытым",
        "Каждый рабочий день в 17:40",
        ["Открыть список своих дел на сегодня",
         "Каждое закрыть либо перенести с новой датой и новой формулировкой",
         "Ноль дел с сегодняшней датой на конец дня"],
        None,
        "число просроченных дел на конец дня"),
}


def esc(s):
    return html.escape(str(s if s is not None else ""))


def slug(name):
    s = (name or "").lower().replace("ё", "е")
    out = "".join(TRANSLIT.get(c, c if c.isalnum() else "-") for c in s)
    return re.sub(r"-+", "-", out).strip("-")


def page_token(name):
    """Имя файла не называет человека. Содержимое кабинета зашифровано, но адрес
    страницы виден всем: lakomova-tatyana.html сообщает, чей это кабинет, до того
    как кто-либо ввёл пароль, и позволяет перечислить весь отдел подбором адресов.
    Токен устойчив: один и тот же человек всегда получает один и тот же адрес."""
    h = hashlib.sha1(name_key(name).encode("utf-8")).hexdigest()[:10]
    return f"k-{h}"


def name_key(s):
    s = (s or "").lower().replace("ё", "е")
    return " ".join(sorted(p for p in re.split(r"[^а-яa-z-]+", s) if len(p) > 1))


def money(n):
    return f"{int(n or 0):,}".replace(",", " ") + " ₽"


def mins(v):
    if v is None:
        return "нет данных"
    v = int(v)
    if v < 60:
        return f"{v} мин"
    if v < 480:
        return f"{v // 60} ч {v % 60:02d}"
    return f"{v / 480:.1f} раб. дн"


def dept(A):
    """Агрегаты отдела считаются из данных. Раньше они стояли константами в семи
    местах текста, из-за чего кабинет печатал 0.11% вопросов о бюджете, тогда как
    библиотека прямым текстом объявляла эту цифру ошибочной и называла 0.15%."""
    ms = [m for m in A["managers"] if m.get("out", 0) >= 25]
    outText = sum(m.get("outText") or m.get("out") or 0 for m in ms) or 1
    promises = sum(m.get("promises") or 0 for m in ms) or 1
    concrete = sum((m.get("concreteTimeShare") or 0) * (m.get("promises") or 0) for m in ms)
    qb = sum((m.get("outDet") or {}).get("Q_БЮДЖЕТ", 0) for m in ms)
    ql = sum((m.get("outDet") or {}).get("Q_ЛПР", 0) for m in ms)
    return {
        "medianMin": A["totals"].get("replyMedianMin"),
        "p90Min": A["totals"].get("replyP90Min"),
        "unanswered": sum(m.get("unansweredCount") or 0 for m in ms),
        "concreteShare": concrete / promises,
        "qBudgetShare": qb / outText,
        "qLprShare": ql / outText,
        "managers": len(ms),
    }


def band_of(m):
    """Индекс и полоса, видимые самому человеку. Решение Ивана от 08.08.2026,
    вопрос 12: уровень и полоса видны сотруднику и РОПу, на общем экране только
    движение. Формула повторяет commIndex сводки, иначе человек увидит у себя
    одно число, а РОП другое."""
    MIN_DEALS = 10
    r = m.get("reply") or {}
    speed = r.get("within60") or 0
    tail = 1 - (r.get("over240") or 0)
    dialogs = max(1, m.get("dialogs") or 1)
    answered = 1 - min(1, (m.get("unansweredCount") or 0) / dialogs) if m.get("in") else 0
    concrete = m.get("concreteTimeShare") or 0
    qual = min(1, (m.get("qualifyRate") or 0) / 1.0)
    dp = m.get("defectsPer100Out") or {}
    clean = max(0, 1 - (dp.get("T07_ОРФОГРАФИЯ", 0) + dp.get("T01_БЕЗ_ПОЯСНЕНИЯ", 0)
                        + dp.get("T02_БЕЗ_ПРИВЕТСТВИЯ", 0)) / 40)
    v = speed * .25 + tail * .15 + answered * .20 + concrete * .15 + qual * .10 + clean * .15
    idx = round(v * 100) / 10
    if (m.get("deals") or 0) < MIN_DEALS:
        return None, "мало данных"
    return idx, "молодец" if idx >= 7.5 else ("норма" if idx >= 5 else "в разборе")


def reglament_tone(kind, value):
    """Цвет разрешён только по нормам с меткой РЕГЛАМЕНТ. Точечное вето ФЕНИКСА
    от 08.08.2026: пороги стадий и веса индексов помечены гипотезой и будут
    переписаны калибровкой, а красная плитка метки не носит, читатель читает
    красное как факт."""
    n = CONTRACT["reglamentNorms"]
    if value is None:
        return ""
    if kind == "reply" and value > n["replyWorkMinutesMax"]:
        return ' style="color:var(--bad)"'
    if kind == "unanswered" and value > n["unansweredMax"]:
        return ' style="color:var(--bad)"'
    if kind == "reply" and value <= n["replyWorkMinutesMax"]:
        return ' style="color:var(--ok)"'
    if kind == "unanswered" and value == 0:
        return ' style="color:var(--ok)"'
    return ""


def cut(text, limit=230):
    """Резать по границе слова. Обрыв посреди слова читается как баг выгрузки и
    заставляет человека искать в своей фразе дефект, которого в куске нет."""
    # Длинное тире меняется на дефис и в цитате: правило типографики действует на
    # всю страницу, а смысл реплики от знака не зависит.
    t = (text or "").strip().replace("—", "-").replace("–", "-")
    if len(t) <= limit:
        return t
    head = t[:limit]
    sp = head.rfind(" ")
    return (head[:sp] if sp > limit * 0.6 else head).rstrip(" ,.;:") + " …"


def delta(prev, key, now, fmt, lower_better=True):
    """Личная динамика к прошлому разбору. ТЗ раздел 4, блок 6: каждый норматив
    рядом со значением две недели назад. Без истории один разбор читается как
    приговор, с историей как этап."""
    if not prev or now is None:
        return '<div class="d l">первый разбор, сравнить не с чем</div>'
    was = prev.get(key)
    if was is None:
        return '<div class="d l">в прошлом разборе не измерялось</div>'
    if was == now:
        return f'<div class="d l">две недели назад: {esc(fmt(was))}, без изменений</div>'
    better = (now < was) if lower_better else (now > was)
    return (f'<div class="d {"up" if better else "down"}">две недели назад: {esc(fmt(was))}, '
            f'стало {"лучше" if better else "хуже"}</div>')


def dispute_btn(deal_id, what, mgr, built_dt):
    """Возражение подаётся оттуда, где возникает несогласие, а не из футера.
    Кнопка копирует готовый текст со сроком ответа, посчитанным по рабочим дням
    от даты сборки: обещание в контракте измеряется рабочими днями, не календарём."""
    due = workdays_after(built_dt, CONTRACT["dispute"]["slaWorkdays"])
    txt = (f'Возражение по флагу. Сделка {deal_id}. Флаг: {what}. '
           f'Разбор от {built_dt.strftime("%d.%m.%Y")}, {mgr}. '
           f'Ответ ожидается до {due.strftime("%d.%m.%Y")} включительно. Не согласен, потому что: ')
    return (f'<button class="disp" type="button" data-disp="{esc(txt)}" '
            f'title="Скопировать текст возражения">не согласен</button>')


def workdays_after(dt, days):
    """Срок в рабочих днях: обещание «два рабочих дня» нельзя считать календарём."""
    d, left = dt, days
    while left > 0:
        d += timedelta(days=1)
        if d.weekday() < 5:
            left -= 1
    return d


def pick_task(m, kk):
    """Одна задача на 14 дней. Одна, не список: пять требований дают ноль изменений."""
    r = m.get("reply") or {}
    if kk and kk.get("overdueTasks", 0) >= 20:
        return "tasks", kk["overdueTasks"], "просроченных дел"
    if (m.get("escalationCount") or 0) >= 4:
        return "escalation", m["escalationCount"], "эскалаций к руководителю"
    if (m.get("priceObjCount") or 0) >= 20:
        return "price", m["priceObjCount"], "возражений по цене"
    if r.get("p90Min") and r["p90Min"] > 1200:
        return "reply_tail", r["p90Min"], "минут p90 ответа"
    if (m.get("unansweredCount") or 0) >= 5:
        return "unanswered", m["unansweredCount"], "диалогов оборвано на клиенте"
    return "promise", round((m.get("concreteTimeShare") or 0) * 100), "% обещаний со сроком"


def plural(n, one, few, many):
    """Русское склонение числительного. «12 случаев», а не «12 случая»."""
    n = abs(int(n))
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return few
    return many


def case_card(c, mgr, built_dt):
    """Одна карточка переговоров: реплика клиента, ответ менеджера, вердикт, замена.

    Порядок жёсткий: сначала факт (что было сказано), потом оценка. Обратный
    порядок читается как приговор, и человек перестаёт читать на второй карточке.
    """
    bad = c["verdict"] == "defect"
    L = []
    a = L.append
    a(f'<div class="card case {"bad" if bad else "good"}">')
    a(f'<div class="small">Сделка <a href="{PORTAL.format(c["deal"])}" target="_blank">'
      f'{esc(c["deal"])}</a> · {esc(c.get("when") or "")}'
      f'{" · " + esc(c["stage"]) if c.get("stage") else ""} '
      f'<span class="tag {"bad" if bad else "ok"}">{esc(c["title"])}</span>'
      f'{" " + dispute_btn(c["deal"], c["title"], mgr, built_dt) if bad else ""}</div>')
    if c.get("client"):
        a(f'<div class="q"><div class="who">Клиент написал</div>{esc(c["client"])}</div>')
    if c.get("manager"):
        a(f'<div class="q {"was" if bad else "now"}"><div class="who">Вы ответили</div>'
          f'{esc(c["manager"])}</div>')
    if bad:
        a(f'<div class="q now" data-copy><div class="who">Как надо было</div>{esc(c["should"])}</div>')
    else:
        a(f'<div class="small">{esc(c["should"])}</div>')
    a('</div>')
    return "\n".join(L)


def talks_block(cs, mgr, built_dt):
    """Секция «Разбор переговоров»: сводка уровнем выше, под ней кейсы.

    Сводка стоит первой сознательно. Пятнадцать карточек подряд человек читает
    как поток претензий и не собирает из них картину, а число случаев по всей
    переписке он видит один раз и запоминает.
    """
    if not cs or not cs.get("cases"):
        return ""
    s = cs.get("summary") or {}
    L = []
    a = L.append
    a('<div class="anch" id="talks"></div><h2>' + ic("message") + 'Разбор переговоров</h2>')
    a('<div class="sumbox"><div style="font-size:17px;font-weight:600">Главное по вашим переговорам</div>')
    a('<div class="small" style="margin-top:6px">Счёт идёт по всей вашей переписке за период, '
      'а не по карточкам ниже. Карточки это примеры, по одному на тип.</div>')
    if s.get("top_defects"):
        a('<div class="sumgrid bad">')
        for d in s["top_defects"]:
            a(f'<div><div class="n">{esc(d["n"])}</div><div class="l">{esc(d["title"])}, '
              f'{plural(d["n"], "случай", "случая", "случаев")}</div></div>')
        a('</div>')
    if s.get("strengths"):
        a('<div class="sumgrid good">')
        for g in s["strengths"]:
            a(f'<div><div class="n">{esc(g["n"])}</div><div class="l">{esc(g["title"])}, '
              f'{plural(g["n"], "раз", "раза", "раз")}</div></div>')
        a('</div>')
    a('</div>')
    defects = [c for c in cs["cases"] if c["verdict"] == "defect"]
    strong = [c for c in cs["cases"] if c["verdict"] == "strong"]
    if defects:
        a(f'<h3>Что чинить: {len(defects)} {plural(len(defects), "случай", "случая", "случаев")} '
          f'из вашей переписки</h3>')
        for c in defects:
            a(case_card(c, mgr, built_dt))
    if strong:
        a(f'<h3>Что уже получается: {len(strong)} '
          f'{plural(len(strong), "случай", "случая", "случаев")}, повторять</h3>')
        for c in strong:
            a(case_card(c, mgr, built_dt))
    a('<div class="small">Кейсы отобраны скриптом по каталогу дефектов: по одному на тип, '
      'сначала сделки с большей суммой. Цитаты сокращены до 200 знаков, телефоны и почта '
      'вычищены, фамилии сокращены до имени. Не согласны с разбором конкретной реплики: '
      'кнопка «не согласен» в строке кейса.</div>')
    return "\n".join(L)


def registry_block(regm, mgr, built_dt):
    """Персональный реестр замечаний: счётчик на каждое утверждение и сделки,
    по которым оно посчитано, с вердиктом AI-Кости на каждую.

    Здесь только сделки самого менеджера: чужих данных в кабинете физически нет.
    Полный реестр отдела с теми же счётчиками видит РОП в сводке.
    """
    if not regm:
        return ""
    L = []
    a = L.append
    a('<div class="anch" id="reestr"></div><h2>' + ic("check") + 'Реестр: все ваши случаи по типам</h2>')
    a('<div class="small" style="max-width:75ch">Карточки выше это примеры, по одному на тип. '
      'Здесь счёт целиком: каждое утверждение с числом срабатываний и сделками, по которым '
      'оно посчитано. Раскрывается по клику. Тот же реестр по всему отделу видит РОП.</div>')
    order = sorted(regm.items(), key=lambda x: (x[1]["kind"] != "defect", -x[1]["n"]))
    for code, c in order:
        bad = c["kind"] == "defect"
        nev = len(c["evidence"])
        a(f'<details class="reg"><summary><span class="rn {"bad" if bad else "good"}">{c["n"]}</span>'
          f'<span class="rt"><b>{esc(c["title"])}</b>'
          f'<div class="small">{c["n"]} {plural(c["n"], "срабатывание", "срабатывания", "срабатываний")} '
          f'по вашей переписке · в выборке {nev} {plural(nev, "сделка", "сделки", "сделок")} · раскрыть</div>'
          f'</span></summary><div class="reg-b">')
        if c.get("diag"):
            a(f'<div class="small" style="max-width:75ch">{esc(c["diag"])}</div>')
        for e in c["evidence"]:
            a(f'<div class="card case {"bad" if bad else "good"}" style="margin:10px 0">')
            a(f'<div class="small">Сделка <a href="{PORTAL.format(e["deal"])}" target="_blank">'
              f'{esc(e["deal"])}</a> · {esc(e.get("when") or "")}'
              f'{" · " + esc(e["stage"]) if e.get("stage") else ""}</div>')
            if e.get("client"):
                a(f'<div class="q"><div class="who">Клиент написал</div>{esc(e["client"])}</div>')
            if e.get("manager"):
                a(f'<div class="q {"was" if bad else "now"}"><div class="who">Вы ответили</div>'
                  f'{esc(e["manager"])}</div>')
            a('<div class="rk"><b>AI-Костя.</b>')
            a(f'<span class="rk-g">Хорошо: {esc(e["well"])}</span>')
            if e.get("bad"):
                a(f'<span class="rk-b">Плохо: {esc(e["bad"])}</span>')
            a('</div>')
            if e.get("should"):
                a(f'<div class="q now" data-copy><div class="who">Как надо было</div>{esc(e["should"])}</div>')
            a('</div>')
        a('</div></details>')
    a('<div class="small">Счётчик считает все срабатывания детектора, выборка ограничена '
      'восемью сделками на тип: сначала пары с репликой клиента и большей суммой. '
      'Не согласны с конкретным разбором: кнопка «не согласен» есть у карточек-примеров выше, '
      'реестр пересчитывается тем же скриптом.</div>')
    return "\n".join(L)


# ВНИМАНИЕ: второго блока <style> быть не может. Сборщик кабинета берёт из файла
# ровно первый блок (build-platform.mjs, склейка payload), второй теряется молча,
# и сборка при этом не падает. Поэтому @media print живёт здесь же.
CSS = """
:root{--bg:#06121a;--panel:#0b1a24;--panel2:#0e2130;--line:#233242;--line2:#2a3a4a;
--tx:#dfe9f0;--mut:#7b93a6;--note:#dfe9f0;--acc:#22D3EE;--acc2:#0E7490;
--ok:#34D399;--warn:#f59e0b;--bad:#E05A50}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
:where(a,button,summary,input,[data-copy]):focus-visible{outline:2px solid var(--acc);outline-offset:2px;border-radius:4px}
.cab{max-width:868px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:24px;margin:0 0 4px}
h2{font-size:19px;margin:34px 0 10px;display:flex;align-items:center;gap:10px}
h3{font-size:15px;margin:16px 0 6px;color:var(--tx);font-weight:600}
/* Иконка едет за кеглем строки, а не за экраном, и наследует цвет контекста. */
.ic{width:1.15em;height:1.15em;flex:none;vertical-align:-.18em;color:var(--acc)}
.toc a .ic{width:1em;height:1em;margin-right:5px}
p,.note{max-width:66ch}
.sub{color:var(--mut);font-size:13px}
.toc{font-size:13px;margin:10px 0 4px}.toc a{margin-right:14px;display:inline-block;padding:6px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;margin:10px 0}
.card.sys{border-color:var(--acc2);background:var(--panel2)}
.card.task{border-color:var(--acc);border-width:2px}
.card.win{border-color:#1c5a45}
/* Якорь секции живёт на отдельном элементе, а не на h2: оболочка академии
   пересобирает заголовки и снимает с них атрибуты, и ссылки навигации кабинета
   молча переставали работать внутри неё. */
.anch{position:relative;top:-56px;height:0;overflow:hidden}
/* Кейс переговоров. Цвет несёт вердикт, но не остаётся единственным его носителем:
   рядом стоит текстовый ярлык, иначе при дальтонизме карточка теряет смысл. */
.card.case{border-left-width:4px}
.card.case.bad{border-left-color:var(--bad)}
.card.case.good{border-left-color:var(--ok);border-color:#1c5a45}
.who{font-size:12px;color:var(--mut);margin-bottom:3px;letter-spacing:.02em}
.sumbox{background:var(--panel2);border:1px solid var(--acc2);border-radius:12px;padding:16px;margin:10px 0}
.sumgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:10px}
.sumgrid>div{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px}
.sumgrid .n{font-size:28px;font-weight:600;line-height:1.15}
.sumgrid.bad .n{color:var(--bad)}
.sumgrid.good>div{border-color:#1c5a45}.sumgrid.good .n{color:var(--ok)}
.card .note,.card ul.note li{color:var(--note);font-size:14px;max-width:66ch}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kpi>div{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px}
.v{font-size:23px;font-weight:600}.l{color:var(--mut);font-size:12.5px;margin-top:3px}
.d{font-size:12.5px;margin-top:4px}.d.up{color:var(--ok)}.d.down{color:var(--bad)}
.tag{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11.5px;border:1px solid #3a5066;color:var(--mut)}
.tag.ok{color:var(--ok);border-color:#1c5a45}.tag.bad{color:var(--bad);border-color:#5c2320}
.tag.warn{color:var(--warn);border-color:#5e4415}.tag.acc{color:var(--acc);border-color:var(--acc2)}
.q{background:var(--panel2);border-left:3px solid var(--line2);padding:10px 13px;margin:8px 0;border-radius:0 8px 8px 0;font-size:14px;max-width:70ch}
.q.was{border-left-color:var(--bad)}.q.now{border-left-color:var(--ok)}
/* Реестр замечаний: счётчик слева, утверждение справа, раскрытие по клику.
   Цвет вердикта дублируется словами «Хорошо» и «Плохо»: при дальтонизме
   цвет не единственный носитель смысла. */
details.reg{border:1px solid var(--line);border-radius:12px;background:var(--panel);margin:10px 0}
details.reg>summary{display:flex;align-items:center;gap:14px;padding:12px 16px;cursor:pointer;list-style:none}
details.reg>summary::-webkit-details-marker{display:none}
details.reg[open]>summary{border-bottom:1px solid var(--line)}
.rn{flex:none;min-width:64px;text-align:right;font-weight:600;line-height:1.1;font-size:26px;font-variant-numeric:tabular-nums}
.rn.bad{color:var(--bad)}.rn.good{color:var(--ok)}
.rt{flex:1 1 auto;min-width:0}
.reg-b{padding:10px 16px 14px}
.rk{font-size:13.5px;margin-top:6px;max-width:75ch}
.rk-g{display:block;color:var(--ok);margin-top:2px}
.rk-b{display:block;color:var(--bad);margin-top:2px}
[data-copy]{cursor:copy;position:relative}
[data-copy]::after{content:"копировать";position:absolute;right:10px;top:8px;font-size:10.5px;color:var(--mut);letter-spacing:.03em}
[data-copy].done::after{content:"скопировано";color:var(--ok)}
table{width:100%;border-collapse:collapse;font-size:13px}
.scroll{overflow:auto;max-height:60vh;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line)}
th{color:var(--mut);font-weight:500;font-size:12.5px;background:var(--panel2);position:sticky;top:0;cursor:pointer;box-shadow:0 1px 0 var(--line)}
tbody tr:nth-child(even){background:rgba(255,255,255,.022)}
tbody tr:hover{background:var(--panel2)}
tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
td a{display:inline-block;padding:7px 4px;margin:-7px -4px}
ul{margin:6px 0 6px 20px;padding:0}li{margin:5px 0;max-width:64ch}
.small{font-size:13px;color:var(--mut);max-width:62ch}
button.copy,button.disp{background:var(--acc2);border:0;color:#fff;padding:11px 16px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px;margin-top:6px}
button.disp{background:transparent;color:var(--mut);border:1px solid var(--line2);padding:7px 10px;font-size:12px;margin:0}
button:hover{background:var(--acc);color:var(--bg)}
details{border:1px solid var(--line);border-radius:10px;background:var(--panel);margin:8px 0}
summary{padding:12px 14px;cursor:pointer;list-style:none;font-size:14px}
summary::-webkit-details-marker{display:none}
summary::before{content:"\\25b8";display:inline-block;margin-right:8px;color:var(--acc);transition:transform .15s ease-out}
details[open]>summary::before{transform:rotate(90deg)}
details>*:not(summary){margin:0 14px 14px}
input.f{width:100%;background:var(--panel2);border:1px solid var(--line2);color:var(--tx);padding:10px 12px;border-radius:8px;font:inherit;font-size:13px}
footer{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);color:var(--mut);font-size:13px}
@media(max-width:600px){.cab{padding:14px 12px 40px}h1{font-size:21px}
 td a{padding:11px 6px;margin:-11px -6px}.toc a{padding:10px 0}}
@media (prefers-reduced-motion:reduce){*{transition-duration:.01ms !important}}
@media print{
 :root{--bg:#fff;--panel:#fff;--panel2:#f5f7f8;--tx:#111;--mut:#444;--note:#111;--line:#ccc;--line2:#bbb;--acc:#0b5a72}
 body{background:#fff;color:#111}
 .cab{max-width:none;padding:0}
 details{border:0}details>*:not(summary){margin:0}
 .scroll{max-height:none;overflow:visible;border:1px solid #ccc}
 th{position:static;box-shadow:none}
 button,.toc,[data-copy]::after{display:none}
 a[href^="https"]::after{content:" (" attr(href) ")";font-size:10px;color:#555;word-break:break-all}
 #paper{display:block !important}
 h2{break-after:avoid}.card,tr{break-inside:avoid}
}
#paper{display:none;font-size:11px;color:#444;border-top:1px solid #ccc;margin-top:12px;padding-top:6px}
"""


def render(m, pm, kk, meta, period, D, prev, cs=None, regm=None):
    """Одна персональная страница.

    Порядок блоков: сначала собственные цифры человека, потом одна задача на
    14 дней, потом разбор его переговоров. Раздел «Не ваша зона» уехал в конец
    и свёрнут: он снимает претензию, но не отвечает на вопрос «что у меня».
    """
    r = m.get("reply") or {}
    built = (meta.get("generated_at") or datetime.now().isoformat())[:19]
    built_dt = datetime.fromisoformat(built) if len(built) >= 10 else datetime.now()
    check_dt = built_dt + timedelta(days=14)
    check30 = built_dt + timedelta(days=30)
    p = prev or {}
    L = []
    a = L.append
    a(f'<!doctype html><html lang="ru"><head><meta charset="utf-8">'
      f'<meta name="viewport" content="width=device-width,initial-scale=1">'
      f'<meta name="robots" content="noindex,nofollow">'
      f'<title>{esc(m["mgr"])}. Разбор работы</title><style>{CSS}</style></head><body><div class="cab">')

    # 1. Шапка
    key, val, unit = pick_task(m, kk)
    title, trigger, steps, phrase, metric = TASK_LIB[key]
    a('<header>')
    a(f'<h1>{esc(m["mgr"])}</h1>')
    a(f'<div class="sub">Разбор переписки за {esc(period["from"])} - {esc(period["to"])}. '
      f'Собрано {esc(built.replace("T", " ")[:16])}.</div>')
    a(f'<div class="note" style="margin-top:10px">Ваша задача на 14 дней: <b>{esc(title)}</b>. '
      f'<a href="#task">Перейти к ней</a></div>')
    if p:
        was = (p.get("builtAt") or "")[:10]
        was_ru = datetime.fromisoformat(was).strftime("%d.%m.%Y") if len(was) == 10 else was
        a(f'<div class="small" style="margin-top:8px">Сравнение с прошлым разбором от '
          f'{esc(was_ru)} идёт под каждым нормативом.</div>')
    else:
        a('<div class="small" style="margin-top:8px">Это первый разбор. '
          'Точки сравнения появятся в следующем, через две недели.</div>')
    a('</header>')
    a('<nav class="toc"><a href="#norm">' + ic("normativy") + 'Мои цифры</a><a href="#task">' + ic("check") + 'Моя задача</a>'
      '<a href="#talks">' + ic("message") + 'Разбор переговоров</a>'
      + ('<a href="#reestr">' + ic("check") + 'Реестр</a>' if regm else '')
      + '<a href="#money">' + ic("money") + 'Деньги</a><a href="#win">' + ic("check") + 'Получилось</a>'
      '<a href="#qual">' + ic("kvalifikaciya") + 'Квалификация</a><a href="#deals">' + ic("deal") + 'Сделки</a>'
      '<a href="#sys">' + ic("ne-vasha-zona") + 'Не моя зона</a></nav>')

    # 2. Дашборд собственных цифр. Стоит первым: человек открывает кабинет ради
    # своих чисел, и раздел про чужую зону ответственности на первом экране
    # отодвигал их вниз.
    a('<div class="anch" id="norm"></div><h2>' + ic("normativy") + 'Три норматива, ваши цифры и динамика</h2><div class="kpi">')
    a(f'<div><div class="v"{reglament_tone("reply", r.get("p90Min"))}>{mins(r.get("p90Min"))}</div>'
      f'<div class="l">p90 ответа. Норматив отдела: ни один клиент не ждёт дольше 4 рабочих часов '
      f'<span class="tag acc">РЕГЛАМЕНТ</span></div>{delta(p, "p90Min", r.get("p90Min"), mins, lower_better=True)}</div>')
    a(f'<div><div class="v"{reglament_tone("unanswered", m["unansweredCount"])}>{m["unansweredCount"]}</div>'
      f'<div class="l">диалогов оборвано на клиенте. Норматив: ноль '
      f'<span class="tag acc">РЕГЛАМЕНТ</span></div>'
      f'{delta(p, "unanswered", m["unansweredCount"], str, lower_better=True)}</div>')
    cts = m.get("concreteTimeShare")
    a(f'<div><div class="v">{"нет данных" if cts is None else f"{cts*100:.0f}%"}</div>'
      f'<div class="l">обещаний с конкретным сроком, по отделу {D["concreteShare"]*100:.0f}%. '
      f'Порог не откалиброван <span class="tag warn">ГИПОТЕЗА</span></div>'
      f'{delta(p, "concrete", None if cts is None else round(cts*100), lambda v: f"{v}%")}</div>')
    a('</div>')
    a(f'<div class="small">Медиана вашего ответа {mins(r.get("medianMin"))}, по отделу '
      f'{mins(D["medianMin"])}. Медиана не красится цветом: норматива на неё не назначено, '
      f'а хвост важнее середины.</div>')
    idx, band = band_of(m)
    a('<div class="card"><b>Ваш индекс качества коммуникации: </b>'
      + (f'<b>{idx}</b> из 10, полоса «{esc(band)}».' if idx is not None
         else f'не считается, полоса «{esc(band)}».')
      + '<div class="small" style="margin-top:6px">Индекс и полосу видите вы и РОП. '
        'На общем экране отдела показывается только движение, без ранжирования людей: '
        'при выборке в полтора десятка сделок доверительный интервал шире двух баллов, '
        'и разница в десятых между людьми ничего не значит. '
        '<span class="tag warn">ГИПОТЕЗА</span></div></div>')

    # 3. Одна задача на 14 дней
    a('<div class="anch" id="task"></div><h2>' + ic("check") + 'Моя задача на 14 дней</h2>')
    a(f'<div class="card task"><div style="font-size:18px;font-weight:600">{esc(title)}</div>')
    a(f'<h3>Когда срабатывает</h3><div>{esc(trigger)}</div>')
    a('<h3>Что я делаю</h3><ul>')
    for s in steps:
        a(f'<li>{esc(s)}</li>')
    a('</ul>')
    if phrase:
        a(f'<h3>Готовая фраза</h3><div class="q now" data-copy>{esc(phrase)}</div>')
    a(f'<h3>Почему именно это</h3><div class="small">Ваша цифра за {esc(period["from"])} - {esc(period["to"])}: '
      f'<b>{esc(val)}</b> {esc(unit)}.</div>')
    a(f'<h3>Как проверим {esc(check_dt.strftime("%d.%m.%Y"))}</h3>')
    a('<div class="scroll" style="max-height:none"><table><tbody>'
      f'<tr><td>Метрика</td><td>{esc(metric)}</td></tr>'
      f'<tr><td>Кто считает</td><td>скрипт Kostya-AI, тот же, что собрал эту страницу</td></tr>'
      f'<tr><td>Выборка</td><td>{m["deals"]} сделок, {m.get("outText") or m["out"]} исходящих с текстом '
      f'за {esc(period["from"])} - {esc(period["to"])}</td></tr>'
      f'<tr><td>Baseline, замер {esc(built_dt.strftime("%d.%m.%Y"))}</td><td><b>{esc(val)}</b> {esc(unit)}</td></tr>'
      f'<tr><td>Цель Д+14, {esc(check_dt.strftime("%d.%m.%Y"))}</td>'
      f'<td>назначает РОП вместе с вами <span class="tag warn">ГИПОТЕЗА</span></td></tr>'
      f'<tr><td>Цель Д+30, {esc(check30.strftime("%d.%m.%Y"))}</td>'
      f'<td>назначает РОП вместе с вами <span class="tag warn">ГИПОТЕЗА</span></td></tr>'
      '</tbody></table></div>')
    a('<h3>Что дальше</h3><ul class="note">'
      f'<li><b>Цель взята к {esc(check_dt.strftime("%d.%m"))}:</b> задача закрывается, '
      'следующая берётся из этого же разбора, норматив переходит в поддерживающий режим '
      'и проверяется раз в месяц.</li>'
      f'<li><b>Цель не взята:</b> разбираем с РОПом, почему. Первым делом проверяем, '
      'не мешает ли что-то из раздела «Не ваша зона», и только потом смотрим на действия. '
      'Задача не меняется и не добавляется вторая.</li></ul>')
    a('<div class="small">Обе ветки объявлены заранее, до замера, чтобы результат не '
      'толковали задним числом.</div>')
    a('</div>')

    # 4. Разбор переговоров. Пустая строка, если cases.json не передан: сочинять
    # кейсы из метрик нельзя, а секция без цитат не нужна.
    talks = talks_block(cs, m["mgr"], built_dt)
    if talks:
        a(talks)

    # 4а. Персональный реестр замечаний: счётчики и сделки-доказательства.
    reg = registry_block(regm, m["mgr"], built_dt)
    if reg:
        a(reg)

    # 5. Деньги на столе
    deals = pm.get("deals", [])
    CLOSED = {"Сделка провалена", "Сделка успешна"}
    flagged = [d for d in deals if d.get("unanswered") or (d.get("maxReply") or 0) > 480]
    risky = sorted([d for d in flagged if d.get("stage") not in CLOSED],
                   key=lambda d: -d["amount"])[:8]
    closed = sorted([d for d in flagged if d.get("stage") in CLOSED],
                    key=lambda d: -d["amount"])
    a('<div class="anch" id="money"></div><h2>' + ic("money") + 'Деньги на столе</h2>')
    if risky:
        a(f'<div class="small">Открытых сделок с оборванным диалогом или очень долгим ответом: '
          f'{len(risky)} на {money(sum(d["amount"] for d in risky))}. Их ещё можно вернуть.</div>')
        a('<div class="scroll" style="margin-top:8px"><table><thead><tr><th>Сделка</th><th class="num">Сумма</th>'
          '<th>Стадия</th><th>Что не так</th><th>Возражение</th></tr></thead><tbody>')
        for d in risky:
            what = "диалог оборван на клиенте" if d.get("unanswered") else f"ответ занимал до {mins(d.get('maxReply'))}"
            fresh = ""
            first = (d.get("first") or "")[:10]
            if first:
                try:
                    age = (built_dt - datetime.fromisoformat(first)).days
                    if age <= 10:
                        fresh = ' <span class="tag ok">моложе 10 дней</span>'
                except ValueError:
                    pass
            a(f'<tr><td><a href="{PORTAL.format(d["id"])}" target="_blank">{esc(d["id"])}</a>{fresh}</td>'
              f'<td class="num" data-v="{int(d["amount"] or 0)}">{money(d["amount"])}</td>'
              f'<td>{esc(d["stage"])}</td><td>{esc(what)}</td>'
              f'<td>{dispute_btn(d["id"], what, m["mgr"], built_dt)}</td></tr>')
        a('</tbody></table></div>')
        if risky[0].get("unansweredText"):
            a(f'<div class="q was"><b>Сделка {esc(risky[0]["id"])}, последнее слово клиента:</b><br>'
              f'{esc(cut(risky[0]["unansweredText"]))}</div>')
    else:
        a(f'<div class="card"><b>Ни одной открытой сделки с оборванным диалогом.</b> '
          f'По отделу таких сделок {D["unanswered"]}.</div>')
    if closed:
        a(f'<details><summary>Уже закрыто, смотрим как урок: {len(closed)} на '
          f'{money(sum(d["amount"] for d in closed))}</summary>'
          '<div class="small">Вернуть эти деньги нельзя, поэтому они не в списке выше. '
          'Они здесь, чтобы было видно, на чём именно рвался диалог.</div>'
          '<div class="scroll"><table><thead><tr><th>Сделка</th><th class="num">Сумма</th>'
          '<th>Стадия</th><th>Что не так</th></tr></thead><tbody>')
        for d in closed[:10]:
            what = "диалог оборван на клиенте" if d.get("unanswered") else f"ответ занимал до {mins(d.get('maxReply'))}"
            a(f'<tr><td><a href="{PORTAL.format(d["id"])}" target="_blank">{esc(d["id"])}</a></td>'
              f'<td class="num" data-v="{int(d["amount"] or 0)}">{money(d["amount"])}</td>'
              f'<td>{esc(d["stage"])}</td><td>{esc(what)}</td></tr>')
        a('</tbody></table></div></details>')

    # 5. Что получилось
    a('<div class="anch" id="win"></div><h2>' + ic("check") + 'Что получилось</h2>')
    wins = pm.get("wins", [])
    good = []
    if r.get("medianMin") is not None and D["medianMin"] and r["medianMin"] <= D["medianMin"]:
        good.append(f'Медиана ответа клиенту {mins(r["medianMin"])} при нормативе отдела '
                    f'{mins(D["medianMin"])}.')
    if r.get("within60") and r["within60"] >= 0.7:
        good.append(f'{r["within60"]*100:.0f}% ответов быстрее часа.')
    if (m.get("greetShare") or 0) >= 0.85:
        good.append(f'Приветствие в первом сообщении дня: {m["greetShare"]*100:.0f}%.')
    if (m.get("concreteTimeShare") or 0) >= 0.12:
        good.append(f'Конкретный срок в {m["concreteTimeShare"]*100:.0f}% обещаний '
                    f'при нормативе отдела {D["concreteShare"]*100:.0f}%.')
    if (m.get("initiatedShare") or 0) >= 0.65:
        good.append(f'{m["initiatedShare"]*100:.0f}% диалогов начинаете сами, не ждёте клиента.')
    if not good:
        good.append(f'Объём работы: {m["out"]} исходящих сообщений по {m["deals"]} сделкам за период.')
    a('<div class="card win"><ul>')
    for g in good:
        a(f'<li>{esc(g)}</li>')
    a('</ul>')
    # Дедупликация: две «победы» с одной и той же цитатой под разными ярлыками
    # читаются как сбой детектора и обесценивают единственный позитивный блок.
    seen, shown = set(), 0
    for w in wins:
        k = re.sub(r"\W+", "", (w.get("text") or "")[:80]).lower()
        if not k or k in seen:
            continue
        seen.add(k)
        a(f'<div class="q now"><b>{esc(w["label"])}</b>, сделка '
          f'<a href="{PORTAL.format(w["deal"])}" target="_blank">{esc(w["deal"])}</a><br>'
          f'{esc(cut(w["text"], 200))}</div>')
        shown += 1
        if shown == 2:
            break

    a('</div>')

    # 7. Квалификация
    od = m.get("outDet") or {}
    a('<div class="anch" id="qual"></div><h2>' + ic("kvalifikaciya") + 'Квалификация клиента</h2>')
    a('<div class="kpi">')
    for code, label in [("Q_БЮДЖЕТ", "спросили про бюджет"), ("Q_СРОК", "спросили про срок"),
                        ("Q_ЛПР", "спросили, кто решает")]:
        a(f'<div><div class="v">{od.get(code, 0)}</div><div class="l">{label}, раз за период</div></div>')
    a('</div>')
    a(f'<div class="card"><div class="note">По отделу вопрос про бюджет встречается в '
      f'{D["qBudgetShare"]*100:.2f}% исходящих, про ЛПР в {D["qLprShare"]*100:.2f}%. '
      f'Это общий провал команды, а не ваш личный. Готовые формулировки, '
      f'они разные для дизайнера и для физлица:</div>')
    a('<div class="q now" data-copy><b>Дизайнеру:</b> В каком уровне идёт остальная комплектация проекта? '
      'Чтобы я сразу считал в одном классе с тем, что вы уже подобрали.</div>')
    a('<div class="q now" data-copy><b>Физлицу:</b> Скажу честно, чтобы не гонять вас по вариантам. '
      'По такому изделию есть решения разного уровня, разница в стекле и фурнитуре. '
      'На какую сторону ориентируемся?</div>')
    a('<div class="q now" data-copy><b>Про ЛПР:</b> Когда планируете выносить спецификацию заказчику? '
      'Подготовлю материалы сразу в виде, удобном для показа.</div></div>')

    # 9. Таблица сделок. Свёрнута: это справочник и мост в Bitrix для возражения,
    # а не то, что читают подряд. ТЗ раздел 4, блок 9 требует фильтр.
    a('<div class="anch" id="deals"></div><h2>' + ic("deal") + 'Все сделки в переписке</h2>')
    a(f'<details><summary>Показать таблицу: {len(deals)} сделок на '
      f'{money(sum(d.get("amount") or 0 for d in deals))}</summary>')
    a('<div class="small">Нужна, чтобы возразить по конкретному номеру: право оспорить флаг '
      'работает только с номером сделки.</div>')
    a('<input class="f" id="dq" type="search" placeholder="Фильтр: номер сделки, стадия, изделие" '
      'aria-label="Фильтр по сделкам">')
    a('<div class="scroll"><table><thead><tr><th>Сделка</th><th class="num">Сумма</th><th>Стадия</th>'
      '<th class="num">Сообщ.</th><th class="num">Дней</th><th>Последнее слово</th></tr></thead>'
      '<tbody id="dtb">')
    for d in deals[:60]:
        last = ('<span class="tag bad">за клиентом</span>' if d.get("unanswered")
                else '<span class="tag ok">за нами</span>')
        a(f'<tr><td><a href="{PORTAL.format(d["id"])}" target="_blank">{esc(d["id"])}</a></td>'
          f'<td class="num" data-v="{int(d.get("amount") or 0)}">{money(d["amount"])}</td>'
          f'<td>{esc(d["stage"])}</td>'
          f'<td class="num" data-v="{d["n"]}">{d["n"]}</td>'
          f'<td class="num" data-v="{d["days"]}">{d["days"]}</td><td>{last}</td></tr>')
    a('</tbody></table></div>')
    a('<div class="small" id="dcnt"></div>')
    if len(deals) > 60:
        a(f'<div class="small">Показаны 60 из {len(deals)} по убыванию суммы. '
          f'Полный список в Bitrix24, фильтр по вашему имени.</div>')
    a('</details>')

    # 10. Флаги дисциплины из Bitrix
    if kk:
        a('<h2>' + ic("chart") + 'Дисциплина по открытым сделкам</h2><div class="kpi">')
        a(f'<div><div class="v">{kk["openDeals"]}</div><div class="l">открытых сделок на {money(kk["openBudget"])}</div></div>')
        a(f'<div><div class="v">{kk["stuckDeals"]}</div><div class="l">зависли на стадии дольше лимита</div></div>')
        a(f'<div><div class="v">{kk["overdueTasks"]}</div><div class="l">просроченных дел</div></div>')
        a(f'<div><div class="v">{kk["noNextStep"]}</div><div class="l">без запланированного шага</div></div>')
        a('</div>')
        a('<div class="small">Индекс дисциплины считается по чистоте ведения CRM, а не по выручке. '
          'Пороги пока не откалиброваны и помечены как гипотеза.</div>')

    # 11. Не ваша зона. Стоит в конце и свёрнута в одну строку: раздел нужен как
    # опора при разборе с РОПом, а не как первое, что человек читает про себя.
    a('<div class="anch" id="sys"></div><h2>' + ic("ne-vasha-zona") + 'Не ваша зона</h2>')
    a(f'<details><summary>{len(SYSTEMIC)} '
      f'{plural(len(SYSTEMIC), "дефект", "дефекта", "дефектов")} чинит РОП и интегратор '
      f'Bitrix24, вам они не вменяются</summary><ul class="note">')
    for s in SYSTEMIC:
        a(f'<li>{esc(s)}</li>')
    a('</ul></details>')

    due = workdays_after(built_dt, CONTRACT["dispute"]["slaWorkdays"])
    a(f'<footer>Kostya-AI. Разбор построен на выгрузке переписки Bitrix24 воронки C49 и снимке сделок. '
      f'Не измеряет звонки и не измеряет продажи. Оценкой сотрудника этот файл не является '
      f'и в кадровом решении не участвует: результаты не влияют на премию.<br>'
      f'Несогласие с флагом: кнопка «не согласен» в строке, адресат {esc(CONTRACT["dispute"]["owner"])}. '
      f'{esc(CONTRACT["dispute"]["rule"])} По этому разбору срок ответа до '
      f'{esc(due.strftime("%d.%m.%Y"))} включительно.<br>'
      f'Что значат метки ДАННЫЕ, ГИПОТЕЗА и РЕГЛАМЕНТ и как устроен разбор целиком: '
      f'библиотека отдела продаж, раздел «Как читать разбор».</footer>')
    a(f'<div id="paper">Копия персональных данных. {esc(m["mgr"])}, разбор от '
      f'{esc(built_dt.strftime("%d.%m.%Y"))}. Не передавать третьим лицам.</div>')
    # Скрипты живут в оболочке гейта: payload вставляется через innerHTML, и гейт
    # пересоздаёт script-элементы, поэтому обработчики работают. Инлайновый onclick
    # тоже работает, но не масштабируется, поэтому всё через делегирование.
    a("""<script>
// Сортировка по клику. Значение берётся из data-v, а не из текста ячейки:
// «1.5 раб.дн» после вычистки нецифр превращалась в 1.5 и вставала ниже «12 мин».
document.addEventListener('click', e => {
  const th = e.target.closest('thead th');
  if (!th) return;
  const tb = th.closest('table').tBodies[0];
  if (!tb || !tb.rows.length) return;
  const col = [...th.parentNode.children].indexOf(th);
  const dir = th.dataset.dir === 'asc' ? -1 : 1;
  for (const h of th.parentNode.children) { delete h.dataset.dir; h.textContent = h.textContent.replace(/ [\\u25b2\\u25bc]$/, ''); }
  th.dataset.dir = dir === 1 ? 'asc' : 'desc';
  th.textContent += dir === 1 ? ' \\u25b2' : ' \\u25bc';
  const val = r => {
    const c = r.cells[col];
    if (!c) return null;
    if (c.dataset.v !== undefined) { const n = parseFloat(c.dataset.v); return Number.isNaN(n) ? null : n; }
    return null;
  };
  const rows = [...tb.rows], numeric = rows.every(r => val(r) !== null);
  rows.sort((a, b) => numeric ? (val(a) - val(b)) * dir
    : (a.cells[col] ? a.cells[col].innerText : '').localeCompare(b.cells[col] ? b.cells[col].innerText : '', 'ru') * dir);
  tb.append(...rows);
});
// Копирование. Тихий отказ недопустим: по file:// доступ к буферу закрыт в части
// браузеров, и человек видел бы ровно ничего.
function copyText(txt, el){
  const done = () => { if (!el) return; el.classList.add('done'); setTimeout(() => el.classList.remove('done'), 1400); };
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (ok) done(); else window.prompt('Скопируйте текст вручную', txt);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(done).catch(fallback);
  } else fallback();
}
document.addEventListener('click', e => {
  const d = e.target.closest('[data-disp]');
  if (d) { copyText(d.dataset.disp, d); return; }
  const el = e.target.closest('[data-copy]');
  if (el) copyText(el.innerText.trim(), el);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest('[data-copy]');
  if (el) { e.preventDefault(); copyText(el.innerText.trim(), el); }
});
document.querySelectorAll('[data-copy]').forEach(el => {
  el.tabIndex = 0; el.setAttribute('role', 'button');
  el.setAttribute('aria-label', 'Скопировать формулировку');
});
document.querySelectorAll('thead th').forEach(th => { th.title = 'Клик, сортировка'; });
// Фильтр таблицы сделок. Пустой результат обязан говорить, что он пустой.
(function(){
  const q = document.getElementById('dq'), tb = document.getElementById('dtb'), cnt = document.getElementById('dcnt');
  if (!q || !tb) return;
  const total = tb.rows.length;
  q.addEventListener('input', () => {
    const s = q.value.trim().toLowerCase();
    let n = 0;
    for (const r of tb.rows) {
      const hit = !s || r.innerText.toLowerCase().includes(s);
      r.style.display = hit ? '' : 'none';
      if (hit) n++;
    }
    cnt.textContent = !s ? '' : (n ? 'Показано ' + n + ' из ' + total + '.'
      : 'Ни одной сделки по запросу «' + q.value.trim() + '». Проверьте номер или очистите фильтр.');
  });
})();
</script>""")
    a('</div></body></html>')
    return "\n".join(L)


def snapshot_of(m):
    """Слепок метрик прогона. Без него следующий разбор не сможет показать динамику,
    и каждый разбор останется разовым ударом вместо этапа."""
    r = m.get("reply") or {}
    cts = m.get("concreteTimeShare")
    return {"p90Min": r.get("p90Min"), "medianMin": r.get("medianMin"),
            "unanswered": m.get("unansweredCount"),
            "concrete": None if cts is None else round(cts * 100)}


# Режим фрагмента: страница отдаётся куском для вставки в академию, а не
# самостоятельным документом.
FRAGMENT = "--fragment" in sys.argv


def main(analysis_path, per_manager_path, out_dir, kostya_path=None, cases_path=None,
         registry_path=None):
    A = json.load(open(analysis_path, encoding="utf-8"))
    PM = json.load(open(per_manager_path, encoding="utf-8"))["managers"]
    K = json.load(open(kostya_path, encoding="utf-8")) if kostya_path else None
    kk_by_key = {name_key(x["mgr"]): x for x in K["managers"]} if K else {}
    # Кейсы переговоров необязательны: выгрузка диалогов ручная и приходит реже,
    # чем снимок сделок. Без файла секция «Разбор переговоров» не рендерится, а
    # не наполняется заглушками.
    CS = json.load(open(cases_path, encoding="utf-8"))["managers"] if cases_path else {}
    cs_by_key = {name_key(k): v for k, v in CS.items()}
    # Реестр замечаний (dialogs-registry.py) режется по менеджеру ЗДЕСЬ, до
    # рендера: в кабинет уезжает срез с одним человеком, чужие сделки в файл
    # не попадают вовсе, и изоляция держится на отсутствии данных.
    reg_by_key = {}
    if registry_path:
        R = json.load(open(registry_path, encoding="utf-8"))
        for code, c in R["claims"].items():
            for mgr_name, v in c["byMgr"].items():
                k = name_key(mgr_name)
                reg_by_key.setdefault(k, {})[code] = {
                    "title": c["title"], "kind": c["kind"], "diag": c["diag"],
                    "n": v["n"], "evidence": v["evidence"]}

    os.makedirs(out_dir, exist_ok=True)
    period = A["meta"]["period"]
    D = dept(A)
    built_at = A["meta"].get("generated_at") or datetime.now().isoformat()

    # Слепок прошлого прогона лежит РЯДОМ с исходниками, а не в папке выдачи:
    # в папку выдачи попадает только то, что раздаётся людям.
    snap_path = os.path.join(os.path.dirname(os.path.abspath(analysis_path)), "kostya-snapshot.json")
    prev_all = {}
    if os.path.exists(snap_path):
        try:
            prev_all = json.load(open(snap_path, encoding="utf-8"))
        except ValueError:
            prev_all = {}

    made, snap = [], {"builtAt": built_at, "managers": {}}
    for m in A["managers"]:
        if m["out"] < 25:
            continue
        pm = PM.get(m["mgr"], {})
        kk = kk_by_key.get(name_key(m["mgr"]))
        sl = page_token(m["mgr"])
        # Слепок того же самого прогона не является прошлым разбором. Без этой
        # проверки повторная сборка на тех же данных печатала бы «две недели
        # назад: столько же», то есть выдуманное сравнение.
        prev = None
        if prev_all.get("builtAt") and prev_all["builtAt"] != built_at:
            prev = (prev_all.get("managers") or {}).get(name_key(m["mgr"]))
            if prev:
                prev = dict(prev, builtAt=prev_all.get("builtAt"))
        page = render(m, pm, kk, A["meta"], period, D, prev, cs_by_key.get(name_key(m["mgr"])),
                      reg_by_key.get(name_key(m["mgr"])))
        if FRAGMENT:
            # Кабинет уезжает разделом внутрь академии, поэтому отдаём не документ,
            # а его содержимое: своя обёртка .cab и свой каркас там лишние, их даёт
            # оболочка. Стили кладём один раз рядом, сборщик академии доклеит их в
            # head: второй блок <style> в body теряется молча.
            inner = page.split("<body>", 1)[1].rsplit("</body>", 1)[0]
            inner = inner.replace('<div class="cab">', "", 1)
            inner = inner[::-1].replace(">vid/<", "", 1)[::-1]
            path = os.path.join(out_dir, f"{sl}.frag.html")
            open(path, "w", encoding="utf-8").write(inner)
        else:
            path = os.path.join(out_dir, f"{sl}.html")
            open(path, "w", encoding="utf-8").write(page)
        snap["managers"][name_key(m["mgr"])] = snapshot_of(m)
        ncase = len((cs_by_key.get(name_key(m["mgr"])) or {}).get("cases") or [])
        made.append({"mgr": m["mgr"], "slug": sl, "file": os.path.basename(path),
                     "deals": m["deals"], "joined": kk is not None, "cases": ncase})
        print(f"  {m['mgr']:22} -> {sl}.html   (слой A {'сведён' if kk else 'НЕ сведён'}, "
              f"кейсов переговоров {ncase})")

    if FRAGMENT:
        open(os.path.join(out_dir, "cab.css"), "w", encoding="utf-8").write(CSS)

    json.dump(snap, open(snap_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # Описание страниц для сборщика. Подзаголовок пишется здесь, а не руками:
    # это единственный текст, который человек видит до ввода пароля, и он должен
    # говорить, что внутри, а не только про шифрование.
    pages = [{"file": x["file"], "title": x["mgr"], "scope": "manager", "person": x["mgr"],
              "subtitle": "Разбор вашей переписки с клиентами: что получилось, что чинить "
                          "и одна задача на 14 дней. Это основа плана развития, "
                          "а не итоговая оценка сотрудника."} for x in made]
    pages_path = os.path.join(out_dir, "pages.json")
    old = []
    if os.path.exists(pages_path):
        try:
            old = [x for x in json.load(open(pages_path, encoding="utf-8"))
                   if x.get("scope") != "manager"]
        except ValueError:
            old = []
    json.dump(pages + old, open(pages_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # Манифест НЕ кладётся в папку выдачи: он перечисляет все файлы вместе с
    # именами людей, и при одном общем пароле общая папка давала бы полный
    # список кабинетов тому, кто получил один файл.
    manifest = {"bakedAt": datetime.now().isoformat(), "period": period,
                "source": os.path.basename(analysis_path), "pages": made}
    mpath = os.path.join(os.path.dirname(os.path.abspath(out_dir.rstrip("/"))),
                         os.path.basename(out_dir.rstrip("/")) + "-manifest.json")
    json.dump(manifest, open(mpath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\nстраниц: {len(made)}, папка: {out_dir}")
    print(f"манифест: {mpath} (вне папки выдачи, внутри имена людей)")
    print(f"слепок метрик: {snap_path} (нужен следующему прогону для динамики)")
    print("Файлы НЕ коммитятся: репозиторий публичный, внутри цитаты клиентской переписки.")


if __name__ == "__main__":
    # Флаги отсеиваются по месту, а не по позиции: --fragment ставят и в середину
    # строки, и тогда срез argv[1:5] съедал бы его как путь к kostya.json.
    ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(ARGS) < 3:
        sys.exit("нужно: build-pages.py analysis.json per_manager.json out_dir "
                 "[kostya.json] [cases.json] [registry.json] [--fragment]")
    main(*ARGS[:6])
