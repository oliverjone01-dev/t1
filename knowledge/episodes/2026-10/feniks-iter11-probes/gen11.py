#!/usr/bin/env python3
"""FENIKS iter11: writes the JSON audit report (knowledge/episodes/2026-10/feniks-audit-ozon-report-cpo-iter11-20261015.json)."""
import datetime, json

OUT = "/home/user/t1/knowledge/episodes/2026-10/feniks-audit-ozon-report-cpo-iter11-20261015.json"
ts = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).isoformat(timespec="seconds")
ck = {
    "accuracy_1_figures_tagged": 2, "accuracy_2_sources_verifiable": 2, "accuracy_3_no_conflict_with_rag": 1,
    "accuracy_4_glossary_terminology": 2, "accuracy_5_brand_names_correct": 2,
    "actionability_6_owner_assigned": 2, "actionability_7_deadline_buffer": 1, "actionability_8_resources_listed": 2,
    "actionability_9_metric_concrete": 2, "actionability_10_milestone": 2,
    "insight_11_nontrivial": 2, "insight_12_second_order": 1, "insight_13_alternatives_analyzed": 2,
    "insight_14_anti_median": 2, "insight_15_cross_domain": 0,
    "brand_16_voice": 2, "brand_17_anti_slop": 2, "brand_18_no_em_dash": 2, "brand_19_output_routing": 2, "brand_20_tone_audience": 2,
    "risk_21_downside": 2, "risk_22_p9_hard_rules": 2, "risk_23_crisis_scenarios": 1, "risk_24_dependencies": 2, "risk_25_reversibility": 2,
}
grp = {"accuracy": "accuracy_", "actionability": "actionability_", "insight": "insight_", "brand_fit": "brand_", "risk_awareness": "risk_"}
scores = {k: float(sum(v for n, v in ck.items() if n.startswith(p))) for k, p in grp.items()}
W = {"accuracy": 0.25, "actionability": 0.25, "insight": 0.20, "brand_fit": 0.15, "risk_awareness": 0.15}
wt = round(sum(scores[k] * W[k] for k in W), 2)

