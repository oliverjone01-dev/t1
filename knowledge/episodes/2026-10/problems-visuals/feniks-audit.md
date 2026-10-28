# ФЕНИКС: визуализация «Проблем» и общие периоды

[ДАННЫЕ] Verdict GO, 8.50/10, полный продуктовый scope commit f8a02eb7. Независимо рассчитанный audited_hash: b86958093bd97082.

Класс: dashboard. Self-check автора содержит 25 пунктов. Применены CLAUDE.md, data-guard, eval-checklist, calibration-anchors и B1-B7. Работа как роль ФЕНИКСА в Codex: agent-scoped Claude hooks здесь не обеспечивают изоляцию; ограничение записи соблюдено вручную. Аудитор изменил только файлы текущего эпизода. Трейс подготовлен в feniks-trace-row.json для append основным агентом с сохранением предыдущей истории.

## Scope и вывод

Проверены все 12 путей продуктового diff против origin/main: template.html, build-katya.ts, dashboard-period.js, problems/client.js, data.ts, model.ts, page.ts, problems.test.ts, tariff-estimates.test.ts, tariffs.test.ts, visuals-period.test.ts и ozon-problems.yaml. Источники/сборщики и финансовые формулы не изменены. Подтвержденные ставки FBS сохранены. Старые чистые функции расчета оценки остаются в модели и тестах, но сама оценка удалена из загрузки и интерфейса.

Общий resolver внедрен в основной dashboard и «Проблемы». Намеренно сохранена прежняя семантика custom range ниже FLOOR: основной дашборд может получить пустой диапазон. Этот PR не расширяет историческое покрытие. В «Проблемах» такой диапазон сообщает ошибку дат. Текущая очередь rFBS и ожидание передачи остаются датированными снимками, независимыми от периода; история следует выбранным датам.

Инициатор возврата не домысливается из причины/статуса/отмены: в 45 сохраненных return events отдельное поле отсутствует. Диаграмма честно показывает «Не указан». Это утверждение относится к сохраненным данным, не к возможностям API вообще.

## Пять стресс-вопросов

1. Доказательства: независимый JS probe читает NDJSON вне HTML, самостоятельно фильтрует/считает периоды и сравнивает с DOM.
2. Downside: при потере покрытия числа имеют видимые ограничения; неизвестный инициатор не становится продавцом/покупателем; отрицательные штрафы не превращаются в долю расходов.
3. Ресурсы: прежний builder и клиент, новый внешний сервис/бюджет не нужен.
4. Пропущенные риски: источники дат различаются и подписаны; cohort cancellations не выдаются за даты отмены; rFBS snapshot подписан независимо от периода.
5. Проверяемость: из каждой категории доступен drilldown по ID; суммы воспроизводятся до копейки. Состояние банковских расчетов этим не доказывается.

## Три периода

| Период | Отмены raw / DOM | Возвратные товары raw / DOM | Штрафы начислено raw / DOM, ₽ | Итог с корректировками, ₽ |
|---|---:|---:|---:|---:|
| 01-30.09 | 46 / 46 | 17 / 17 | 8570.71 / 8570.71 | 8231.71 |
| 01-15.10 | 29 / 29 | 13 / 13 | 15462.68 / 15462.68 | 15462.68 |
| 01-27.10 | 53 / 53 | 28 / 28 | 39388.09 / 39388.09 | 38909.09 |

Разница raw/DOM равна 0 по каждой проверенной метрике. Это проверка вычислений и отображения сохраненных операционных источников одного семейства. Новая банковская/документальная сверка отсутствует и не заявляется; ограничение уже предусмотрено reconciliation в спеке.

## Red-team probes

| ID | Результат | Доказательство |
|---|---|---|
| B1 | PASS | feniks-probe.mjs independently reconstructs 4046 postings from orders_daily/problems_postings.ndjson and checks fine/return embedded records against problems_events.ndjson. Outside generated HTML; operational correctness, not independent accounting reconciliation. |
| B2 | PASS | Three saved-source to DOM periods: Sep1-30=46 cancellations/17 return units/fines gross8570.71/net8231.71; Oct1-15=29/13/gross15462.68/net15462.68; Oct1-27=53/28/gross39388.09/net38909.09. All exact. |
| B3 | PASS | 4046 unique posting IDs, 136 unique event IDs. Injected duplicate posting/event rejected by validateProblems. TOP10/30/50 preserve total in all real periods; 55-category fixture exercises remainder drilldown. |
| B4 | PASS | Raw NDJSON, ring totals/initiator totals and fine net footer agree in all periods; KPI and weekly tables share unchanged summarize. 77 selected tests cover model, DOM, nulls, real rates, delivery timeline and shared state. |
| B5 | PASS | Diff read across all 12 product/spec paths. No newly hardcoded metric totals in client/template; 10/30/50 are controls, color palette/date counts are configuration. Fine ring uses integer cents. |
| B6 | PASS | Final preview HTML and two inspected screenshots dated17:26 after final build; screenshots show separate actor and reason rings (default30d:61 postings). Own runtime probe uses this final HTML; hash independently b86958093bd97082. |
| B7 | PASS | build-katya -> problemsPage no longer loads estimated cohort or renders estimate UI. CSV exports filtered operational event rows only; no estimate tariff rows in events. Source/coverage and missing-data notes retained. No external publish action executed by auditor. |

Воспроизведение: `node knowledge/episodes/2026-10/problems-visuals/feniks-probe.mjs` из корня checkout. Входной preview и относительные исходники указаны в скрипте. Результат: feniks-probe-results.json. Помимо трех периодов проверены TOP10/30/50, инъекция дублей, storage-event 7d и соответствие полос rFBS отфильтрованной таблице.

