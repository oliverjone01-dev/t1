# ФЕНИКС - аудит PR «Соинвест: нет данных вместо ложного 0» (iter 1, 16.10.2026)

- Артефакт: ветка `claude/amazing-hawking-0trncq` @ `b547ff1`, merge-base `a018638`. audit_hash `58864faa1b967096` посчитан сам (`audit_hash.py --rev b547ff1`), в запросе хеша не было.
- Охват: все 7 путей хеша (prices-daily.ts, prices-daily.test.ts, coinv-merge.ts, coinv-merge-nosite.test.ts, data/prices_daily.ndjson, data/coinv_daily.ndjson, knowledge/semantic/metrics/ozon-plan-15-10.yaml). Вне хеша прочитаны fix_nodata_1610.py и handoff v16.
- Класс: дашборд / цифры. Пробы B1-B7 и свои (H1, T1, K1, N1, M1, P1) выполнены.
- Self-check 25 пунктов приложен (частично: 7, 12, 13, 15, 21, 24; «нет»: 14).
- JSON: `knowledge/episodes/2026-10/feniks-audit-ozon-coinv-nodata-20261016.json`, `validate.py audit-report` VALID. Трейс `event: audit` в `traces/2026-10-16/agents.jsonl`, 39/39 строк valid.
- Запись: только `knowledge/episodes/**`, `traces/**` и scratch в /tmp. `git status --porcelain` до записи отчёта: только traces (хук SubagentStart).

## Итог

**7.3 / 10, return.** Обе ветки фикса работают, данные переписаны чисто: 937 строк = 464 + 473, остальные 11993 строки prices_daily байт в байт с main, 11 строк coinv_daily. Все потребители, которых просили проверить, нормально переносят null и undefined. Но тот же ложный 0 лежит в третьем файле, gap_daily: те же 11 пар «день, артикул», site_to_seller 1.0, SKU пустой. Именно из gap_daily строятся график «Соинвест» на странице, гейт плато и «скидка OZON» во вкладке плана. После слияния coinv_daily скажет «нет данных», а gap_daily про тот же товар в тот же день скажет 0.

## Потребители (вопрос брифа): null-safe, проба N1 PASS

| Потребитель | Что читает | Защита | Итог |
|---|---|---|---|
| build-tests.ts:242, 258 | coinv_daily `coinv_paid_pct ?? coinv_pct ?? coinv` | `Number(undefined)` = NaN, `Number.isFinite` | PASS, у 11 строк нет ни одного из трёх полей |
| build-tests.ts:284-290 | prices_daily, с 23.09 только `coinv_paid` и `paid` | `co != null && isFinite` | PASS (coinv_paid был null во все дни и до PR) |
| build-tests.ts:2240-2243 | prices_daily.price (предельная) | `v > 0` | PASS, price не тронут |
| plan-tab.ts:453-456 | prices_daily.price | `Number.isFinite` | PASS |
| pick-controls.ts:189, 215 | `coinv_paid_pct ?? coinv_pct` | `== null` - пропуск | PASS |
| boost-readiness.ts:217, 237, 276, 298 | `gap_pct ?? coinv_paid_pct ?? coinv_pct` | `v == null \|\| !isFinite` | PASS (но gap_pct берётся первым, см. G1) |
| plateau-backtest.ts:12 | coinvOf из boost-readiness | то же | PASS |
| coinv-calibration.ts:53-55, 289-290 | необязательные поля | null/NaN выводятся как «нет данных» | PASS по чтению кода, без прогона |
| tools/tests/gen_tests_mock.py:61 | prices_daily.coinv | `is not None` | PASS |
| tools/tests/payout_base_check.py:29-31, 94 | coinv_daily.coinv_pct | у 11 строк поля не было и до PR | PASS |
| card-kin.test.ts:169-172 | coinv_daily date, art | - | PASS: «не наш» подтверждён (K1) |