probes = [
    ("X3", "PASS", "audit_hash.py --rev 978821206 = --rev fc9426655 (автор дописал сверху только мои пробы и трейс) = --worktree до записи MEMORY.md = 00411db3bfde9957 = хешу запроса"),
    ("X1", "PASS", "16 путей ветки от merge-base 2fd407e17 (без traces/, knowledge/episodes/, knowledge/errors/, sessions/handoff/); дельта iter11 - 9 файлов, все прочитаны по diff и пробиты; остальные = содержимому iter10 (ac9e96f7348f753a)"),
    ("X2", "PASS", "origin/main = d5bc74580, как в iter10 (трогает только gg-seo-geo-monster/data); fc9426655 поверх 978821206 меняет только knowledge/episodes/2026-10/feniks-iter11-probes/ и traces/"),
    ("B6", "PASS", "listdiff11.py pm p11: 50 из 52 файлов public побайтно = main (отличаются katya-report.html, katya-reklama-kartochki.html); p10 p11: 51 из 52 (katya-report.html, тире)"),
    ("B1", "PASS", "fx11_report.mjs + dash11.py: 8 видов «Отчета» p11 = main после замены U+2014 на дефис; fx11_rows.mjs: 8 периодов вкладки p11 = main; ошибок JS 0; окупаемость всего 9,06 / 8,13 / 8,04 / 11,71"),
    ("G1", "PASS", "фикстуры iter10 дословно (fuzz11.py): fzS, fzV, fzK - все 24 страницы = p11, кроме пометки; пометка с файлом и строкой на «Отчете» (rp-flags) и страницах kshell (fzS 7, fzV 5, fzK 6), ::error::report и ::error::katya; вкладка fzK: 8 периодов = p11 (iter10: «867 044» во всех периодах); пометка видна, Chromium 1248x38 px, y=165 (fx11_shot.mjs)"),
    ("G1c", "PARTIAL", "fzcls11.py + cls11.py: в 15 файлах ndjson вырезана половина одной настоящей записи сентября; 14 из 15 - каждая изменившаяся страница с пометкой; c_daily_totals FAIL: katya.html и katya-tovary.html (шаблоны без kshell, build-katya.ts:1383, :1401) - __DAILY_ORD_REAL[427] 7 -> 0 без пометки (arr11.py)"),
    ("N2u", "FAIL", "fzU: строка `null` в середине delivery_orders.ndjson проходит ndLines (nd-lines.ts:13 проверяет только разбор), читатель роняет весь файл в своём catch (report-page.ts:103); «Валовая прибыль» сентябрь 4 735 507 -> 5 528 249, август 3 240 210 -> 3 920 072, «Наша доставка» 0, пометки нет ни на одной из 24 страниц (cls11.py, anfull11.py); то же на main"),
    ("N2h", "PASS", "c_history: битая запись history.ndjson - падение сборки rc_ozon=1, SyntaxError на build-katya.ts:55 (сырой читатель вне ndLines); громко, публикации нет; то же на main; противоречит фразе спеки"),
    ("N2t", "PASS", "fzT: обрезанный pnl_account_accrual_types.json - видимый текст «Отчета» (виды 2026-09, 2026-08) не меняется, пометки нет (JSON, не ndjson)"),
    ("N2j", "PASS", "fzJ: битая строка orders_daily - красная плашка «за заказ» и пометка на 5 страницах"),
    ("G2", "PASS", "o2fz11b.py: N3c дословно (SKU 0) - nosku 50, ошибки суммы нет; N3e (SKU пустой), N3f (SKU 0 в том же заказе и дне) - нет; F2L, F3L дословно и N3g (устаревшая строка 30 ₽ плюс nosku) - ошибка суммы"),
    ("N3d", "FAIL", "o2fz11b.py N3d: строка с датой и SKU без номера заказа - cpo_orders 100, cpo_sku_daily 150, ложная ошибка «устаревшие строки, выгрузку пересобрать» (build_order_joins.py:63 отбрасывает, build_cpo_sku_daily.py:47 берёт); в реальной выгрузке таких строк 0 (real11.py R2)"),
    ("R1", "PASS", "real11.py: сборщик p11 на файле ветки и data/raw/ozon-cpo = закоммиченный cpo_orders.ndjson побайтно, поля nosku 0; строк без SKU 0, без номера заказа 0; 4 323 198,65 = cpo_sku_daily, расхождение 0"),
    ("G3", "PASS", "ozon-monthly-report.yaml:27-37: перечень ошибок переписан (сумма без SKU-строк, покрытие без списаний; «заказы ещё не в orders_daily» - не ошибка), исключение для строк без дня есть; новая фраза :36-37 обещает больше, чем сделано (S3)"),
    ("G4", "PASS", "mut11.py: убиты MA (все месяцы), RC (ndLines роняет файл), MN, MN2 (nosku), NB, NC, ND (ndLines); живы MB (месяц по поздней строке, с iter10), RP (обёртка readNd «Отчета»), RF (readBad не доходит до страницы), KS (пометка kshell снята); тесты 30 из 30 в трёх файлах"),
    ("G5", "PASS", "dash11.py: U+2014 в ячейках блока 5 main 139 -> p11 0; весь текст «Отчета» (виды 2026-09, 2026-08) 0; report-page.ts 0; в добавленных строках 0"),
    ("N1r", "PASS", "фикстуры iter10 на p11 (fuzz11a.py): fzB 0 из 16 ячеек выгрузки; fzE 48 заказов на 178 425 ₽, fzG 1 заказ на 1 395 ₽ - июнь-август 4 из 4, сентябрь 0 из 4, жёлтая пометка; вкладка: сентябрь «н/д»"),
    ("M4", "PASS", "vt11.sh: tsc 39 = main (md5 85d6f256); vitest p11 984/988, main 972/976, те же 4 падения Маркета; cpo_raw_check.py 23 OK, провалов 0"),
    ("M5", "PASS", "card_sweep24.mjs на сборке p11 = на сборке main = логам автора: 25 строк, FAILS 3"),
    ("Y1", "PASS", "ym11.sh (окружение npm ym:build): сборка Маркета p11 и main rc 0, 17 из 18 страниц равны, katya-report.html отличается только тире в rpN, rpSh, rpRtd"),
    ("M7", "N/A", "шаг CI с cpo_raw_check.py ни разу не запускался: 0 check runs на 978821206 и fc9426655, открытого PR нет"),
    ("B5", "PASS", "U+2014 в добавленных строках 0"),
    ("B7", "PASS", "чисел [ГИПОТЕЗА] на поверхностях нет, на текущих данных ни одно число страниц не изменилось"),
]
ledger = [
    ("S3: спека v1.2 обещает пометку «на всех страницах сборки» и «один читатель nd-lines.ts на всю сборку» - это не так",
     "ozon-monthly-report.yaml:36-37 против кода: build-katya.ts:55 читает history.ndjson мимо ndLines (c_history: падение сборки), шаблоны build-katya.ts:1383, :1401 пометку не получают (c_daily_totals), nd-lines.ts:13 пропускает строку `null` (fzU: весь файл потерян без пометки). knowledge/semantic - верх иерархии RAG: отсутствие пометки будет читаться как «файлы целы»",
     "accuracy_3_no_conflict_with_rag", -0.25),
    ("T1: N6b и G10 без срока пятую итерацию", "self-check iter11: «N6b, G10 - вопрос Ивану открыт»; iter7 -> iter11", "actionability_7_deadline_buffer", -0.25),
    ("I1: класс «строки, которые один сборщик берёт, а другой нет» закрыт по примеру: строка без номера заказа даёт ложную ошибку суммы",
     "cpo_raw.py:68-77 принимает строку с датой без номера заказа; build_order_joins.py:63 её отбрасывает, build_cpo_sku_daily.py:47 берёт; o2fz11b.py N3d: 100 против 150, совет «пересобрать» не помогает; в реальной выгрузке таких строк 0 (real11.py R2)",
     "insight_12_second_order", -0.1),
    ("I2: ndLines проверяет синтаксис, а не запись: строка `null` проходит и роняет весь файл в catch читателя",
     "nd-lines.ts:13 (JSON.parse без проверки, что это объект); report-page.ts:103 `JSON.parse(l).d_ship`; fzU: «Валовая прибыль» сентябрь 4 735 507 -> 5 528 249 (+792 742 ₽, ровно как fzV iter10), «Наша доставка» 0, пометки нет на 24 из 24 страниц; есть и на main",
     "insight_12_second_order", -0.1),
    ("CD: нет cross-domain", "self-check iter10 п.15 без изменений, спеки, decisions.md 15.10", "insight_15_cross_domain", -0.4),
    ("R1: страницы-шаблоны katya.html и katya-tovary.html не получают пометку", "build-katya.ts:1228 (пометка только в kshell), :1383, :1401 (шаблоны); c_daily_totals: __DAILY_ORD_REAL[427] 7 -> 0 на обеих без пометки, 7 страниц kshell с пометкой (cls11.py, arr11.py)", "risk_23_crisis_scenarios", -0.05),
    ("R2: показ пометки не закреплён тестами", "mut11.py: RF (report-page.ts:110 readBad: []) и KS (build-katya.ts:1228 пометка снята) живы на 30 из 30 тестов; MB жив с iter10", "risk_23_crisis_scenarios", -0.05),
    ("R3: шаг CI с проверкой сборщиков (теперь 23 проверки, с nosku) ни разу не запускался", "gh api .../commits/978821206/check-runs: 0; analytics-tests.yml: pip без setup-python, единственный такой шаг в репо (gap 6 iter10)", "risk_23_crisis_scenarios", -0.05),
]
gaps = [f"{g} [{e}]" for g, e, _, _ in ledger]
rework = ("Мерж не блокирует. 1) data: nd-lines.ts:13 - строка, которая разбирается, но не объект (null, число, массив), тоже битая: пропуск и пометка; приёмка fzU (fuzz11.py) - пометка, числа = p11. "
          "2) data: пометка на страницах-шаблонах katya.html и katya-tovary.html (build-katya.ts:1383, :1401); приёмка c_daily_totals (fzcls11.py make daily_totals.ndjson, cls11.py) - 0 страниц «изменилась без пометки». "
          "3) ozon-monthly-report.yaml:36-37: фразу про «все страницы» и «один читатель» привести к коду (history.ndjson падает громко на build-katya.ts:55, cpo-файлы ещё и через readNd cpo-orders-rev.ts) или закрыть п.1-2 и оставить. "
          "4) data: строка выгрузки с датой без номера заказа - учесть отдельно (как nosku) или отказ в cpo_raw.py, как «заказ без даты»; приёмка o2fz11b.py N3d без ложной ошибки, F2L и F3L с ошибкой. "
          "5) тесты на показ пометки: readBad в rp-flags и пометка kshell; приёмка - mut11.py RF и KS убиты. "
          "6) первый прогон analytics-tests.yml на PR: шаг сборщиков зелёный. 7) HITL: Иван - срок для N6b и G10 или запись «не делаем».")
