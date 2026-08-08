#!/usr/bin/env python3
"""Kostya-AI: персональные страницы менеджеров. По одному самодостаточному файлу на человека.

Почему N файлов, а не один с роутером: при статике без бэкенда единственный способ
не показать менеджеру данные коллег это физически не положить их в файл. Решение
Совета от 2026-08-07, ТЗ knowledge/episodes/2026-08/tz-kostya-ai-final-assembly-20260807.md,
раздел 3.

Порядок блоков задан ТЗ, раздел 4, и менять его нельзя: он определяет, прочитают
страницу или закроют. «Не ваша зона» стоит ВЫШЕ личных претензий.

Файлы попадают в .gitignore. Репозиторий публичный, цитаты клиентской переписки
в него не коммитятся.

Запуск:
  python3 build-pages.py analysis.json per_manager.json out_dir [kostya.json]
"""
import json, sys, os, re, html, statistics
from collections import Counter
from datetime import datetime

PORTAL = "https://glassmemory.bitrix24.ru/crm/deal/details/{}/"

TRANSLIT = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'i',
    'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
    'х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
}

DEFECT_FIX = {
    "T03_ОБЕЩАНИЕ_БЕЗ_СРОКА": ("Обещание без срока",
        "Назвать конкретную дату и время. «Отвечу сегодня до 18:00» вместо «вернусь»."),
    "T03_РАЗМЫТЫЙ_СРОК": ("Размытая формулировка",
        "«В ближайшее время» заменить на дату. Клиент не должен угадывать, когда ждать."),
    "T01_БЕЗ_ПОЯСНЕНИЯ": ("Реплика без пояснения",
        "Короткое сообщение без контекста читается как отписка. Одна строка «что это и что дальше»."),
    "T02_БЕЗ_ПРИВЕТСТВИЯ": ("Первое за день без приветствия",
        "«Добрый день, Имя!» в первом сообщении дня. Две секунды, но клиент чувствует, что его помнят."),
    "T07_ОРФОГРАФИЯ": ("Небрежность в тексте",
        "Лишний пробел перед запятой, слипание знака и буквы. Чинится проверкой правописания, не усилием воли."),
    "T04_ЖАРГОН": ("Жаргон в извинении",
        "«Закрутился», «забылся» заменить на извинение и конкретное действие со сроком."),
    "T06_ЗАЩИТА": ("Защита вместо извинения",
        "Сначала извинение, потом короткое пояснение, потом действие с датой. Никаких «вы не указали»."),
}
# Дефекты, которые НЕ идут в персональную задачу: чинятся инструментом, а не обучением.
NOT_PERSONAL = {"T07_ОРФОГРАФИЯ"}

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


CSS = """
:root{--bg:#06121a;--panel:#0b1a24;--panel2:#0e2130;--line:#233242;--line2:#2a3a4a;
--tx:#dfe9f0;--mut:#5d7484;--acc:#22D3EE;--acc2:#0E7490;--ok:#34D399;--warn:#f59e0b;--bad:#FF4438}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:780px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:30px 0 10px}h3{font-size:14px;margin:16px 0 6px;color:var(--mut);font-weight:500}
.sub{color:var(--mut);font-size:13px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;margin:10px 0}
.card.sys{border-color:var(--acc2);background:var(--panel2)}
.card.task{border-color:var(--acc);border-width:2px}
.card.win{border-color:#1c5a45}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kpi>div{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px}
.v{font-size:23px;font-weight:600}.l{color:var(--mut);font-size:12px;margin-top:3px}
.tag{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;border:1px solid var(--line2);color:var(--mut)}
.tag.ok{color:var(--ok);border-color:#1c5a45}.tag.bad{color:var(--bad);border-color:#5c2320}
.tag.warn{color:var(--warn);border-color:#5e4415}.tag.acc{color:var(--acc);border-color:var(--acc2)}
.q{background:var(--panel2);border-left:3px solid var(--line2);padding:10px 13px;margin:8px 0;border-radius:0 8px 8px 0;font-size:14px}
.q.was{border-left-color:var(--bad)}.q.now{border-left-color:var(--ok)}
table{width:100%;border-collapse:collapse;font-size:13px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line)}
th{color:var(--mut);font-weight:500;font-size:12px;background:var(--panel2)}
tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
ul{margin:6px 0 6px 20px;padding:0}li{margin:5px 0}
.small{font-size:12px;color:var(--mut)}
button.copy{background:var(--acc2);border:0;color:#fff;padding:6px 12px;border-radius:6px;cursor:pointer;font:inherit;font-size:12px;margin-top:6px}
footer{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);color:var(--mut);font-size:12px}
@media(max-width:600px){.wrap{padding:14px 12px 40px}h1{font-size:19px}}
"""