## 5 вопросов

- **Q1 Доказательства.** Подтверждено по данным main: GGM-01-2 14.10 price 43900 before 54750, 15-16.10 price 43900 before 43900. Коннектор пишет price = marketing_seller_price, before = API price (ozon-seller.ts:87-89). Значит, сменился смысл поля before, а не price: 14.10 к 15.10 price сменился у 29 из 464, before у 446, у 435 новый before равен старому price. P_CAP и колонки цен плана разрыва не получают. Файл seller-prices-probe в репозитории я не открывал [НЕ ПРОВЕРЕНО].
- **Q2 Downside.** Если OZON будет откатывать изменение по частям (доля 50-89 %), ложные нули пишутся молча (P1). Если вечерний срез без SKU придёт после утреннего со SKU, известное значение дня стирается (M1).
- **Q3 Ресурсы.** Код: автор. Мак: Иван. Правка gap_daily умещается в одну итерацию: тот же признак плюс скрипт v8 на 11 строк.
- **Q4 Что забыто?** Забыт gap_daily, соседний источник той же метрики (G1). Перечень потребителей в self-check неполный (G4). У поля prices_daily.coinv с 23.09 другой смысл (G5).
- **Q5 Инвестор-тест.** Первый вопрос: «На графике "Соинвест" у новых GGT-03-5-1 теперь "нет данных"?» Ответ: нет, график читает gap_daily, а там по-прежнему 0.

## Red-team probes

| ID | Итог | Evidence |
|---|---|---|
| H1 | PASS | audit_hash --rev b547ff1 = 58864faa1b967096, 7 путей в охвате |
| T1 | PASS | vitest: 1097 passed, 1 failed (card-kin) из 1098 |
| K1 | PASS | (date, art) за 16.10 совпадают на main и HEAD: 473 артикула, 60521 строка; ассерт «карта карточек отстала: возраст 23, без карточки 2.7 %» |
| B1 | PASS | GGM-01-2 по main сходится с пробой; порог сверен с историей, а не с самим артефактом |
| B2 | PASS | доля price==before: 05-14.10 от 3.4 до 6.7 %, 15-16.10 100 %; правило срабатывает только на 15-16.10 |
| B3 | PASS | 0 дублей (d, offer) на 12930 строк; на HEAD за 15-16.10 0 ненулевых before/coinv/coinv_paid |
| B4 | **FAIL** | gap_daily: 14 нулей, 11 без SKU = те же пары, что в фиксе coinv_daily, у всех site_to_seller 1.0 |
| B5 | N/A | шаблонов нет; 0.9 продублирован литералом в fix_nodata_1610.py |
| B6 | PASS | проба и данные от 16.10; страница пересобирается в CI (ozon-snapshots.yml:264, 359) |
| B7 | PASS | нового пути наружу нет |
| N1 | PASS | таблица выше |
| M1 | **FAIL** | хранилось {sku 123, 55}, срез того же дня {sku '', 0}: на выходе {sku '', coinv_paid_pct нет} |
| P1 | **FAIL** | доля 50/85/89/90 %: записано нулей 50/85/89/0, before null 0/0/0/100 |

FAIL B4, M1, P1 не относятся к классу A и не к B7, поэтому вердикт по правилу 9 не ограничен. Return выходит из суммы весов.

## Evidence ledger

