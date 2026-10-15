# Self-check автора: gaps iter10 (1-5), Иван 15.10 «здесь доделывай пункты, мерж»

База: self-check iter10 (`selfcheck-ozon-report-cpo-iter10-20261015.md`, 25 пунктов без изменений), отчёт iter10 go 8.60.

| Gap | Правка | Доказательство |
|---|---|---|
| 1 класс N2 | `src/scripts/nd-lines.ts` ndLines - один читатель ndjson на build-katya (37 мест) и «Отчет»: битая строка пропускается, ndBad; красная пометка в шапке каждой страницы (kshell) и в rp-flags «Отчета», ::error:: в конце сборки | Сценарий: битая строка в delivery_orders (копия data) - пометка на «Деньгах» «delivery_orders.ndjson, строка 1078», ::error:: report и katya; vitest nd-lines.test.ts |
| 2 строки без SKU | build_order_joins пишет nosku в cpo_orders; инвариант Σзаказов - nosku = Σтоваров | vitest «nosku не даёт ложной ошибки»; cpo_raw_check «заказы 130, товары 100, без SKU 30» |
| 3 спека v1.2 | ozon-monthly-report: «заказы ещё не в orders_daily» убраны из ошибок, исключение строк без дня | diff спеки |
| 4 тесты | MA: выгрузка за два месяца, ненайденный в сентябре - missMonths ["2026-09"]; RC: ndLines теряет только битую строку | vitest 30/30 в трёх файлах |
| 5 U+2014 | report-page.ts: все «—» -> «-» (11 мест) | grep 0 |

Приёмка: сборка против main - отличаются только katya-report.html (тире, код) и katya-reklama-kartochki.html (код); «Отчет» в Chromium = main кроме тире; свип = эталон; vitest 984/988 - 4 падения Маркета, как на main; tsc 39 = main. Gap 6 (CI-шаг) - проверю на прогоне PR. N6b, G10 - вопрос Ивану открыт. Читатель ndLines общий и для сборки Маркета (PLATFORM=ym): на целых данных поведение то же.
