# ФЕНИКС: receipt принятого рекламного окна, итерация 1

**RETURN 7.60/10.** Один blocker: подтверждения прежних принятых дней теряются при сдвиге свежего окна.

Коммит `6128a3e5ece0a1c98fdb4f445d8203cce7562dc6`, hash `cf34aacf67ec7a67` вычислен самостоятельно. Intent review_request, p9_required=true. Self-check25 и подписанная спека прочитаны. Класс: dashboard. Все5 не исключённых путей покрыты; episode и реестр ошибок исключены из хеша, их изменения также прочитаны.

## Воспроизведение

Production-функция saveCorrections записывает receipt16-22.10 с loaded_at23.10. Consumer adsFullDay принимает22.10 при state22.10 и сохранённых SKU100/100. Следующее успешное свежее окно23-29.10 с loaded_at30.10 **заменяет** accepted_windows. При тех же расходах и checkpoint consumer возвращает21.10. Это не гипотетический сетевой сбой: два последовательных успешных вызова опубликованных функций воспроизводят откат. Никакой API/сети fixture не использует.

Причина: `attribution-report.ts:29` сохраняет только ranges текущего вызова. Пока исторические окна двух кампаний остаются ниже95%, их fullstate не догоняет день22.10. Через сдвиг fresh7 патч снова блокирует уже загруженный день. `planBlock` читает именно эту перезаписанную `.sku` metadata.

Доработка: персистентный ledger принятых окон с датой приёмки каждого. Новое окно не должно удалять прежнее подтверждение сохранённых данных или назначать старым/будущим дням неподходящее время другой загрузки. Регрессия должна пройти через последовательные свежие окна при прежнем fullstate, а не только через один успешный вызов.

## Подтверждённое

- Прямой независимый пересчёт collected NDJSON даёт43629377:116/116руб и43629636:135/135руб за22.10. Исходный дефект consumer подтверждён.
-9 собственных fail-closed сценариев PASS: валидный receipt, отсутствие skuSp/receipt, загрузка до концаМСКдня, неверный loaded_at, неверная календарная дата, чужой диапазон,94/100 и ровно95/100.
- Разовый допуск работает; полные расходы всё ещё обязательны. Суммы, ключи, недели и fullstate патч не меняет.
- Все180 целевых тестов не повторялись по поручению. Новый collector-test проверяет только один accepted_windows; последовательная смена окон им не покрыта. Общие прежние CPC/YM сбои не расширялись.

## Red-team probes

| ID | Result | Evidence |
|---|---|---|
| B1 | PASS | Независимо просуммированы первичные collected NDJSON:43629377=116/116руб,43629636=135/135руб за22.10; старый fullstate22.10 объясняет исходный пропуск. |
| B2 | FAIL | audit-receipts-lifecycle.mjs вызывает production saveCorrections → чтение metadata → adsFullDay: окно16-22.10 loaded23.10 даёт22.10; окно23-29.10 loaded30.10 заменяет receipt и даёт21.10. SKU100/100 и state22.10 не меняются. attribution-report.ts:29 заменяет accepted_windows целиком. |
| B3 | PASS | Патч не меняет ключи/строки/суммы; receipt связан с cid и диапазоном. Никакой агрегации SKU или дублирования кампаний не добавлено. |
| B4 | FAIL | Данные и суммы сохраняются, но metadata теряет прежнее окно при следующей загрузке; consumer больше не принимает ранее принятый день. |
| B5 | PASS | Расходы и недели не захардкожены новым кодом; порог95% сохранён. Все5неисключённых путей прочитаны. |
| B6 | PARTIAL | 9самостоятельных fail-closed проверок проходят:без суммы/receipt,до концаМСКдня,невалидные дата/loaded_at,внеокна,<95%,точно95%. Liveсбор после этого патча не выполнялся. |
| B7 | PASS | Receipt без skuSp не допускается; при94/100 день остаётся неизвестным,при95/100 допускается. Денежные формулы и старые ошибки истории не скрываются. |

## Evidence ledger

| Gap | Evidence | Checkpoint | Вес |
|---|---|---|---|
| Потеря предыдущего receipt | `/Users/gengroup/Documents/Codex/outputs/audit-ads-window-receipts-20261023/audit-receipts-lifecycle-result.json`: oldDayAccepted22.10 → oldDayAfter21.10, строки/суммы/state прежние | risk25 | -1 |

## Охват

- `analytics-mvp/src/scripts/ozon/attribution-report.ts`
- `analytics-mvp/src/scripts/ozon/collector-integrity.test.ts`
- `analytics-mvp/src/scripts/plan-tab.test.ts`
- `analytics-mvp/src/scripts/plan-tab.ts`
- `knowledge/semantic/metrics/ozon-ads-window-receipts-20261023.yaml`

## Stress-test и оценка

Источник: первичные NDJSON и production producer/consumer. Downside: старые исторические ошибки могут продолжаться, поэтому разовый receipt обязан переживать новые загрузки. Ресурсы: прежний API/Node/git; новых требований к внешней системе нет. Пропущен жизненный цикл подтверждений, а не финансовая сверка. Решение: вернуть точечный патч на сохранность ledger.

Accuracy8,Actionability8,Insight6,Brand9,Risk7:0.25×8+0.25×8+0.20×6+0.15×9+0.15×7=7.60. Return при>=7.5 имеет явную причину. Checkpoints25 в JSON. Comprehension Gate N/A: внутренний технический дашборд без нового публичного текста.

anchor:6.7dialogs-registryreturn - выше0.90: источник и однократные гейты проверены, дефект локален. Ниже8.1after-rework: подтверждение не переживает следующую загрузку.

Роль feniks/data-guard и token-economy применены. Продукт/источники не менялись, запись только в исключённые отчёты/trace и scratch. Claudeagent-scoped хуки в Codex не исполнялись; scope соблюдён вручную. JSON и trace валидируются schemas/validate.py. Доказательства: `/Users/gengroup/Documents/Codex/outputs/audit-ads-window-receipts-20261023`.

AUDITED: cf34aacf67ec7a67
VERDICT: return
