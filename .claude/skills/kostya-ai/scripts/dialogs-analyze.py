#!/usr/bin/env python3
"""msgs.jsonl -> analysis.json: атомарный разбор коммуникации по каждому менеджеру.

Считает то, чего не было в rop.json: скорость ответа на клиента, кто тащит диалог,
текстовые дефекты по каталогу Кости (T01-T09), неотвеченные сообщения.
"""
import json, re, sys, statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta

WORK_START, WORK_END = 9, 19          # рабочее окно МСК, [ГИПОТЕЗА - калибровка]
UNANSWERED_H = 24                      # порог «оставлено без ответа», рабочие часы

# --- Текстовые детекторы (каталог Кости, слой B) ---
DET = {
    "T03_РАЗМЫТЫЙ_СРОК": re.compile(
        r"(в\s+ближайш|в\s+скором\s+времени|постара\w+|как\s+только\s+(?:смогу|получ|будет)"
        r"|чуть\s+позже|на\s?сколько\s+это\s+возможно|как\s+будет\s+готов|думаю[, ]+(?:после|что успе)"
        r"|надеюсь\s+(?:успе|завтра)|попозже|в\s+течени[еи]\s+дня)", re.I),
    "T04_ЖАРГОН": re.compile(r"(закрут\w*ся|забыл\w*ся|замотал\w*ся|запар\w+|проворонил|проспал)", re.I),
    "T09_ШТАМП": re.compile(
        r"(длительное\s+ожидание|судьб\w+\s+рассмотрен|в\s+рамках\s+данного\s+вопроса"
        r"|осуществл\w+\s+отправк|имеет\s+место\s+быть)", re.I),
    "T07_ОРФОГРАФИЯ": re.compile(r"(\s+[,.;:!?]|[а-яё][.!?][А-ЯЁ][а-яё]|\?\?+|!!+)"),
    "T06_ЗАЩИТА": re.compile(r"(вы\s+не\s+указал|вы\s+же\s+сами|я\s+вам\s+говорил\w*|это\s+не\s+наша\s+вина)", re.I),
}
# --- Детекторы во ВХОДЯЩИХ сообщениях клиента ---
IN_DET = {
    "OBJ_ЦЕНА": re.compile(r"(дорог\w+|дороже|дешевл\w+|не проход\w+ по цен|высок\w+ цен|бюджет не)", re.I),
    "OBJ_КОНКУРЕНТ": re.compile(r"(у конкурент|в друг\w+ компани|нашли дешевл|другое предложени|другой поставщик)", re.I),
    "OBJ_ПОДУМАЮ": re.compile(r"(подума\w+|обсуд\w+ с|посоветуюсь|вернусь позже|надо посоветова)", re.I),
    "OBJ_СРОКИ": re.compile(r"(долго ждать|срок\w* не устраива|нужно быстрее|слишком долго)", re.I),
    "ESC_РУКОВОДИТЕЛЬ": re.compile(r"(тел\w*\s+руководител|контакт\w*\s+вашего руководител|дайте.{0,20}директор|номер директор)", re.I),
    "ESC_НЕДОВОЛЬСТВО": re.compile(r"(жалоб\w+|претензи\w+|сколько можно|верните деньги|это безобрази|сомнева\w+ в продолжении|никто.{0,15}не перезвонил)", re.I),
}
# --- Детекторы в ИСХОДЯЩИХ: квалификация и техника продаж ---
OUT_DET = {
    "Q_БЮДЖЕТ": re.compile(r"(какой бюджет|на какую сумму|в какой бюджет|ориентир по бюджет|рассматриваете сумм)", re.I),
    "Q_СРОК": re.compile(r"(когда планируете|к какому сроку|когда нужн\w+ готов|сроки реализац)", re.I),
    "Q_ЛПР": re.compile(r"(кто принимает решени|с кем согласов|кто утвержда)", re.I),
    "S_ДОЖИМ": re.compile(r"(напомина\w+ о себе|подскажите.{0,25}актуальн|какое решени|удалось ознаком|есть ли новост|не потеряли)", re.I),
    "S_СКИДКА": re.compile(r"(скидк\w+|специальн\w+ услови|можем уступ|снизить цен)", re.I),
    "S_ЛИДМАГНИТ": re.compile(r"(презентац\w+|каталог|видео о|наш сайт|шоу-?рум|шоурум|образц\w+|портфоли|кейс)", re.I),
}

