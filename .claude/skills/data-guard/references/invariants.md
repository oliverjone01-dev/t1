# Инварианты данных и схема сверки

Проверки вызываются в билдере до записи результата и роняют сборку (fail-closed). Готовые функции: `../scripts/invariants.py` и `../scripts/invariants.ts`. Источники S1-S16: `sources.md`.

## Минимальный набор (обязателен для любого билдера чисел)

| Проверка | Функция | Класс |
|---|---|---|
| Ключ уникален и не пустой | `assert_unique_key(rows, key)` | К4 |
| Дедуп удалил ровно дубли полного ключа | `dedup_by_key(rows, key)` возвращает (rows, removed) и логирует | К4 |
| Доля 0..1 и num <= den | `assert_share(num, den)` | К2 |
| Сумма частей = итог | `assert_parts_sum(parts, total, tol=0.01)` | К4 |
| Пропуск = null, не 0 | `assert_no_silent_zero(series, dates)` | К7 |
| Снимок свежий, есть loaded_at | `assert_fresh(snapshot, max_age_hours)` | К7 |
| Запись только в окно, пустой или усохший ответ не стирает данные | `merge_window(old, new, start, end)`; `allow_shrink=True` только осознанно | К7 |
| Неполный период помечен | `mark_partial(buckets, now)` | К7 |
| Коды из справочника | `assert_known_codes(values, dictionary)` | К6, К8 |
| Периоды действия не пересекаются | `assert_no_overlap(periods)` | К4 |

## Практики из внешних источников


