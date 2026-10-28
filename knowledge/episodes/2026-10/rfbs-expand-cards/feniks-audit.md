# ФЕНИКС: раскрытие рейсов rFBS по плашкам

[ДАННЫЕ] GO 8.50/10 для полного нового product/spec diff из четырех файлов: template.html, problems/client.js, delivery-timeline.test.ts, ozon-problems.yaml. Модель, источники, общий resolver и финансовые формулы не меняются. Self-check25 автора прочитан, новое дополнение соответствует поручению Ивана.

Аудит как роль ФЕНИКСА в Codex: ограничение записи соблюдено вручную, только текущий эпизод. Продукт и traces аудитором не изменены. Строка audit подготовлена отдельно для append основным агентом с сохранением истории.

## Вывод и стресс-вопросы

1. Цифры: исходный delivery_timeline.json сравнен с embedded source; отдельные правила в probe пересчитали уникальные рейсы и issue categories.
2. Downside: 85 означает рейсы с пропусками/противоречиями, а не просрочки. 93 в сумме категорий - это пересечения, что явно написано. Недоступная история не превращена в ноль.
3. Ресурсы: существующие HTML/JS и снимок; новое внешнее подключение не требуется.
4. Границы: плашки очереди относятся к датированному snapshot; переносы - к дате наблюдения изменений; даты и определения не менялись.
5. Проверяемость: click раскрывает/сворачивает соответствующий список; chip выбирает точные ID, поиск/select открывают список; aria-expanded соответствует состоянию.

## Red-team probes

| ID | Result | Evidence |
|---|---|---|
| B1 | PASS | Saved delivery_timeline.json equals embedded source; independent issue rules reconstruct218 trips,85 unique review trips and57/18/15/1/1/1 category flags. No financial formula changed. |
| B2 | PASS | Sep1-30, Oct1-15, Oct1-27: same dated snapshot218 trips/85 review; reschedule history correctly unavailable before28Oct baseline; source/date/model semantics unchanged. |
| B3 | PASS | Exact issue-ID set checked for every category in each period. Sets counted per trip to avoid repeated issue flags. Nonexclusive category sum93 versus unique85 explicitly explained. |
| B4 | PASS | Cards, expanded list heading, table and chips checked against source-derived categories; late3, review85, missing_trip18, future_actual57. Synthetic known shift renders exactly1 row. Found search-empty gap corrected and re-probed: title0, rows0, explicit empty note. |
| B5 | PASS | Changed display counts derive t.review/t.overdue/t.late/t.shifts, not literals. Dated85 in semantic spec is provenance, not the live UI value. Labels escaped. |
| B6 | PASS | Final preview contains corrected search behavior; delivery-review.png personally viewed for unchanged layout. Own JSDOM probe on final preview reports0 runtime errors. Final hash independently recalculated. |
| B7 | PASS | No collector/raw/financial source modifications. Existing CSV exports unchanged. Shift count unavailable stays н/д; review explicitly described as data inconsistencies, not lateness. No publication by auditor. |

Воспроизведение: `node knowledge/episodes/2026-10/rfbs-expand-cards/feniks-probe.mjs` из корня checkout. Скрипт не пишет продукт, выводит результаты в текущий эпизод.

## Три периода и точные популяции

[ДАННЫЕ] Проверены сентябрь01-30, октябрь01-15 и октябрь01-27. В каждом текущая очередь включает218 уникальных рейсов и85 unique review trips; список по chip сверяется по точному набору order/trip IDs. История переносов до первого snapshot28.10 недоступна во всех трех периодах, в UI н/д. Это правильное сохранение семантики снимка, а не новая финансовая сверка.

| Признак | Независимый probe | Chip/table |
|---|---:|---:|
| Факт в будущем | 57 | 57 |
| Нет номера рейса | 18 | 18 |
| Факт заполнен, статус «Создан» | 15 | 15 |
| Факт раньше отправки | 1 | 1 |
| Доставлен без подтвержденного факта | 1 | 1 |
| Неизвестный статус | 1 | 1 |

[ДАННЫЕ] Late card=3. Повторный click закрывает details. При переключении card сбрасываются прежние issue/search filters. На синтетической истории один перенос дает одну строку; новый поиск проверен отдельно.

## Evidence ledger

Открытых gaps нет. В ходе аудита синтетическая сохраненная история с одним переносом и поиск NO-MATCH выявили счетчик1 при0 строках без empty note. Автор исправил это до GO: единый filteredShifts теперь питает заголовок, таблицу и note; общая плашка сохраняет общий shiftCount. Повторный probe на финальном HTML:0 строк, заголовок0 изменений, «По этому поиску переносов не найдено». Добавлен регрессионный тест,85 целевых тестов прошли. Это воспроизведенное закрытие дефекта, а не допущение о будущем поведении.

