# ФЕНИКС: вкладка Проблемы, итерация1

RETURN 7,15/10. Коммит77c16af9, audited hash cf8256a8690aa600.

Прочитаны ТЗ, утверждённая спека, self-check25, source probe, все19 изменённых продуктовых путей. Независимо повторены27целевых тестов (PASS) и110source/math/date проверок. Известные ограничения доставки подтверждены: клиентские promises в161активной строке отсутствуют; факты из batch API не проверены, поэтому н/д допустимо. Это не оправдывает подстановку нулей в уже поддержанных метриках.

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

## Findings / evidence ledger

| Gap | Evidence | Checkpoint | Weight |
|---|---|---|---|
| P1: repeated successful-empty response deletes previously saved monetary events and makes the covered day look zero. | problems-collect.ts replaceEvents: replaceEvents([{id:old-penalty,date:2026-10-20,kind:fine,amount:100}],[],[fine],2026-10-20,2026-10-20) => []; collector marks fineDays complete. Repro /tmp/feniks-problems-probes.ts. Existing collector-integrity.replaceSlice rejects this case. | risk_23_crisis_scenarios | -0.3 |
| P1: incomplete monetary sums are presented as complete DATA even though unknownAmount is positive. | Two cancelled/returned rows amount100 and null render total100 ₽ and DATA7/7 with no partial-amount marker. model calculates unknownAmount; client KPI and weekly sums ignore it. Repro /tmp/feniks-problems-probes.ts. | accuracy_3_no_conflict_with_rag | -0.25 |
| P1: null defect index renders zero and misleading safety margin. | validateProblems accepts defect_index=null; alert and card evaluate null*100 =>0%, margin10pp; weekly cell uses same coercion. ratingCoverage counts null row. Repro /tmp/feniks-problems-probes.ts. | brand_20_tone_audience | -0.3 |
| P2: defect charges do not check currency, unlike fine/return money. | defectEvents with charge_price100,charge_price_currency_codeUSD produces amount100 without error, displayed as RUB. problemRatingIndex.currency_code similarly unchecked. Real probe currency fields are RUB. | risk_22_p9_hard_rules | -0.15 |

## Red-team probes

| ID | Result | Evidence |
|---|---|---|
| B1 | PASS | 110 independent source/aggregation checks: specialized rating15dates;14617.71RUB;21defect charges+18delay events;5return samples; sampled daily penalties; four periods reconciled to source rows. Same-family consistency only. |
| B2 | PASS | 2026-09 whole month:46/308 cancellations,3096678gross,8231.71fine. 01-15Oct28/177,1539893gross,15462.68fine. 01-27Oct51/403,3169876gross,36662.93fine.19-25Oct11/126,642705gross,17457.49fine. /tmp/feniks-problems-source-check.ts. |
| B3 | PASS | Source4003unique postings,132unique events (50fine43return21defect18delay); validateProblems rejects duplicate keys; pagination tests exercise repeated cursor and HTTP403. |
| B4 | FAIL | Totals with missing amounts have no visible partial marker; null rating becomes0 on cards while chart correctly breaks. |
| B5 | PARTIAL | Threshold10 derives from dated cabin source; full-history posting floor06Feb2026 is fixed. Future updates may need windowing; not a current blocker. |
| B6 | PARTIAL | Full collected artifact before provider classifier fix; source row amounts audited, current classifier separately tested. Final artifact recollection and live-page visual verification pending parent. |
| B7 | FAIL | Null metric published as factual zero; valid-empty source may erase saved fines. Sanitized public rows have no customer/address/phone payload; HTML escaping and CSV safety are present. |

## Четыре воспроизводимые проверки

`cd analytics-mvp && node --import tsx /tmp/feniks-problems-probes.ts` воспроизводит4gaps; скрипт не меняет продукт. `node --import tsx /tmp/feniks-problems-source-check.ts` проверяет110source/math кейсов. API не вызывался аудитором, использованы сохранённые реальные read-onlyпробы.

Схемаproviderисправлена автором до аудита; первый собранный artifact ещё старый по этому признаку. По деньгам/датам совпадения проверены вне renderer. Нет заявления банковской/документальной сверки.

Workflow main-only, секреты только environment; permission probe read-only; writes ограничены normalized paths, logistics sheet не затрагивается. Daily запускается после успешного ordersbackfill, deployпосле daily. На время любого API exception commit шаг не выполняется. Однако successful-empty финансовые ответы сейчас могут стирать историю: gap1.

Privacy: public normalized postings/events/observations не содержат buyer/address/phone полей. Probe shape описывает такие ключи как типы, сами customer объекты не экспортируются в нормализованные данные. JSONScript escaping и CSV formula guard пройдены существующими/ручными проверками.

Q1: источник каждого нового класса цифр открыт. Q2: неверный ноль скрывает риск штрафа, потому и RETURN. Q3: существующие Node/GitHubSecrets без дополнительных сервисов. Q4: не маскировать неизвестные даты доставки и цену null. Q5: после fixes интерфейс даст список событий по утверждённым датам, не прибыль.

anchor: 6.7 dialogs-registry return - slightly higher: API provenance and period math verified, but missing values are misrepresented and update can erase prior nonzero evidence.

Веса:7×0,25+8×0,25+8×0,20+6×0,15+6×0,15=7,15. Чекпоинты в JSON, schema validation обязательна перед выдачей.

Rework: Protect nonzero saved event keys against unexplained disappearance (allow explicit same-key corrections); show unknownAmount in KPI and weekly sums; preserve null rating in all surfaces and coverage; enforce RUB in defect/index amounts. Add adversarial regression cases and rerun targeted tests on new hash.

Ни product, ни git не изменены аудитором; только этот отчёт, JSON и append trace.

AUDITED: cf8256a8690aa600
VERDICT: return
