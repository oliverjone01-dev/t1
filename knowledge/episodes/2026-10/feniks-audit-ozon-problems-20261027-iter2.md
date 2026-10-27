# ФЕНИКС: вкладка Проблемы, итерация 2

GO **8,40/10**. Коммит e26d19c0, hash 9a066433d54e08e1. Проверен весь продуктовый diff из 19 путей; базовый аудит итерации 1 сохраняется как история, а этот вердикт относится к исправленному содержимому.

## Закрытие четырёх блокеров

1. Исчезновение сохранённого события блокирует replaceEvents и весь collector до записи. Прямая интеграционная проба collectProblems с пустым успешным ответом сохранила старый файл побайтово и не создала других файлов. Коррекция суммы в ноль по тому же ключу разрешена.
2. Неизвестная часть суммы отдельно обозначена в KPI отмен и возвратов; финансовая недельная сумма отмечает неполноту. Таблица оставляет неизвестную сумму н/д.
3. Null индекса не превращается в 0% на alert, KPI или в неделе; строка без индекса не увеличивает покрытие.
4. Валюта index и defect charge строго RUB. Mock collectProblems с USD index завершается до записи файлов.

## Независимые проверки

- `npx vitest run src/scripts/problems/problems.test.ts src/connector/ozon-problems.test.ts src/connector/ozon-seller.postings.test.ts`: **38 PASS**.
- `node --import tsx /tmp/feniks-problems-probes-iter2.ts`: все четыре ранее падавшие adversarial-пробы PASS.
- `node --import tsx /tmp/feniks-problems-collector-iter2.ts`: две интеграционные ошибки источника отклонены, записи не произошли.
- `node --import tsx /tmp/feniks-problems-source-check-iter2.ts`: **110 PASS**, новый collected-final; все суммы и даты4периодов из итерации1 сохранены. Это проверка источника/математики, не независимая бухгалтерская сверка.
- Реальный финальный artifact:4003 posting, схемы1820FBS/1987rFBS/196unknown;17-27Oct индекс/штрафы проверены против сохранённой API-пробы. Точная сумма индекса окна14617,71₽.
- Privacy scan normalized rows:0 customer/address/phone/email/passport keys,0 credential/local-user-path patterns. Не проверял живой опубликованный сайт; это обязательная финальная проверка автора публикации.

## Охват
- `.github/workflows/deploy-pages.yml`
- `.github/workflows/ozon-problems-probe.yml`
- `.github/workflows/ozon-problems.yml`
- `analytics-mvp/katya/problems/template.html`
- `analytics-mvp/katya/problems/thresholds-2026-10-27.json`
- `analytics-mvp/src/connector/ozon-problems.test.ts`
- `analytics-mvp/src/connector/ozon-seller.ts`
- `analytics-mvp/src/scripts/build-katya.ts`
- `analytics-mvp/src/scripts/katya-nav.ts`
- `analytics-mvp/src/scripts/ozon/import-problems-rating.ts`
- `analytics-mvp/src/scripts/ozon/problems-collect.ts`
- `analytics-mvp/src/scripts/ozon/problems-probe.ts`
- `analytics-mvp/src/scripts/problems/client.js`
- `analytics-mvp/src/scripts/problems/data.ts`
- `analytics-mvp/src/scripts/problems/model.ts`
- `analytics-mvp/src/scripts/problems/page.ts`
- `analytics-mvp/src/scripts/problems/problems.test.ts`
- `knowledge/semantic/metrics/ozon-problems.yaml`
- `knowledge/semantic/probes/ozon-problems-2026-10-27.md`

## Red-team probes

| ID | Result | Evidence |
|---|---|---|
| B1 | PASS | 110 independent source/aggregation checks: specialized rating15dates;14617.71RUB;21defect charges+18delay events;5return samples; sampled daily penalties; four periods reconciled to source rows. Same-family consistency only. |
| B2 | PASS | 2026-09 whole month:46/308 cancellations,3096678gross,8231.71fine. 01-15Oct28/177,1539893gross,15462.68fine. 01-27Oct51/403,3169876gross,36662.93fine.19-25Oct11/126,642705gross,17457.49fine. /tmp/feniks-problems-source-check.ts. |
| B3 | PASS | Source4003unique postings,132unique events (50fine43return21defect18delay); validateProblems rejects duplicate keys; pagination tests exercise repeated cursor and HTTP403. |
| B4 | PASS | Independent rerun: mixed100/null cancellations and returns visibly label incomplete totals; null defect index stays н/д in alert/card/week and contributes0 coverage; 38 target tests PASS. |
| B5 | PARTIAL | Threshold10 derives from dated cabin source; full-history posting floor06Feb2026 is fixed. Future updates may need windowing; not a current blocker. |
| B6 | PASS | Final real artifact run40516772998 read independently:4003 rows,1820FBS/1987rFBS/196unknown; known self-delivery posting41775708-0531-1 correctly rFBS. Local current code rendered for probes; postdeploy live check remains publishing agent. |
| B7 | PASS | Four regressions fixed. Separate integration mock collectProblems: USDindex and disappearance of saved fine both reject before any writes; prior file byte-preserved. Signed correction on same key still allowed. Public normalized outputs have0PII/token/local-path matches. |

## Evidence ledger: неблокирующие ограничения

| Gap | Evidence | Checkpoint | Weight |
|---|---|---|---|
| Actual handover percentage, customer-promise shifts and late delivery are unknown until verified source semantics exist; no false zero is shown. | 161 active observations: client_begin/end null; collector stores daily observations, shift/lateDelivery coverage empty. Page shows н/д, explanatory coverage notes. | actionability_10_milestone | -0.25 |
| Thresholds are a dated 27.10 snapshot and full posting floor is fixed at06.02.2026; later source/API changes require maintenance. | katya/problems/thresholds-2026-10-27.json; problems-collect.ts problemPostings(2026-02-06,today); alert shows threshold date. | risk_24_dependencies | -0.15 |

## Калибровка и стресс-вопросы

Comprehension Gate PASS: неизвестные величины видны, причина отмены переведена на русский, текущий уровень показан вместе с датой шкалы. Q1 source rows открыты; Q2 потеря данных блокируется до commit; Q3 нужны только существующие workflows/credentials; Q4 переносы и факты доставки честно не вычислены; Q5 недельные строки воспроизводятся из событий без смешения financial и index charge.

anchor: 8.1 dialogs-registry after rework - higher by0.3: raw source checks plus destructive-update and currency integration probes now pass; missing delivery facts remain explicitly unknown.

Веса:9×0,25 +8×0,25 +8×0,20 +9×0,15 +8×0,15 =8,40. Чекпоинты в JSON, отчёт проверен schemas/validate.py до выдачи.

Записи аудитора: только audit JSON/MD и append trace. Продукт, исходные данные и git не изменялись.

AUDITED: 9a066433d54e08e1
VERDICT: go
