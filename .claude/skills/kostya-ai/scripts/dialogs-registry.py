#!/usr/bin/env python3
"""msgs.jsonl -> registry.json + registry-counts.json: реестр замечаний с доказательствами.

Отличие от dialogs-cases.py: тот отбирает 8-15 показательных кейсов на человека,
а реестр отвечает на другой вопрос - «докажи». Каждое утверждение методики
(«обещание без даты», «жаргон в ответе клиенту») получает счётчик и выборку
конкретных сделок, по которым оно посчитано: номер сделки, дата, цитаты и
вердикт AI-Кости - что в реплике было хорошо, что плохо, как надо было.

Два выхода, два контура:
  registry.json        - полный, с цитатами и именами. Только в запечатанные
                         разделы (сводка РОПа, кабинеты). НЕ КОММИТИТЬ.
  registry-counts.json - только коды, заголовки и числа. Идёт в репозиторий,
                         библиотека показывает счётчики без единой сделки.

Счётчики считаются так же, как в dialogs-cases.py (до дедупликации пар), чтобы
число в реестре сходилось с числом в сводке кабинета. Выборка доказательств
дедуплицирована и ограничена EVIDENCE_CAP на менеджера и код: реестр читают,
а не листают.

Запуск:
  python3 dialogs-registry.py msgs.jsonl registry.json registry-counts.json [--min-out 25]
"""
import importlib.util
import json, os, re, sys
from collections import Counter, defaultdict
from datetime import datetime

_here = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("dcases", os.path.join(_here, "dialogs-cases.py"))
dc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(dc)

EVIDENCE_CAP = 8

# Диагноз на код: «что плохо» в вердикте AI-Кости. Формулировки короткие и про
# конкретный механизм вреда, а не про оценку человека.
DIAG = {
    "ESC_БЕЗ_ИЗВИНЕНИЯ": "Клиент пришёл с претензией, а в ответе нет ни извинения, ни признания проблемы. Разговор сразу идёт на эскалацию.",
    "PRICE_КАПИТУЛЯЦИЯ": "На «дорого» менеджер согласился и закрыл разговор: ни уточняющего вопроса, ни альтернативы. Сделка отпущена без борьбы.",
    "IGNOR_ВОПРОСА": "Диалог оборвался на вопросе клиента: ответа не последовало вовсе.",
    "SLOW_ОТВЕТ": "Содержательный вопрос клиента ждал ответа дольше рабочего дня.",
    "T06_ЗАЩИТА": "Вместо извинения - перекладывание: «вы не указали», «я же говорила». Клиент читает это как отказ отвечать за результат.",
    "T04_ЖАРГОН": "«Закрутился», «забылся» в ответе клиенту. Клиент слышит: у менеджера бардак, за заказом надо следить самому.",
    "T03_ОБЕЩАНИЕ_БЕЗ_СРОКА": "Обещание есть, даты нет. Проверить исполнение невозможно, клиент напоминает сам.",
    "T01_ПУСТОЕ_ВЛОЖЕНИЕ": "Файл ушёл без единой строки текста. Клиент сам догадывается, что это и что с этим делать.",
    "T05_БЕЗ_КОНТЕКСТА": "Возврат после долгой паузы без напоминания, кто пишет и о чём договаривались.",
    "T03_РАЗМЫТЫЙ_СРОК": "«В ближайшее время» вместо даты: срок нельзя ни проверить, ни спланировать.",
    "T09_ШТАМП": "Канцелярский штамп вместо живой речи. Читается как отписка колл-центра.",
    "T02_БЕЗ_ПРИВЕТСТВИЯ": "Первое сообщение дня без приветствия и обращения.",
    "ESC_ВОСКЛИЦАНИЕ": "Восклицательные знаки в ответе на претензию. В переписке они читаются как повышенный голос.",
}

# Дополнительный код реестра: детектор живёт здесь, а не в dialogs-cases.py,
# потому что как «кейс с заменой» он неинтересен (замена - убрать знак), а как
# пункт реестра «вычеркнуть из речи» обязан иметь счётчик и доказательства.
EXTRA = {
    "ESC_ВОСКЛИЦАНИЕ": ("Восклицательные знаки в ответ на претензию", 0,
        "Приношу извинения. Разбираюсь с ситуацией и вернусь сегодня до 17:00 с конкретным решением."),
}

STRONG_DIAG = ""  # у сильных кейсов графы «что плохо» нет