## 25 чекпоинтов

| Чекпоинт | Балл | Evidence |
|---|---:|---|
| accuracy_1_figures_tagged | 2/2 | UI badge ДАННЫЕ and visible source/coverage notes; no estimate block remains. |
| accuracy_2_sources_verifiable | 1/2 | Independent saved NDJSON to generated DOM, 3 periods, feniks-probe-results.json; no new bank/document reconciliation. |
| accuracy_3_no_conflict_with_rag | 2/2 | ozon-problems.yaml v2 and common dashboardPeriodDates preserve date bases and gross semantics. |
| accuracy_4_glossary_terminology | 2/2 | Posting counts, return goods units and rubles labeled separately in template. |
| accuracy_5_brand_names_correct | 2/2 | GENGLASS header retained. |
| actionability_6_owner_assigned | 2/2 | Self-check names Иван/менеджеры as existing operational owner. |
| actionability_7_deadline_buffer | 1/2 | Publication after checks and user merge; no engineered delivery buffer specified for this short revision. |
| actionability_8_resources_listed | 2/2 | Existing builder, JavaScript, saved sources and Pages; no new service. |
| actionability_9_metric_concrete | 2/2 | Storage update and 3 date ranges tested by live DOM; 77 selected tests passed. |
| actionability_10_milestone | 1/2 | No project longer than 30 days; separate midpoint milestone not supplied. |
| insight_11_nontrivial | 2/2 | Exact event-ID drilldown and TOP remainder preserve the full population. |
| insight_12_second_order | 2/2 | Partial coverage, unknown return actor and negative correction rules remain visible. |
| insight_13_alternatives_analyzed | 2/2 | User reference chooses rings; snapshot statuses use horizontal bars; initiators separated from causes. |
| insight_14_anti_median | 1/2 | User-directed design; no claim of proprietary analytical method. |
| insight_15_cross_domain | 0/2 | No external cross-domain study supplied for this small UI change. |
| brand_16_voice | 2/2 | Existing GENGLASS dark dashboard styling retained; screenshots personally inspected. |
| brand_17_anti_slop | 2/2 | Changed headings use concrete metrics and units; no promotional claims. |
| brand_18_no_em_dash | 2/2 | Changed UI additions contain no em dash. |
| brand_19_output_routing | 2/2 | Changes in source template/client/model; generated HTML not patched. |
| brand_20_tone_audience | 2/2 | Tooltips/help explain creation date, return goods versus refund, and row semantics. |
| risk_21_downside | 2/2 | Unknown actor labeled Не указан; negative fines excluded from positive ring; coverage remains explicit. |
| risk_22_p9_hard_rules | 2/2 | No unsupported profit claims; estimated FBS cohort no longer loaded or rendered. |
| risk_23_crisis_scenarios | 1/2 | Existing validation handles duplicates and nonfinite values; no new external outage exercise in this UI task. |
| risk_24_dependencies | 2/2 | Shared resolver included in both main and Problems; source snapshots explicitly dated. |
| risk_25_reversibility | 2/2 | Product change isolated in f8a02eb7; no raw data/collector mutation, reversible through normal Git revert. |

Низкие баллы по методическим пунктам отражают масштаб визуальной правки: отдельные milestone, инженерный буфер и исследование смежной отрасли не добавлены. Нового блокирующего продуктового gap не выявлено.

## Evidence ledger

Блокирующих или требующих rework gaps нет. Ограничения: сохраненные операционные данные не являются независимой бухгалтерской сверкой; сведения инициатора возврата отсутствуют в сохраненных событиях; очередь - snapshot. Все ограничения подписаны в UI/спеке и не спрятаны за нулем.

## Проверка сборки и регрессий

Лично повторены 77 тестов из 5 файлов: visuals-period, problems, tariff-estimates, tariffs, delivery-timeline - PASS. Собственный probe - PASS, browser runtime errors: 0. `git diff --check` - PASS. Родительский полный финальный лог проверен: 1387 passed, 3 failed (два исторических cpc-card-spread #3/#4 и ym/svod «Прочие услуги»). Новых падений в финальном логе нет. `/private/tmp/problems-visuals-build.log` подтверждает завершение build-katya. Общий typecheck остается с историческими диагностическими сообщениями; новый чистый typecheck не заявляется.

Лично просмотрены финальные cancellations.png и initiators.png (17:26) из outputs/problems-visuals-preview-2026-10-28; они соответствуют двум отдельным кольцам и default30d = 61 отмене. Трехпериодный probe использует финальный HTML из outputs/fbs-estimate-preview-2026-10-28. Снимки и probe проверяют разные выбранные периоды, поэтому 61 на default30d не сравнивается с 53 за 01-27.10.

## Калибровка и арифметика

anchor: 8.1 dialogs-registry-after-rework - выше на 0.4: уникальные счетчики воспроизведены извне HTML, инъекция дублей отклонена, данные/даты явно обозначены. Ниже 8.9 annotate: полноценная независимая финансовая сверка в scope этой правки не входит.

9×0.25 + 8×0.25 + 7×0.20 + 10×0.15 + 9×0.15 = 8.50. Контроль суммы чекпоинтов дает 9/8/7/10/9. Схема валидируется отдельно перед выдачей.

Слияние и публикация остаются за прямой командой пользователя «мерж». GO относится к проверенному содержимому, не заменяет это разрешение.

AUDITED: b86958093bd97082
VERDICT: go