| # | Gap | Evidence | Чекпоинт | Вес |
|---|---|---|---|---|
| 1 | G1: в gap_daily остались те же 11 ложных нулей | `python3 -I scratchpad/q.py`; build-tests.ts:310-330, 2823; gap-daily.ts:20, 79-86; plan-tab.ts:25, 461, 467. Медиана 16.10: 48.530 против 48.645 без строк без SKU (грубая оценка по всем строкам) | accuracy_3 | -2 |
| 2 | G1: второй порядок, соседний производитель той же метрики не проверен | self-check 24 называет только coinv-calibration; boost-readiness.ts:217 берёт gap_pct первым | insight_12 | -1 |
| 3 | G1: гейт зависит от gap_daily | build-tests.ts:2823 controlByDay(GATE_ROWS); gap-daily.ts:86 in_panel true | risk_24 | -1 |
| 4 | G2: слияние стирает значение того же дня | `npx tsx scratchpad/probe.ts` P-M1; coinv-merge.ts:39, 53, 58 | risk_23 | -1 |
| 5 | G3: частичный откат API проходит молча | probe.ts P-P; prices-daily.ts:108; максимум за 27 дней 6.7 % | risk_21 | -1 |
| 6 | G4: перечень потребителей неполный | build-tests.ts:286, 2240; plan-tab.ts:453; gen_tests_mock.py:61 | accuracy_2 | -1 |
| 7 | G5: prices_daily.coinv с 23.09 не соинвест | build-tests.ts:271-276 (28.8 % против 61-63 %); prices-daily.ts:47-49, 108 | accuracy_4 | -1 |
| 8 | G6: признак «нет SKU» вместо механизма «витрина равна нашей цене» | coinv-merge.ts:54-55; coinv_daily 12.10 GGT-47-5-1-90 со SKU, site_paid = cap, 0; gap_daily 20.09 x2, 12.10 [рассуждение о природе нулей] | insight_13 | -1 |
| 9 | G7: не задан критерий приёмки для мака | handoff v16 п.5; self-check 7 «частично» | actionability_10 | -1 |

## Оценка

| Критерий | Чекпоинты | Балл | Вес |
|---|---|---|---|
| Accuracy | 2 / 1 / 0 / 1 / 2 | 6.0 | 25 % |
| Actionability | 2 / 1 / 2 / 2 / 1 | 8.0 | 25 % |
| Insight | 2 / 1 / 1 / 1 / 1 | 6.0 | 20 % |
| Brand fit | 2 / 2 / 2 / 2 / 2 (em dash в диффе: 0) | 10.0 | 15 % |
| Risk awareness | 1 / 2 / 1 / 1 / 2 | 7.0 | 15 % |

Сумма по весам 7.25, в поле 7.3 (округление вверх, расхождение 0.05 в пределах допуска).

anchor: 6.7 dialogs-registry (return) - наш артефакт выше, потому что счётчики воспроизведены до строки, а все 10 потребителей null-safe. С якорем совпадает маркер «метка только на одном из трёх экранов». Против 7.8 cardmap iter2 (тот же автор, тот же день) ниже: там поверхности закрыты, здесь B4 FAIL и потеря значения при слиянии.

## Rework TZ

1. gap_daily: правило из coinv-merge (SKU пустой, gap_pct 0, site_to_seller 1.0 - поля gap_pct нет) перенести в писатель gap-daily.ts или в readGapDaily. Данные: 11 строк тем же скриптом v8, остальное байт в байт. Добавить тест. Если Иван решит gap_daily не трогать, нужна запись в decisions.md и пометка о расхождении на странице.
2. coinv-merge: срез без SKU с нулём не должен стирать значение того же дня, пришедшее со SKU. Пустой SKU тоже не должен затирать известный. Нужен тест на сценарий M1.
3. prices-daily: warning при доле от 0.15 до 0.9. В комментарии к NO_BEFORE_SHARE указать основание: 27 дней, максимум 6.7 %, 15-16.10 100 %, метка [ДАННЫЕ].
4. Исправить перечень потребителей в PR.
5. С Иваном решить судьбу 3 нулей со SKU и site_to_seller 1.0 (20.09 x2, 12.10).
6. Задать критерий приёмки мака на 17.10: что должно стоять в обоих файлах у 9 GGT-03-5-1.

Повторный аудит: дифф к b547ff1 плюс пробы B4, M1, P1.

AUDITED: 58864faa1b967096
VERDICT: return