def kostya_well(mtext, ctext, answered, code=""):
    """«Что хорошо» по фактическим признакам реплики, без сочинительства.

    На вход подаётся текст БЕЗ служебной шапки вложения: «Отправлено Файл» это
    не реплика, и хвалить пустое сообщение за скорость нельзя. Пустой текст
    возвращает пустую строку - графа «Хорошо» в этом случае не рендерится.
    """
    mtext = dc.ATTACH_PREFIX.sub("", (mtext or "").strip()).strip()
    if not mtext:
        return ""
    pts = []
    if dc.GREET.search(mtext[:80]) or dc.NAME_ADDRESS.match(mtext):
        pts.append("есть приветствие или обращение по имени")
    if dc.APOLOGY.search(mtext):
        pts.append("есть извинение")
    # У дефектов «обещание без срока» и «размытый срок» пункт про конкретный
    # срок противоречил бы самому дефекту: CONCRETE ловит и прошедшие даты.
    if code not in ("T03_ОБЕЩАНИЕ_БЕЗ_СРОКА", "T03_РАЗМЫТЫЙ_СРОК") and dc.CONCRETE.search(mtext):
        pts.append("назван конкретный срок")
    if dc.ALTERNATIVE.search(mtext):
        pts.append("предложен вариант, а не отказ")
    if dc.QUALIFY.search(mtext):
        pts.append("задан квалифицирующий вопрос")
    elif "?" in mtext:
        pts.append("есть встречный вопрос клиенту")
    if answered is not None and answered <= 10:
        pts.append("ответ пришёл за минуты")
    if not pts:
        return "Опереться в этой реплике не на что: ни одного из опорных элементов (приветствие, извинение, срок, вариант, вопрос) в ней нет."
    return "В реплике " + ", ".join(pts) + "."