def render(m, pm, kk, meta, period):
    """Одна персональная страница. Порядок блоков задан ТЗ, раздел 4."""
    r = m.get("reply") or {}
    L = []
    a = L.append
    a(f'<!doctype html><html lang="ru"><head><meta charset="utf-8">'
      f'<meta name="viewport" content="width=device-width,initial-scale=1">'
      f'<title>{esc(m["mgr"])}. Разбор работы</title><style>{CSS}</style></head><body><div class="wrap">')

    # 1. Шапка
    a(f'<h1>{esc(m["mgr"])}</h1>')
    a(f'<div class="sub">Разбор переписки за {esc(period["from"])} - {esc(period["to"])}. '
      f'Собрано {esc(meta.get("generated_at", "")[:16].replace("T", " "))}.</div>')
    a('<div class="card sys" style="margin-top:12px"><b>Это основа плана развития, а не итоговая оценка сотрудника.</b>'
      '<div class="small" style="margin-top:6px">Формулировка Кости из разборов июня 2026. '
      'Разбор построен на переписке в CRM. Он не видит звонков и не измеряет вашу выручку.</div></div>')

    # 2. Не ваша зона (ВЫШЕ личных претензий)
    a('<h2>Не ваша зона</h2>')
    a('<div class="card sys"><div class="small" style="margin-bottom:8px">Это чинит РОП и интегратор Bitrix24. '
      'Показываем сначала, чтобы вы видели, что вам не вменяют чужое.</div><ul class="small">')
    for s in SYSTEMIC:
        a(f'<li>{esc(s)}</li>')
    a('</ul></div>')

    # 3. Деньги на столе
    deals = pm.get("deals", [])
    risky = [d for d in deals if d.get("unanswered") or (d.get("maxReply") or 0) > 480]
    risky = sorted(risky, key=lambda d: -d["amount"])[:8]
    a('<h2>Деньги на столе</h2>')
    if risky:
        a(f'<div class="small">Сделок с оборванным диалогом или очень долгим ответом: {len(risky)} '
          f'на {money(sum(d["amount"] for d in risky))}.</div>')
        a('<div class="scroll" style="margin-top:8px"><table><thead><tr><th>Сделка</th><th class="num">Сумма</th>'
          '<th>Стадия</th><th>Что не так</th></tr></thead><tbody>')
        for d in risky:
            what = "диалог оборван на клиенте" if d.get("unanswered") else f"ответ занимал до {mins(d.get('maxReply'))}"
            a(f'<tr><td><a href="{PORTAL.format(d["id"])}" target="_blank">{esc(d["id"])}</a></td>'
              f'<td class="num">{money(d["amount"])}</td><td>{esc(d["stage"])}</td><td>{esc(what)}</td></tr>')
        a('</tbody></table></div>')
        if risky and risky[0].get("unansweredText"):
            a(f'<div class="q was"><b>Сделка {esc(risky[0]["id"])}, последнее слово клиента:</b><br>'
              f'{esc(risky[0]["unansweredText"])}</div>')
    else:
        a('<div class="card"><b>Ни одной сделки с оборванным диалогом.</b> Это хороший результат, '
          'по отделу таких сделок 30.</div>')

    # 4. Что получилось
    a('<h2>Что получилось</h2>')
    wins = pm.get("wins", [])
    good = []
    if r.get("medianMin") is not None and r["medianMin"] <= 20:
        good.append(f'Медиана ответа клиенту {mins(r["medianMin"])}. По отделу 13 минут, вы в числе быстрых.')
    if r.get("within60") and r["within60"] >= 0.7:
        good.append(f'{r["within60"]*100:.0f}% ответов быстрее часа.')
    if (m.get("greetShare") or 0) >= 0.85:
        good.append(f'Приветствие в первом сообщении дня: {m["greetShare"]*100:.0f}%.')
    if (m.get("concreteTimeShare") or 0) >= 0.12:
        good.append(f'Конкретный срок в {m["concreteTimeShare"]*100:.0f}% обещаний. '
                    f'По отделу 6%, это лучший показатель в команде.')
    if (m.get("initiatedShare") or 0) >= 0.65:
        good.append(f'{m["initiatedShare"]*100:.0f}% диалогов начинаете сами, не ждёте клиента.')
    if not good:
        good.append('Объём работы: '
                    f'{m["out"]} исходящих сообщений по {m["deals"]} сделкам за период.')
    a('<div class="card win"><ul>')
    for g in good:
        a(f'<li>{esc(g)}</li>')
    a('</ul>')
    for w in wins[:2]:
        a(f'<div class="q now"><b>{esc(w["label"])}</b>, сделка '
          f'<a href="{PORTAL.format(w["deal"])}" target="_blank">{esc(w["deal"])}</a><br>{esc(w["text"][:200])}</div>')
    a('</div>')

    # 5. Одна задача на 14 дней
    key, val, unit = pick_task(m, kk)
    title, trigger, steps, phrase, metric = TASK_LIB[key]
    a('<h2>Моя задача на 14 дней</h2>')
    a(f'<div class="card task"><div style="font-size:18px;font-weight:600">{esc(title)}</div>')
    a(f'<h3>Когда срабатывает</h3><div>{esc(trigger)}</div>')
    a('<h3>Что я делаю</h3><ul>')
    for s in steps:
        a(f'<li>{esc(s)}</li>')
    a('</ul>')
    if phrase:
        a(f'<h3>Готовая фраза</h3><div class="q now" id="ph">{esc(phrase)}</div>'
          '<button class="copy" onclick="navigator.clipboard.writeText(document.getElementById(\'ph\').innerText)">'
          'скопировать</button>')
    a(f'<h3>Почему именно это</h3><div class="small">Ваша цифра за {esc(period["from"])} - {esc(period["to"])}: '
      f'<b>{esc(val)}</b> {esc(unit)}.</div>')
    a(f'<h3>Как проверим 24 августа</h3><div class="small">Метрика: {esc(metric)}. '
      f'Считает: скрипт Kostya-AI. Целевое значение назначает РОП вместе с вами, '
      f'оно пока не откалибровано и помечено как гипотеза.</div>')
    a('</div>')

    # 6. Три норматива
    a('<h2>Три норматива</h2><div class="kpi">')
    a(f'<div><div class="v">{mins(r.get("medianMin"))}</div><div class="l">медиана ответа, отдел 13 мин</div></div>')
    a(f'<div><div class="v" style="color:var(--bad)">{mins(r.get("p90Min"))}</div>'
      f'<div class="l">p90, каждый десятый ждёт столько</div></div>')
    a(f'<div><div class="v">{m["unansweredCount"]}</div><div class="l">диалогов оборвано на клиенте</div></div>')
    cts = m.get("concreteTimeShare")
    a(f'<div><div class="v">{"нет данных" if cts is None else f"{cts*100:.0f}%"}</div>'
      f'<div class="l">обещаний с конкретным сроком, отдел 6%</div></div>')
    a('</div>')

    # 7. Квалификация
    od = m.get("outDet") or {}
    a('<h2>Квалификация клиента</h2>')
    a('<div class="kpi">')
    for code, label in [("Q_БЮДЖЕТ", "спросили про бюджет"), ("Q_СРОК", "спросили про срок"),
                        ("Q_ЛПР", "спросили, кто решает")]:
        a(f'<div><div class="v">{od.get(code, 0)}</div><div class="l">{label}, раз за период</div></div>')
    a('</div>')
    a('<div class="card"><div class="small">По отделу вопрос про бюджет встречается в 0.11% исходящих, '
      'про ЛПР в 0.02%. Это общий провал команды, а не ваш личный. Готовые формулировки, '
      'они разные для дизайнера и для физлица:</div>')
    a('<div class="q now"><b>Дизайнеру:</b> В каком уровне идёт остальная комплектация проекта? '
      'Чтобы я сразу считал в одном классе с тем, что вы уже подобрали.</div>')
    a('<div class="q now"><b>Физлицу:</b> Скажу честно, чтобы не гонять вас по вариантам. '
      'По такому изделию есть решения разного уровня, разница в стекле и фурнитуре. '
      'На какую сторону ориентируемся?</div>')
    a('<div class="q now"><b>Про ЛПР:</b> Когда планируете выносить спецификацию заказчику? '
      'Подготовлю материалы сразу в виде, удобном для показа.</div></div>')

    # 8. Разбор двух диалогов
    inst = [i for i in pm.get("instances", []) if i["code"] not in NOT_PERSONAL]
    a('<h2>Разбор двух реплик</h2>')
    if inst:
        for i in inst[:2]:
            nm, fix = DEFECT_FIX.get(i["code"], (i["code"], ""))
            a(f'<div class="card"><div class="small">Сделка '
              f'<a href="{PORTAL.format(i["deal"])}" target="_blank">{esc(i["deal"])}</a>'
              f'{" · " + money(i["amount"]) if i.get("amount") else ""} · {esc(i["at"][:10])} · {esc(nm)}</div>')
            a(f'<div class="q was"><b>Что я написал</b><br>{esc(i["text"][:230])}</div>')
            a(f'<div class="q now"><b>Как надо было</b><br>{esc(fix)}</div></div>')
    else:
        a('<div class="card">Повторяющихся дефектов в тексте не найдено.</div>')

    # 9. Таблица сделок
    a('<h2>Все сделки в переписке</h2>')
    a('<div class="scroll"><table><thead><tr><th>Сделка</th><th class="num">Сумма</th><th>Стадия</th>'
      '<th class="num">Сообщ.</th><th class="num">Дней</th><th>Последнее слово</th></tr></thead><tbody>')
    for d in deals[:40]:
        last = ('<span class="tag bad">за клиентом</span>' if d.get("unanswered")
                else '<span class="tag ok">за нами</span>')
        a(f'<tr><td><a href="{PORTAL.format(d["id"])}" target="_blank">{esc(d["id"])}</a></td>'
          f'<td class="num">{money(d["amount"])}</td><td>{esc(d["stage"])}</td>'
          f'<td class="num">{d["n"]}</td><td class="num">{d["days"]}</td><td>{last}</td></tr>')
    a('</tbody></table></div>')
    if len(deals) > 40:
        a(f'<div class="small">Показаны 40 из {len(deals)} по убыванию суммы.</div>')

    # 10. Флаги дисциплины из Bitrix
    if kk:
        a('<h2>Дисциплина по открытым сделкам</h2><div class="kpi">')
        a(f'<div><div class="v">{kk["openDeals"]}</div><div class="l">открытых сделок на {money(kk["openBudget"])}</div></div>')
        a(f'<div><div class="v">{kk["stuckDeals"]}</div><div class="l">зависли на стадии дольше лимита</div></div>')
        a(f'<div><div class="v">{kk["overdueTasks"]}</div><div class="l">просроченных дел</div></div>')
        a(f'<div><div class="v">{kk["noNextStep"]}</div><div class="l">без запланированного шага</div></div>')
        a('</div>')
        a('<div class="small">Индекс дисциплины считается по чистоте ведения CRM, а не по выручке. '
          'Пороги пока не откалиброваны и помечены как гипотеза.</div>')

    a('<footer>Kostya-AI. Разбор построен на выгрузке переписки Bitrix24 воронки C49 и снимке сделок. '
      'Не измеряет звонки и не измеряет продажи. Персональные оценки требуют апрува Ивана. '
      'Вопросы и несогласие с флагом: РОП.</footer>')
    # Сортировка по клику на заголовок. Решение Ивана от 2026-08-08, вопрос 5:
    # таблица сделок читается по одному столбцу, а не скопом.
    a("""<script>
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
    const t = (r.cells[col] ? r.cells[col].innerText : '').trim();
    const n = parseFloat(t.replace(/\\s/g, '').replace(',', '.').replace(/[^\\d.\\-]/g, ''));
    return Number.isNaN(n) || !/\\d/.test(t) ? null : n;
  };
  const rows = [...tb.rows], numeric = rows.every(r => val(r) !== null);
  rows.sort((a, b) => numeric ? (val(a) - val(b)) * dir
    : (a.cells[col] ? a.cells[col].innerText : '').localeCompare(b.cells[col] ? b.cells[col].innerText : '', 'ru') * dir);
  tb.append(...rows);
});
document.querySelectorAll('thead th').forEach(th => { th.style.cursor = 'pointer'; th.title = 'Клик, сортировка'; });
</script>""")
    a('</div></body></html>')
    return "\n".join(L)