## 25 чекпоинтов

Баллы адаптированы к небольшой UI правке существующего внутреннего дашборда; отсутствие отдельного отраслевого исследования/долгого проекта не означает дефект источников.

| Checkpoint | Score | Evidence |
|---|---:|---|
| accuracy_1_figures_tagged | 2/2 | Data badge/snapshot date retained; unavailable history stays н/д. |
| accuracy_2_sources_verifiable | 1/2 | Source outside generated HTML independently reconstructed; no new bank/document reconciliation. |
| accuracy_3_no_conflict_with_rag | 2/2 | Spec and unchanged model preserve observed_at/queue definitions. |
| accuracy_4_glossary_terminology | 2/2 | Trips, changes and overlapping issue categories explicitly separated. |
| accuracy_5_brand_names_correct | 2/2 | GENGLASS retained. |
| actionability_6_owner_assigned | 2/2 | Existing owner Иван/менеджеры in self-check. |
| actionability_7_deadline_buffer | 1/2 | No delivery buffer promised for short UI revision. |
| actionability_8_resources_listed | 2/2 | Existing builder/client/source snapshot only. |
| actionability_9_metric_concrete | 2/2 | Click opens exact category rows; synthetic search gap fixed and re-probed. |
| actionability_10_milestone | 1/2 | No long project/midpoint milestone. |
| insight_11_nontrivial | 2/2 | Exact issue chips allow concrete remediation. |
| insight_12_second_order | 2/2 | Overlapping categories and unknown history explained. |
| insight_13_alternatives_analyzed | 2/2 | Collapsed list versus always-expanded table chosen per user; changes view separate. |
| insight_14_anti_median | 1/2 | User-directed display, no claimed novel method. |
| insight_15_cross_domain | 0/2 | No cross-domain research needed or supplied. |
| brand_16_voice | 2/2 | Existing dark dashboard style retained. |
| brand_17_anti_slop | 2/2 | Concrete labels, no promotional claims. |
| brand_18_no_em_dash | 2/2 | New UI text contains no em dash. |
| brand_19_output_routing | 2/2 | Source template/client edits, no generated HTML patch. |
| brand_20_tone_audience | 2/2 | Сверка ведомости note explains data flags rather than lateness. |
| risk_21_downside | 2/2 | Missing/conflicting data not counted as late automatically. |
| risk_22_p9_hard_rules | 2/2 | No invented losses, initiators or dates. |
| risk_23_crisis_scenarios | 1/2 | No external outage exercise in this display-only revision. |
| risk_24_dependencies | 2/2 | Existing model/source dependency visible. |
| risk_25_reversibility | 2/2 | Isolated branch changes including corrected search; raw data unchanged. |

## Проверки и postmerge #533

Проверен авторский final log `/private/tmp/rfbs-expand-tests.log`:85 passed /6 files. `/private/tmp/rfbs-expand-build.log` завершен успешной сборкой. Собственный runtime/source probe:0 browser errors, exact issue sets PASS. `git diff --check` PASS. Полный suite и исторический TS baseline по согласованному узкому scope не повторялись.

Лично просмотрен delivery-review.png из outputs/problems-visuals-preview-2026-10-28:4 плашки, выбранная review,85 уникальных/18 без номера и объяснение пересечений читаемы. Состояние18 rows согласуется с данными и UI.

Postmerge #533 дополнительно проверен через GitHub connector API `fetch_file` на commit90cc4b0557be50faec976d2b3c9ebee5196d866e: SHA всех12 product/spec blobs равны `git rev-parse a180c2ec:<path>`. Таблица доказательств: postmerge-533-blobs.json. Общий compare API использует merge-base и показывает посторонние изменения, поэтому для проверки использована именно идентичность blob SHA, а не пустой three-dot diff.

## Калибровка и арифметика

anchor: 8.1 dialogs-registry-after-rework - выше на0.4: категории независимо пересчитаны, наборы ID проверены. Ниже8.9 annotate: покрытие остается ограничено сохраненным snapshot; новых внешних источников не проверялось.

9×0.25 +8×0.25 +7×0.20 +10×0.15 +9×0.15 =8.50. Суммы чекпоинтов9/8/7/10/9. JSON прошел `schemas/validate.py audit-report`: VALID.

GO не заменяет отдельное разрешение Ивана на новый merge/publish.

AUDITED: 288a853f3e5c8d7b
VERDICT: go