GREET = re.compile(r"(добр\w+\s+(?:день|утро|вечер)|здравствуйте|приветству)", re.I)
# Фильтры метрики «оставлено без ответа»: закрытая сделка и вежливое закрытие диалога
# не являются виной менеджера.
CLOSED_STAGE = re.compile(r"сделка\s+(успешна|провалена)", re.I)
TRIVIAL_CLOSER = re.compile(
    r"^(спасибо|поняла|понял|хорошо|ок|окей|да|нет|принято|ясно|благодарю|отлично|супер"
    r"|договорились|до свидания|всего доброго)[\s\.,!)]*$", re.I)
# Обещание - это будущее время первого лица («отправлю», «вернусь»), а не настоящее
# («отправляю КП»): второе описывает действие, которое уже происходит, и срока не требует.
PROMISE = re.compile(
    r"\b(отправлю|пришлю|вернусь|уточню|перезвоню|позвоню|подготовлю|посчитаю|сообщу|напишу"
    r"|отвечу|скину|направлю|предоставлю|согласую|проверю|запрошу|сделаю|передам|выставлю"
    r"|будет\s+готов\w*|сможем\s+отгрузить|отгрузим|привезём|привезем)\b", re.I)
CONCRETE_TIME = re.compile(
    r"(\bдо\s+\d{1,2}[:.]\d{2}|\bк\s+\d{1,2}[:.]\d{2}|\b\d{1,2}[:.]\d{2}\b"
    r"|\b\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\w*"
    r"|\b\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\b|завтра\s+до|сегодня\s+до"
    r"|\b(?:понедельник|вторник|сред[ыуа]|четверг|пятниц[ыуа])\w*)", re.I)