def main(analysis_path, per_manager_path, out_dir, kostya_path=None):
    A = json.load(open(analysis_path, encoding="utf-8"))
    PM = json.load(open(per_manager_path, encoding="utf-8"))["managers"]
    K = json.load(open(kostya_path, encoding="utf-8")) if kostya_path else None
    kk_by_key = {name_key(x["mgr"]): x for x in K["managers"]} if K else {}

    os.makedirs(out_dir, exist_ok=True)
    period = A["meta"]["period"]
    made = []
    for m in A["managers"]:
        if m["out"] < 25:
            continue
        pm = PM.get(m["mgr"], {})
        kk = kk_by_key.get(name_key(m["mgr"]))
        sl = slug(m["mgr"])
        path = os.path.join(out_dir, f"{sl}.html")
        open(path, "w", encoding="utf-8").write(render(m, pm, kk, A["meta"], period))
        made.append({"mgr": m["mgr"], "slug": sl, "file": f"{sl}.html",
                     "deals": m["deals"], "joined": kk is not None})
        print(f"  {m['mgr']:22} -> {sl}.html   (слой A {'сведён' if kk else 'НЕ сведён'})")

    manifest = {"bakedAt": datetime.now().isoformat(), "period": period,
                "source": os.path.basename(analysis_path), "pages": made}
    json.dump(manifest, open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"\nстраниц: {len(made)}, папка: {out_dir}")
    print("Файлы НЕ коммитятся: репозиторий публичный, внутри цитаты клиентской переписки.")


if __name__ == "__main__":
    main(*sys.argv[1:5])