def main(src, dst_full, dst_counts, analysis_path=None, min_out=dc.MIN_OUT):
    # Окно периода берётся из analysis.json: на одной странице не может быть
    # двух разных периодов (подвал сводки против шапки реестра).
    p_from = p_to = None
    if analysis_path:
        pa = json.load(open(analysis_path, encoding="utf-8"))["meta"]["period"]
        p_from = datetime.strptime(pa["from"], "%d.%m.%Y")
        p_to = datetime.strptime(pa["to"], "%d.%m.%Y").replace(hour=23, minute=59, second=59)

    M = []
    for line in open(src, encoding="utf-8"):
        o = json.loads(line)
        if o["kind"] != "msg" or o["sysmsg"] or not o["ts"]:
            continue
        if o["direction"] not in ("in", "out"):
            continue
        o["dt"] = datetime.fromisoformat(o["ts"])
        if p_from is not None and not (p_from <= o["dt"] <= p_to):
            continue
        o["text"] = dc.norm(o["text"])
        M.append(o)
    dc.set_roster({o["mgr"] for o in M})

    by_deal = defaultdict(list)
    for m in M:
        by_deal[m["dealId"]].append(m)

    counts = defaultdict(Counter)                     # mgr -> code -> уникальных срабатываний
    pools = defaultdict(lambda: defaultdict(list))    # mgr -> code -> доказательства
    out_n = Counter()
    # Дедупликация ДО счётчика: 13.4% строк выгрузки - одна переписка под двумя
    # dealId, и счётчик без неё завышен (по пустым вложениям в разы, замер
    # ФЕНИКСА 10.08.2026). Ключ - время сообщения плюс головы цитат; у пустого
    # вложения текстов нет, хватает времени.
    seen_msgs = defaultdict(set)
    seen_pairs = defaultdict(set)

    def push(owner, deal, code, verdict, mmsg, cmsg):
        meta = dc.STRONG if verdict == "strong" else {**dc.DEFECTS, **EXTRA}
        title, _w, should = meta[code]
        ref = mmsg or cmsg
        cli = dc.clean(cmsg["text"]) if cmsg is not None else ""
        man = dc.clean(mmsg["text"]) if mmsg is not None else ""
        tkey = ((code, ref["ts"]) if code == "T01_ПУСТОЕ_ВЛОЖЕНИЕ"
                else (code, ref["ts"], cli[:60].lower(), man[:60].lower()))
        if tkey in seen_msgs[owner]:
            return
        seen_msgs[owner].add(tkey)
        counts[owner][code] += 1
        key = (code, cli[:60].lower(), man[:60].lower())
        if key in seen_pairs[owner]:
            return
        seen_pairs[owner].add(key)
        answered = dc.bmin(cmsg["dt"], mmsg["dt"]) if (cmsg is not None and mmsg is not None) else None
        raw_m = (mmsg["text"] or "") if mmsg is not None else ""
        raw_c = (cmsg["text"] or "") if cmsg is not None else ""
        if not man:
            man = ("[файл ушёл без единой строки текста]" if code == "T01_ПУСТОЕ_ВЛОЖЕНИЕ"
                   else "[ответа не последовало, диалог оборвался здесь]")
        if verdict == "strong":
            well, bad = should, STRONG_DIAG
            should_out = ""
        else:
            well = kostya_well(raw_m, raw_c, answered, code)
            bad = DIAG[code]
            should_out = should
        pools[owner][code].append({
            "deal": deal,
            "when": ref["dt"].strftime("%d.%m.%Y"),
            "stage": ref["stage"],
            "client": cli,
            "manager": man,
            "well": well,
            "bad": bad,
            "should": should_out,
            "_amount": ref.get("amount") or 0,
            "_haspair": 1 if cli else 0,
        })

    for deal, seq in by_deal.items():
        seq.sort(key=lambda x: x["dt"])
        owner = seq[0]["mgr"]
        out_n[owner] += sum(1 for m in seq if m["direction"] == "out")

        def add(code, verdict, mmsg, cmsg, _owner=owner, _deal=deal):
            push(_owner, _deal, code, verdict, mmsg, cmsg)

        dc.scan_deal(seq, add)

        # Второй проход: восклицательные знаки в ответ на претензию. Пара
        # «клиент -> ближайший ответ» строится так же, как в scan_deal.
        prev_in = None
        for m in seq:
            if m["direction"] == "in":
                if prev_in is None:
                    prev_in = m
                continue
            if m["direction"] != "out":
                continue
            txt = (m["text"] or "").strip()
            if (prev_in is not None and dc.LEGAL.search(prev_in["text"] or "")
                    and "!" in txt and dc.body_len(m) >= 15):
                push(owner, deal, "ESC_ВОСКЛИЦАНИЕ", "defect", m, prev_in)
            prev_in = None

    # Менеджеры с крошечной выборкой выпадают целиком, порог тот же, что всюду.
    keep = {m for m in counts if out_n[m] >= min_out}

    all_meta = {**dc.DEFECTS, **EXTRA, **dc.STRONG}
    claims = {}
    for code, (title, _w, should) in all_meta.items():
        kind = "strong" if code in dc.STRONG else "defect"
        by_mgr = {}
        for mgr in sorted(keep):
            n = counts[mgr].get(code, 0)
            if not n:
                continue
            ev = pools[mgr].get(code, [])
            ev.sort(key=lambda x: (-x["_haspair"], -x["_amount"], x["when"]))
            ev = ev[:EVIDENCE_CAP]
            for e in ev:
                e.pop("_amount", None); e.pop("_haspair", None)
            by_mgr[mgr] = {"n": n, "evidence": ev}
        total = sum(v["n"] for v in by_mgr.values())
        if not total:
            continue
        claims[code] = {
            "kind": kind,
            "title": title,
            "diag": DIAG.get(code, ""),
            "should": "" if kind == "strong" else should,
            "total": total,
            "byMgr": by_mgr,
        }

    if p_from is not None:
        period = f"{pa['from']} - {pa['to']}"
    else:
        period = (min(m["dt"] for m in M).strftime("%d.%m.%Y") + " - "
                  + max(m["dt"] for m in M).strftime("%d.%m.%Y"))
    n_codes = len({**dc.DEFECTS, **EXTRA})
    meta = {"source": src, "generated_at": datetime.now().isoformat(),
            "period": period, "minOut": min_out, "evidenceCap": EVIDENCE_CAP,
            "note": f"Выборка - до {EVIDENCE_CAP} сделок на менеджера и тип, сначала пары "
                    "с репликой клиента и большей суммой. Цитаты вычищены от контактов, "
                    "фамилий и адресов.",
            # Строка честности едет на страницы как есть: счётчики - детекторы,
            # не ручная проверка, и это обязано быть написано там, где по числам
            # разговаривают с людьми, а не только в публичной библиотеке.
            "hypothesis": "Счётчики дедуплицированы по времени и тексту сообщения. "
                          f"Вручную проверено детекторов: 0 из {n_codes}. Каждое срабатывание - "
                          "повод открыть сделку, а не установленный факт."}

    json.dump({"meta": meta, "claims": claims},
              open(dst_full, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # Публичный срез: ни сделок, ни цитат, ни имён - только числа. Нулевые коды
    # остаются в файле: «0 в переписке за период» - тоже утверждение, и честнее
    # показать его, чем молча спрятать пункт, пришедший из ручного разбора Кости.
    pub = {code: {"kind": ("strong" if code in dc.STRONG else "defect"),
                  "title": meta_t[0],
                  "total": claims.get(code, {}).get("total", 0)}
           for code, meta_t in all_meta.items()}
    json.dump({"meta": {"period": meta["period"], "generated_at": meta["generated_at"],
                        "note": "Только счётчики. Доказательная выборка сделок открывается "
                                "в личном кабинете и в сводке РОПа."},
               "claims": pub},
              open(dst_counts, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    for code, c in sorted(claims.items(), key=lambda x: -x[1]["total"]):
        ev = sum(len(v["evidence"]) for v in c["byMgr"].values())
        print(f"  {code:24} {c['total']:5}  доказательств {ev:3}  ({c['kind']})")
    print(f"кодов: {len(claims)}, период {meta['period']}")
    print(f"полный: {dst_full}\nпубличный: {dst_counts}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    mo = dc.MIN_OUT
    for a in sys.argv[1:]:
        if a.startswith("--min-out="):
            mo = int(a.split("=", 1)[1])
    main(args[0], args[1], args[2], args[3] if len(args) > 3 else None, mo)
