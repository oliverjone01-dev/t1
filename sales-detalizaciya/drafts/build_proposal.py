"""Демо-страница предложений для чистовика «Детализации»: воронка, матрица, ценовая лестница,
Парето потерь, динамика с перекрестием, возражение и ответ, приёмы, список на понедельник.

Страница локальная (drafts/predlozhenie.html в git не попадает): в ней ID чатов и обезличенные итоги.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import build_page_data as bpd  # noqa: E402

W8 = [f"2026-W{i}" for i in range(31, 39)]
CODE = {"OLD-B": "NEW-B", "OLD-G": "OLD-G"}  # коды в расшифровках старые, в отчёте NEW-B


def main():
    bpd.NAMES = bpd.collect_names()
    anon = bpd.anon
    labels = {x["id"]: x for x in map(json.loads, open(ROOT / "data/labels.jsonl"))}
    chats = json.loads((ROOT / "data/chats.json").read_text())
    weekly = json.loads((ROOT / "data/weekly.json").read_text())
    comments = json.loads((ROOT / "data/comments.json").read_text())
    techniques = json.loads((ROOT / "data/techniques.json").read_text())

    out = {"weeks": W8, "cabs": {}, "exported": "22.09.2026"}
    for code, acc in weekly["accounts"].items():
        rows = {w["week"]: w for w in acc["weeks"]}
        inbound = [r for r in chats[code] if r["origin"] == "inbound"]
        # воронка по неделям: обращение, вопрос по делу, размеры, телефон, макет или визит, договор
        fun = {}
        for w in W8 + ["all"]:
            rs = [r for r in inbound if (w == "all" and r["week"] in W8) or r["week"] == w]
            st = [labels[r["id"]]["stage"] for r in rs if r["id"] in labels]
            fun[w] = [len(rs)] + [sum(1 for s in st if s >= k) for k in (1, 2, 3, 4, 5)]
        series = []
        for w in W8:
            x = rows.get(w, {})
            n = x.get("inbound") or 0
            series.append({
                "w": w, "n": n,
                "lag": x.get("first_resp_work_bmin_med"), "fast": x.get("fast_pct"),
                "price": x.get("price_named_pct"), "fu": x.get("followup_pct"),
                "dz": round(100 * x["no_dozhim"] / n, 1) if n else None,
                "ph": x.get("contact_got_pct"), "mail": x.get("mailing_sent"), "mailr": x.get("mailing_replied"),
            })
        out["cabs"][code] = {"name": acc["avito_name"], "fun": fun, "series": series,
                             "cm": {w: comments.get(code, {}).get(w) for w in W8}}

    # Диалоги, которые остановились на стадии k (8 недель, оба кабинета)
    stage_lists = defaultdict(list)
    for code in chats:
        for r in chats[code]:
            x = labels.get(r["id"])
            if r["origin"] == "inbound" and r["week"] in W8 and x and x["segment"] != "non_client":
                stage_lists[x["stage"]].append({"id": r["id"], "c": code, "w": r["week"], "s": anon(x.get("summary")), "st": x["stage"],
                                                "lr": x.get("lost_reason")})
    out["stage_lists"] = {k: sorted(v, key=lambda d: d["w"], reverse=True)[:30] for k, v in stage_lists.items()}
    out["stage_reasons"] = {k: Counter(d["lr"] or "идёт" for d in v).most_common(4) for k, v in stage_lists.items()}

    # Первые 4 недели против последних 4: среднее, взвешенное по обращениям, оба кабинета
    halves = {}
    for f in ("fast", "dz", "ph", "fu", "price"):
        res = []
        for part in (W8[:4], W8[4:]):
            num = den = 0
            for code in out["cabs"]:
                for r in out["cabs"][code]["series"]:
                    if r["w"] in part and r[f] is not None and r["n"]:
                        num += r[f] * r["n"]; den += r["n"]
            res.append(round(num / den, 1) if den else None)
        halves[f] = res
    out["halves"] = halves

    # Ценовая лестница: самая крупная сумма, которую мы назвали в диалоге, и реакция клиента
    price_rx = re.compile(r"(\d{1,3}(?:[  ]?\d{3})+|\d{4,6})\s?(?:руб|р\.|₽|р\b)", re.I)
    ladder = defaultdict(Counter)
    checks, band_lists = [], defaultdict(list)
    wk_of = {r["id"]: (c, r["week"]) for c in chats for r in chats[c]}
    for f in ("OLD-B", "OLD-G"):
        for line in open(ROOT / f"data/transcripts/{f}.jsonl"):
            r = json.loads(line)
            x = labels.get(r["id"])
            if not x or x["price_reaction"] in ("not_applicable", "no_price_given"):
                continue
            ps = [int(re.sub(r"\D", "", m.group(1))) for ln in r["text"].split("\n") if " МЫ: " in ln for m in price_rx.finditer(ln)]
            ps = [p for p in ps if 5000 <= p <= 500000]
            if not ps:
                continue
            p = max(ps)
            b = 0 if p <= 25000 else 1 if p <= 60000 else 2 if p <= 120000 else 3
            pr = x["price_reaction"]
            checks.append(p)
            if pr == "silent" and r["id"] in wk_of:
                band_lists[b].append({"id": r["id"], "c": wk_of[r["id"]][0], "w": wk_of[r["id"]][1], "s": anon(x.get("summary")), "st": x["stage"], "p": p})
            ladder[b]["accepted" if pr == "accepted" else "silent" if pr == "silent" else "thinking" if pr == "thinking" else "other"] += 1
    out["ladder"] = [dict(ladder[b]) for b in range(4)]
    out["median_check"] = sorted(checks)[len(checks) // 2] if checks else None
    out["band_lists"] = [sorted(v, key=lambda d: d["w"], reverse=True)[:25] for v in (band_lists[b] for b in range(4))]

    # Парето потерь за 8 недель: почему диалог не дошёл до контакта (стадия меньше 3)
    reason_name = {"silent": "Пропал после нашего ответа", "not_now": "Не сейчас", "mismatch": "Нужно не то, что делаем",
                   "stone_not_included": "Нужен камень и установка", "no_followup": "Ждал от нас действия",
                   "competitor": "Ушёл к другим", "price": "Цена", "unknown": "Непонятно", "delivery": "Доставка",
                   "durability": "Не верит в срок службы"}
    lost = defaultdict(list)
    for code in chats:
        for r in chats[code]:
            x = labels.get(r["id"])
            if r["origin"] != "inbound" or r["week"] not in W8 or not x or x["stage"] >= 3 or x["segment"] == "non_client":
                continue
            if x.get("lost_reason"):
                lost[x["lost_reason"]].append({"id": r["id"], "c": code,
                                               "w": r["week"], "s": anon(x.get("summary")), "st": x["stage"]})
    out["pareto"] = sorted(([reason_name.get(k, k), k, len(v), sorted(v, key=lambda d: d["w"], reverse=True)[:25]]
                            for k, v in lost.items()), key=lambda t: -t[2])

    # Возражение и лучший ответ из диалогов, где клиент после возражения дошёл до контакта
    obj_name = {"think_consult": "Подумаю, посоветуюсь", "not_now": "Не сейчас", "product_mismatch": "Нужно не то, что делаем",
                "durability_doubt": "А не выцветет? Сколько простоит?", "stone_not_included": "Только стекло? А камень?",
                "expensive": "Дорого", "cheaper_elsewhere": "У других дешевле", "lead_time_long": "Долго делать",
                "far_delivery": "Далеко, боимся доставки", "prepayment": "100% предоплата"}
    fallback = {
        "think_consult": "Конечно, решение важное. Чтобы было что обсудить с родными, пришлю 3 фото готовых работ этого размера и расчёт. Куда удобнее: сюда или в MAX?",
        "not_now": "Понимаю. Цену можем зафиксировать сейчас, а изготовить к нужной дате: хранение готового изделия у нас бесплатно. К какому сроку планируете?",
        "product_mismatch": "Камень и установку делает партнёрская мастерская в вашем городе, мы их свяжем с вами. Стекло считаем мы: пришлите размер ниши или фото памятника.",
        "durability_doubt": "Изображение запекается в стекло при 600 градусах, это не плёнка и не краска. По договору гарантия 5 лет, работы с 2016 года стоят без претензий. Пришлю фото работ 2017 года.",
        "stone_not_included": "Мы делаем только стеклянную часть, зато её можно приклеить к уже стоящему камню или поставить в металлическую раму. Какой вариант ближе?",
        "expensive": "Давайте подберём под бюджет: толщина и вид стекла меняют цену почти вдвое. Какую сумму планируете?",
        "cheaper_elsewhere": "За эту цену обычно печать на плёнке в триплексе, она выгорает за 2-3 года. У нас керамика, запечённая в стекло. Пришлю сравнение на фото.",
        "lead_time_long": "Срок 30 дней от макета. Если нужно к дате, скажите к какой: поставим в приоритет.",
        "far_delivery": "Отправляем ПЭК со страховкой и обрешёткой, еженедельно в разные города. Стоимость доставки в ваш город около 3-4 тыс., посчитаю точно.",
        "prepayment": "Работаем по договору. Можно 70% предоплата и 30% перед отгрузкой, после фото готового изделия.",
    }
    obj_cnt, best = Counter(), {}
    for x in labels.values():
        for o in x.get("objections") or []:
            obj_cnt[o] += 1
            if x["stage"] >= 3 and x.get("success_modules") and o not in best:
                best[o] = anon(x["success_modules"][0]["manager"])[:260]
    out["objections"] = [{"k": k, "t": obj_name.get(k, k), "n": n, "best": best.get(k), "fb": fallback.get(k)}
                         for k, n in obj_cnt.most_common(6)]

    # Приёмы: три замерены по переписке, остальные пока без замера
    rates = {"Прямая просьба о номере без передачи другому человеку": (40, 70),
             "Номер в обмен на полезное": (16, 32)}
    out["tech"] = [dict(t, rate=rates.get(t["name"])) for t in techniques]
    out["tech_ref"] = {"name": "«Менеджер Вам перезвонит»", "rate": (59, 135)}

    # Список на понедельник: последние 2 недели, клиент продвинулся (размеры, телефон), а последнее слово наше или клиент ждёт
    todo = []
    for code in chats:
        for r in chats[code]:
            x = labels.get(r["id"])
            if r["week"] not in W8[-2:] + ["2026-W39"] or not x:
                continue
            why = ("клиент ждёт ответа" if r.get("left_hanging") else "оставил телефон, в чате тишина" if r.get("contact_waiting")
                   else "замолчал после цены" if r.get("no_dozhim_after_price") and x["stage"] >= 1
                   else "прислал размеры, дожима нет" if r.get("no_dozhim") and x["stage"] >= 2 else None)
            if why:
                todo.append({"id": r["id"], "c": code, "w": r["week"], "why": why, "st": x["stage"], "s": anon(x.get("summary"))})
    order = {"клиент ждёт ответа": 0, "оставил телефон, в чате тишина": 1, "прислал размеры, дожима нет": 2, "замолчал после цены": 3}
    out["todo"] = sorted(todo, key=lambda t: (order[t["why"]], t["w"]))
    for k, v in list(out["cabs"].items()):
        pass
    # переименование кабинета в выводе: в данных уже NEW-B
    txt = json.dumps(out, ensure_ascii=False)
    for bad in ("—", "–"):
        txt = txt.replace(bad, "-")

    html = (ROOT / "reference/razbor-nedeli-maket.html").read_text()
    head = html[: html.index("</head>")]
    head = head.replace("<title>Разбор недели · ОП ГМ</title>", "<title>Детализация 2.0</title>")
    # шаблон и выход можно задать: python3 drafts/build_proposal.py variants_body.html varianty.html
    body_name = sys.argv[1] if len(sys.argv) > 1 else "proposal_body.html"
    out_name = sys.argv[2] if len(sys.argv) > 2 else "predlozhenie.html"
    tpl = (ROOT / "drafts" / body_name).read_text()
    page = head + tpl.replace("/*__DATA__*/", "window.PV = " + txt.replace("</", "<\\/") + ";")
    (ROOT / "drafts" / out_name).write_text(page)
    print("drafts/" + out_name, round(len(page.encode()) / 1024), "KB; todo", len(out["todo"]), "pareto", [(p[0], p[2]) for p in out["pareto"]])


if __name__ == "__main__":
    main()