rep = {
    "agent": "feniks", "skill": "phoenix-eval",
    "task_id": "feniks-ozon-report-cpo-iter11-978821206-20261015", "timestamp": ts,
    "deliverable_ref": "ветка claude/practical-ritchie-q09eet @ 978821206 (rework gaps 1-5 iter10; fc9426655 сверху - только мои пробы и трейс), self-check knowledge/episodes/2026-10/selfcheck-ozon-report-cpo-iter11-20261015.md",
    "artifact_class": "dashboard",
    "anchor": ("8.5 timur-activation (итерация 3) - наш артефакт выше на 0.25: как у ТИМУРА после доработки, все пять пунктов iter10 закрыты по критериям приёмки "
               "и подтверждены моими фикстурами дословно (fzS, fzV, fzK, N3c, мутанты MA и RC), а класс N2 проверен по классу, а не по примеру: 15 файлов с вырезанной настоящей записью, 14 PASS. "
               "Не 9.0: остаток (строка null, страницы-шаблоны, строка без номера заказа, переобещание спеки) нашёл я, а не автор. Серия 7.25 -> 8.35 -> 7.80 -> 6.80 -> 8.40 -> 8.40 -> 8.25 -> 7.85 -> 8.00 -> 8.60 -> 8.75."),
    "probes": [{"id": i, "result": r, "evidence": e} for i, r, e in probes],
    "checkpoints": ck, "scores": scores, "weighted_total": wt, "verdict": "go",
    "primary_gap": ("Класс N2 закрыт для ошибок разбора, но не для строк, которые разбираются и не являются записью: одна строка `null` в delivery_orders.ndjson (fzU) "
                    "поднимает «Валовую прибыль» сентября на 792 742 ₽ без пометки, ровно как fzV в iter10 (nd-lines.ts:13, report-page.ts:103; есть и на main). "
                    "Плюс страницы-шаблоны katya.html и katya-tovary.html пометку не получают (c_daily_totals), а спека v1.2 (ozon-monthly-report.yaml:36-37) обещает её «на всех страницах сборки»."),
    "gaps": gaps, "rework_tz": rework,
    "evidence_ledger": [{"gap": g, "evidence": e, "checkpoint": c, "weight": w} for g, e, c, w in ledger],
    "sources_of_truth": [
        "analytics-mvp/data/*.ndjson ветки (= main, кроме cpo_orders.ndjson миграции iter10), data-ym/ для сборки Маркета",
        "analytics-mvp/data/raw/ozon-cpo/2026-09_cpo_orders.xlsx (191 строка) - повторный прогон сборщика p11",
        "сборка main d5bc74580 (analytics-mvp = 2fd407e17) и iter10 a06dcd948 - независимая база сравнения",
        "мои фикстуры iter10 дословно: fuzz10.py, fuzz10b.py, o2fz10b.py, mut10.py (knowledge/episodes/2026-10/feniks-iter10-probes/)",
        "tools/tests/card_sweep24.mjs - свип автора, прогнан на сборках p11 и main",
    ],
    "confidence": 0.85, "telemetry": {"model": "claude-opus-5-5"},
}
assert abs(sum(w for *_, w in ledger) - (wt - 10.0)) < 0.051, (sum(w for *_, w in ledger), wt)
open(OUT, "w", encoding="utf-8").write(json.dumps(rep, ensure_ascii=False, indent=2) + "\n")
print("written", OUT, "| scores", scores, "| weighted", wt, "| ledger sum", round(sum(w for *_, w in ledger), 2))