| Практика | Источник | Класс | Как встроить у нас | Инвариант |
|---|---|---|---|---|
| `unique` + `not_null` на ключе. Тест считается пройденным, если найдено 0 нарушающих строк | S10 | К4 | Модуль `checks/` в билдере вызывается до записи JSON. Каждая сущность получает объявленный ключ | `count(key)==countDistinct(key) && !rows.some(r=>r.key==null)`, ключ = (источник, doc_id, line_no) |
| Уникальность по набору колонок: `unique_combination_of_columns` (dbt-utils), `DataFrameSchema(unique=["a","c"])` (pandera) | S1, S12 | К4 (дедуп схлопывает настоящие дубли) | Дедуп разрешён только по объявленному составному ключу. Скрипт пишет в лог, сколько строк удалено | `removed == rows.length - distinct(fullKey).length`. Если удалили больше, сборка падает |
| `expression_is_true` ("col_a + col_b = total", опция `where`), `accepted_range`, `expect_column_pair_values_A_to_be_greater_than_B` | S1, S3 | К2, К4 | Проверки строк, которые выполняются в билдере для каждой метрики-доли | `num<=den && den>0 ⇒ 0<=share<=1`. Для с/с: `abs(sum(components)-total)<=0.01` |
| Сверка агрегатов между таблицами: `expect_table_aggregation_to_equal_other_table` с `group_by` и `tolerance`/`tolerance_percent`, `equal_rowcount`/`fewer_rows_than` с `group_by_columns` | S3, S1 | К5, К4 | Probe в CI сравнивает сумму по дню с независимым семейством источников (например, выручка из отчёта по начислениям против выгрузки отправлений) и падает при расхождении больше допуска. Сверка внутри одного семейства запрещена правилом | `∀day: abs(A(day)-B(day)) <= tol`, где source_family(A) != source_family(B) |
| audit_helper `compare_and_classify_*`: строки делятся на identical/modified/added/removed. Ключ обязан быть «unique and never null» в обеих таблицах | S2 | К9, К5 | Хук в PR, меняющий билдер: diff старого и нового JSON по ключу. Любые modified/removed требуют объяснения в PR | `assertKeyUniqueNotNull(old,new); diff=classify(old,new); diff.modified∪removed ⊆ allowlist` |
| Свежесть источника: `loaded_at_field` + `warn_after`/`error_after`, `recency`. В dbt без `loaded_at_field` свежесть не считается | S4, S1 | К7 (тихая заморозка) | В каждом снимке есть `loaded_at`. Билдер падает, если снимок старше порога. У нас строже, чем в dbt: нет `loaded_at` значит ошибка | `if(!snap.loaded_at) fail; if(now-snap.loaded_at > errorAfter) fail` |
| Непрерывность дат: `sequential_values`, `expect_row_values_to_have_data_for_every_n_datepart`, `date_spine` | S1, S3 | К3, К7 | Шкала дат строится по выбранному периоду. Пропущенный день хранится как `null` и не превращается в 0 | `spine(start,end).length == N && spine.every(d => d in data \|\| data[d]===null)` |
| Считать только завершённые интервалы. Elementary: «will only run on completed time buckets» | S11 | К7 (неполный день) | Сегодняшний день исключается из расчёта или помечается `partial:true`, подпись на странице показывается обязательно | `bucket.end > now ⇒ bucket.partial===true` |
| Контроль объёма: `volume_anomalies` (training 14 дней, `anomaly_direction: drop`, `seasonality: day_of_week`), `fail_on_zero` | S11 | К7 (перезапись пустым) | Перед коммитом снимка число строк нового снимка сравнивается с медианой за 14 дней | `rows==0 ⇒ fail; rows < 0.5*median14(sameWeekday) ⇒ fail` [ГИПОТЕЗА: порог 0.5 наш] |
| Идемпотентный батч с явным окном. Microbatch: «Each batch is independent and idempotent», `lookback`, для бэкфилла обязательны обе границы `--event-time-start`/`--event-time-end` ("if you specify one, you must specify the other") | S7, S8 | К7 (cron стёр 3 месяца), К12 | Коллектор заменяет только партиции-дни внутри явно заданного окна. Без обеих границ скрипт завершается с exit 1. Пересчёт последних N дней делается через lookback | `writeRange ⊆ [start,end] && start&&end required; untouched = old − range; assert newFile ⊇ untouched` |
| Серьёзность по умолчанию error: `severity` по умолчанию `error`, `error_if` = `!=0`. warn не роняет прогон без `--warn-error`. У GX параметр `mostly` (по умолчанию 1) допускает частичное прохождение | S6, S15 | К7 (fail-open) | Правило: все проверки блокирующие. warn только с тикетом. Прогон перед публикацией идёт в режиме «warn = error» | `failures>0 ⇒ exit 1`. Флаги `mostly<1` и `warn` видны в отчёте |
| Fail-fast в GitHub Actions. Без указания shell действует только `set -e`, `-o pipefail` добавляется лишь при `shell: bash` | S16 | К7, К12 | Линтер workflow в CI: `defaults.run.shell: bash`, в шагах сборщиков запрещены `\|\| true`, `\|\| echo` и `continue-on-error` | `grep -E '\|\|\s*(true\|echo)\|continue-on-error: true' .github/workflows/collect*.yml == ∅` |
| `concurrency` group. Schedule «can be delayed... some queued jobs may be dropped», пиковая нагрузка приходится на начало часа | S16 | К12 | Одна concurrency group на ветку данных. Cron не ставить на :00. Пропуск прогона ловит проверка свежести | `concurrency: data-${{github.ref}}`, cron `17 * * * *` |
| Unit-тесты на фикстурах given/expect с подменой `current_timestamp` и `is_incremental`. Док рекомендует тестировать date math, «previously reported bugs», edge cases | S5 | К3, К12 (тесты на литералах дат) | Часы в билдерах инъецируются. Фикстуры покрывают границу 21:00 UTC / 00:00 МСК, конец месяца, окно N дней и каждый прошлый баг | `build(fixture, now=Date('2026-03-31T21:30Z')).days.at(-1)=='2026-04-01'` |
| Контракт схемы. dbt contracts проверяют «every column's name and data_type» перед сборкой. `datacontract test`/`breaking` («Fail when a contract change is backward-incompatible»). Pandera `strict=True`, `nullable` по умолчанию False, `lazy=True` собирает все ошибки сразу. Elementary `schema_changes` ловит удалённые/добавленные колонки и смену типа | S9, S13, S12, S11 | К6, К9 | JSON Schema на каждый снимок и на вход каждого дашборда. В CI: валидация плюс diff схем на обратную несовместимость. Незнакомое поле или сменившийся тип дают ошибку | `validate(snapshot, schema, {strict:true, allErrors:true})`. `breaking(schemaOld,schemaNew) ⇒ block` |
| `accepted_values`/`not_accepted_values`, `relationships`/`relationships_where` | S10, S1 | К6, К8 | Коды стадий Bitrix и статусы Ozon сверяются со справочником. Неизвестный код роняет сборку, а не попадает в «прочее». Каждый SKU обязан найтись в таблице себестоимости | `stages ⊆ STAGE_DICT; skus ⊆ costTable.skus` |
| `mutually_exclusive_ranges` (опции gaps, zero_length_range_allowed) | S1 | К4 | Периоды действия себестоимости и тарифов не пересекаются по SKU | `∀sku: sorted(periods).every((p,i)=>i==0\|\|p.from>=prev.to)` |
| Библиотечные метрики ODCS: `missingValues` (пустые строки, "N/A"), `duplicateValues` на составном ключе, `rowCount` с `mustBeBetween` | S14 | К7 | В контракте поля объявляется, что считается пропуском. "", "N/A" и 0-заглушка приводятся к `null` до расчёта | `missing(col, ["", "N/A"]) == 0` на входе в расчёт |