def bmin(a: datetime, b: datetime) -> int:
    """Рабочие минуты между a и b (пн-пт, WORK_START..WORK_END)."""
    if b <= a:
        return 0
    total, cur = 0, a
    while cur.date() < b.date() or (cur.date() == b.date() and cur < b):
        d0 = cur.replace(hour=WORK_START, minute=0, second=0, microsecond=0)
        d1 = cur.replace(hour=WORK_END, minute=0, second=0, microsecond=0)
        if cur.weekday() < 5:
            s, e = max(cur, d0), min(b, d1)
            if e > s:
                total += int((e - s).total_seconds() // 60)
        nxt = (cur + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        cur = nxt
        if cur > b:
            break
    return total

def pct(vals, q):
    if not vals:
        return None
    v = sorted(vals)
    return v[min(len(v) - 1, int(len(v) * q))]

def main(src, dst):
    M = [json.loads(l) for l in open(src, encoding='utf-8')]
    for m in M:
        m['dt'] = datetime.fromisoformat(m['ts']) if m['ts'] else None

    msgs = [m for m in M if m['kind'] == 'msg' and m['dt']]
    byDeal = defaultdict(list)
    for m in msgs:
        byDeal[m['dealId']].append(m)
    for v in byDeal.values():
        v.sort(key=lambda x: x['dt'])

    mgr = defaultdict(lambda: {
        "out": 0, "in": 0, "unknown": 0, "deals": set(), "amount": 0.0,
        "replyMin": [], "unanswered": [], "initiated": 0, "dialogs": 0,
        "defects": Counter(), "outChars": [], "greetFirst": 0, "firstOfDay": 0,
        "concreteTime": 0, "promises": 0, "attachOnly": 0, "outText": 0, "byHour": Counter(),
        "byWeekday": Counter(), "worstReplies": [],
        "inDet": Counter(), "outDet": Counter(), "escalations": [], "priceObj": [],
    })

    for dealId, seq in byDeal.items():
        owner = seq[0]['mgr']
        S = mgr[owner]
        S['deals'].add(dealId)
        S['amount'] = max(S['amount'], seq[0]['amount'])
        S['dialogs'] += 1
        firstReal = next((m for m in seq if m['direction'] in ('in', 'out') and not m['sysmsg']), None)
        if firstReal and firstReal['direction'] == 'out':
            S['initiated'] += 1

        pendingIn = None
        seenDays = set()
        for m in seq:
            if m['sysmsg']:
                continue
            d = m['direction']
            if d == 'unknown':
                S['unknown'] += 1
                continue
            if d == 'in':
                S['in'] += 1
                for nm, rx in IN_DET.items():
                    if rx.search(m['text']):
                        S['inDet'][nm] += 1
                        if nm.startswith('ESC_'):
                            S['escalations'].append({"deal": dealId, "at": m['ts'], "kind": nm,
                                                     "text": m['text'][:200], "stage": m['stage'],
                                                     "amount": m['amount']})
                        if nm == 'OBJ_ЦЕНА':
                            S['priceObj'].append({"deal": dealId, "at": m['ts'],
                                                  "text": m['text'][:200], "amount": m['amount']})
                if pendingIn is None:
                    pendingIn = m
            else:
                S['out'] += 1
                S['byHour'][m['dt'].hour] += 1
                S['byWeekday'][m['dt'].weekday()] += 1
                txt = m['text']
                if m['attach'] == 'sent':
                    S['attachOnly'] += 1
                else:
                    S['outText'] += 1      # знаменатель текстовых метрик, без вложений
                    S['outChars'].append(len(txt))
                    for name, rx in DET.items():
                        if rx.search(txt):
                            S['defects'][name] += 1
                    for name, rx in OUT_DET.items():
                        if rx.search(txt):
                            S['outDet'][name] += 1
                    # T02: первое исходящее в дне без приветствия и без имени
                    day = m['dt'].date()
                    if day not in seenDays:
                        seenDays.add(day)
                        S['firstOfDay'] += 1
                        if GREET.search(txt[:80]):
                            S['greetFirst'] += 1
                        else:
                            S['defects']['T02_БЕЗ_ПРИВЕТСТВИЯ'] += 1
                    # Обещание с конкретным сроком vs размытое
                    if PROMISE.search(txt):
                        S['promises'] += 1
                        if CONCRETE_TIME.search(txt):
                            S['concreteTime'] += 1
                        else:
                            S['defects']['T03_ОБЕЩАНИЕ_БЕЗ_СРОКА'] += 1
                    if len(txt) < 25 and not GREET.search(txt):
                        S['defects']['T01_БЕЗ_ПОЯСНЕНИЯ'] += 1
                if pendingIn is not None:
                    rm = bmin(pendingIn['dt'], m['dt'])
                    S['replyMin'].append(rm)
                    if rm > 240:
                        S['worstReplies'].append({
                            "deal": dealId, "minutes": rm,
                            "clientAt": pendingIn['ts'], "answeredAt": m['ts'],
                            "clientText": pendingIn['text'][:180],
                            "reply": txt[:180], "stage": m['stage'], "amount": m['amount'],
                        })
                    pendingIn = None
        # «Оставлено без ответа» засчитывается только если реплика клиента действительно
        # требовала ответа. Без фильтров метрика завышена в 5.7 раза (171 против 38 на
        # выгрузке апрель-июль): 83 случая приходятся на уже закрытые сделки, где диалог
        # заканчивается законно, 12 на «Спасибо» и «Поняла», 10 на голое вложение.
        # Обвинить менеджера в том, что он не ответил на «Хорошо» по выигранной сделке,
        # значит получить справедливое возражение и обесценить весь инструмент.
        if pendingIn is not None and pendingIn is seq[-1]:
            t = (pendingIn['text'] or '').strip()
            if not CLOSED_STAGE.search(pendingIn['stage'] or '') \
                    and pendingIn['attach'] != 'received' \
                    and not TRIVIAL_CLOSER.match(t[:40]) \
                    and len(t) >= 25:
                S['unanswered'].append({
                    "deal": dealId, "clientAt": pendingIn['ts'],
                    "clientText": t[:180], "stage": pendingIn['stage'],
                    "amount": pendingIn['amount'],
                    "silentMinutes": 0,
                })

    res = []
    for name, S in mgr.items():
        rep = S['replyMin']
        # Знаменатель текстовых метрик - только сообщения с текстом. Вложения без текста
        # (25% исходящих) исключены из детекции, оставлять их в знаменателе значит занижать
        # все доли на четверть.
        outTotal = S['outText'] or 1
        res.append({
            "mgr": name,
            "deals": len(S['deals']), "dialogs": S['dialogs'],
            "out": S['out'], "in": S['in'], "unknown": S['unknown'],
            "attachOnly": S['attachOnly'],
            "initiatedShare": round(S['initiated'] / max(1, S['dialogs']), 3),
            "reply": {
                "n": len(rep),
                "medianMin": statistics.median(rep) if rep else None,
                "p75Min": pct(rep, .75), "p90Min": pct(rep, .90),
                "within60": round(sum(1 for x in rep if x <= 60) / len(rep), 3) if rep else None,
                "over240": round(sum(1 for x in rep if x > 240) / len(rep), 3) if rep else None,
            },
            "unansweredCount": len(S['unanswered']),
            "unanswered": sorted(S['unanswered'], key=lambda x: -x['amount'])[:10],
            "worstReplies": sorted(S['worstReplies'], key=lambda x: -x['minutes'])[:10],
            "avgOutChars": round(statistics.mean(S['outChars'])) if S['outChars'] else None,
            "promises": S['promises'],
            "concreteTimeShare": round(S['concreteTime'] / S['promises'], 3) if S['promises'] else None,
            "greetShare": round(S['greetFirst'] / S['firstOfDay'], 3) if S['firstOfDay'] else None,
            "defects": dict(S['defects']),
            "defectsPer100Out": {k: round(v * 100 / outTotal, 1) for k, v in S['defects'].items()},
            "inDet": dict(S['inDet']), "outDet": dict(S['outDet']),
            "escalations": sorted(S['escalations'], key=lambda x: -x['amount'])[:10],
            "escalationCount": len(S['escalations']),
            "priceObjCount": len(S['priceObj']),
            "priceObjections": sorted(S['priceObj'], key=lambda x: -x['amount'])[:10],
            "outText": S['outText'],
            "qualifyRate": round(sum(S['outDet'][k] for k in ('Q_БЮДЖЕТ', 'Q_СРОК', 'Q_ЛПР'))
                                 * 100 / max(1, S['outText']), 2),
            "qualifiedDealShare": None,   # см. ТЗ: правильная метрика - доля сделок, а не сообщений
            "byHour": dict(sorted(S['byHour'].items())),
            "byWeekday": dict(sorted(S['byWeekday'].items())),
        })
    res.sort(key=lambda x: -x['out'])

    allrep = [x for m in mgr.values() for x in m['replyMin']]
    out = {
        "meta": {
            "source": src,
            "generated_at": datetime.now().isoformat(),
            "period": {
                "from": min(m['date'] for m in msgs), "to": max(m['date'] for m in msgs),
            },
            "workHours": [WORK_START, WORK_END],
            "caveats": [
                "Время ответа считается в рабочих минутах (пн-пт, 9:00-19:00). Окно - [ГИПОТЕЗА - калибровка].",
                "2985 сообщений от отправителя «Телефон» исключены из метрик направления: "
                "служебная подпись Wazzup для контакта без имени, содержит реплики обеих сторон.",
                "Текстовые детекторы работают на регулярках. T05, T06, T08 требуют понимания контекста "
                "и здесь покрыты частично.",
                "Выгрузка односторонняя по колонке «Кто написал» (37008 из 37095 помечены «Менеджер»); "
                "реальный автор восстановлен из подписи Wazzup внутри текста.",
            ],
        },
        "totals": {
            "messages": len(msgs), "deals": len(byDeal),
            "out": sum(m['out'] for m in mgr.values()),
            "in": sum(m['in'] for m in mgr.values()),
            "unknown": sum(m['unknown'] for m in mgr.values()),
            "replyMedianMin": statistics.median(allrep) if allrep else None,
            "replyP90Min": pct(allrep, .90),
        },
        "managers": res,
    }
    json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"менеджеров: {len(res)}, сделок: {len(byDeal)}, ответов измерено: {len(allrep)}")

main(sys.argv[1], sys.argv[2])