## Новые риски из внешних источников


1. **Задним числом приходящие данные.** Microbatch держит `lookback` (по умолчанию 1) «for capturing late-arriving records» (S7). Если снимок заморожен без перезабора последних дней, начисления Ozon и смены статусов потеряются. То, что Ozon и Bitrix правят прошлые даты, пока [ГИПОТЕЗА].
2. **Дрейф схемы источника во времени**, а не только до кода: пропало поле, сменился тип (S11 schema_changes, S13 breaking).
3. **Нестрогий ключ в сверке.** Если ключ не уникален или содержит null, audit_helper предупреждает: «the join won't work as expected» (S2). В итоге ложное «сошлось» или ложное расхождение.
4. **Толерантность глушит ошибки.** `mostly<1` (S15), `severity: warn` без `--warn-error` (S6), `tolerance_percent` (S3): проверка есть, но пропускает брак. Это fail-open, спрятанный в конфиге.
5. **Потеря pipefail.** `python collect.py | tee log` без `shell: bash` не роняет шаг (S16).
6. **Сброшенный cron.** В пиковую нагрузку задания могут быть не отложены, а сброшены («some queued jobs may be dropped», S16). Пропуск целого прогона остаётся тихим без проверки свежести.
7. **Сезонность ломает простые пороги.** Отсюда `seasonality: day_of_week` в S11: выходные дают ложные аномалии объёма, либо реальный провал маскируется.
8. **Пересекающиеся периоды действия** (себестоимость, тарифы) задваивают суммы (S1 mutually_exclusive_ranges).
9. **Пропуск в другой кодировке.** В ODCS пропуском считаются и пустые строки, и "N/A" (S14), такие значения проскакивают мимо `not_null`.
10. **Асимметричный фильтр в сверке.** Soda применяет фильтр одинаково к source и target, и recon-проверки не входят в Soda Core OSS. [ГИПОТЕЗА: по выдаче поиска, docs.soda.io заблокирован]
11. **Единая таймзона не объявлена.** Microbatch: «dbt assumes that all values supplied are in UTC» (S7), dbt-expectations требует `dbt_date:time_zone` (S3). Нужна одна объявленная TZ на проект.


## Схема сверки денег: четыре семейства источников

Важно про даты: Ozon accrual группирует по дате заказа (вывод из t1 PR #361, [ГИПОТЕЗА] до проверки на закрытом месяце), а отчёт о реализации v2 по отчётному месяцу. Поэтому сверка accrual с реализацией за месяц даёт законный сдвиг на заказы на стыке месяцев: раскладывай его таблицей сдвига дат до вывода об ошибке. Внутренние инварианты (например, `Σ по SKU + сборы = payout` в `analytics-dod.md`) проверяют согласованность внутри одного семейства и не заменяют сверку с документом.


Четыре семейства источников. **API и кабинет по сути одно семейство** (К5), поэтому их совпадение ничего не доказывает.

| Уровень | Что | База даты |
|---|---|---|
| A. Банк | Выписка по р/с (платёжки маркетплейса) | Дата платежа |
| B. Документы | Ozon: отчёт о реализации v2, взаиморасчёты, компенсации. ЯМ: закрывающие документы, акт услуг. WB: еженедельный отчёт реализации (`forPaySum`) | Отчётный месяц / неделя |
| C. API-операции | Ozon: accrual/*. ЯМ: united-netting и services. WB: detailed | Дата начисления (или заказа, у Ozon accrual) |
| D. Кабинет | UI | Как в C |

Какие пары сверять (рекомендую):
- **C против B за закрытый месяц, по дате начисления.** Для Ozon сравнивать сумму продаж и возвратов из accrual с реализацией v2 (услуги сравнивать отдельно, с актом). Для WB сумма `forPay` детализации должна равняться `forPaySum` по тому же reportId.
- **B против A по дате платежа.** «К выплате» из взаиморасчётов или united-netting против выписки. Ключ: bankOrderId или номер п/п, с дедупом на стыке месяцев.
- **Заказы по дате заказа нужны только для воронки**, деньги по ним не сверяются. Расхождение «месяц заказа против месяца начисления» раскладывать таблицей сдвига дат, а не называть ошибкой.
- Допуск: до копейки внутри одного документа. Любой остаток объясняется списком строк. «Примерно сошлось» не принимается.
- Флаг К5: в t1#407 «база налога совпадает до рубля с F+G−J−K отчёта за день». Если обе стороны взяты из отчёта о реализации, это сверка внутри одного семейства [ГИПОТЕЗА]. В том же PR сумма за периоды 1-15.09 и 16-24.09 расходится на 46 235 ₽, то есть расчёт неаддитивен по периодам.

