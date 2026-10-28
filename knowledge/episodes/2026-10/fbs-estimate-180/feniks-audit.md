# ФЕНИКС: FBS 180, факт + оценка

Вердикт **go**, оценка **8.2/10**, уверенность 0.94. Класс: dashboard. Self-check автора из 25 пунктов прочитан. Проверен весь продуктовый diff ветки, включая два новых файла: template.html, client.js, data.ts, model.ts, tariff-estimates.test.ts, fbs-estimate-cohort-2026-10-28.json, ozon-fbs-tariff.yaml. Рабочий хеш: `8e5d14e3b875ca75`.

## Независимый результат

Исходная PSV прочитана отдельным Python/Decimal расчётом, без вызова продуктовой модели или нормализатора. SHA256 `14c56aedf25c203d5496c712783d7cfa93b870bb890705e1a05884780db6b79b` совпал. 180 уникальных отправлений; 74 попадают в фиксированный диапазон cutoff-created23–26ч, остальные106 остаются вне оценки. Применимость этой группы по-прежнему гипотеза пользователя, не warehouse_id.

| Период создания, МСК | В расчёте | Факт / оценка | Смешанный эффект, ₽ | Сценарий −3%, ₽ | Разница, ₽ |
|---|---:|---:|---:|---:|---:|
| 01–30.09 | 0 | 0 / 0 | н/д | н/д | н/д |
| 18–21.10 | 25 | 20 / 5 | −1746.84 | 29041.38 | 27294.54 |
| 01–28.10 | 68 | 24 / 44 | −8779.43 | 86910.39 | 78130.96 |

Для текущего месяца исключены2 отменённых и4 без пригодной передачи. Подтверждённый эффект24 отправлений остался −5337.57 ₽. Расчёт только по часам даёт −6735.21 ₽. Разница −2044.22 ₽ полностью объясняется двумя подтверждёнными скидками −2% при24.397ч и26.995ч: −1166.22 и−878 ₽. Поле qty повторно не умножается. По каждому периоду raw, модель и DOM сошлись до копейки.

Это сверка арифметики с первичным кабинетом того же семейства данных, а не независимое подтверждение финансового начисления актом. Интерфейс прямо сообщает об оценке, гипотезе и сценарии; ни смешанный итог, ни сценарий не включены в финансовые KPI/штрафы.

## Пробы

- **B1 PASS**: Independent csv.DictReader + Decimal ROUND_HALF_UP from original PSV: 180 unique IDs; SHA256 matches dated cohort; 74/106 reconstructed; raw mixed net -8779.43, fact -5337.57, best 86910.39, gap 78130.96. This validates source rates, not financial accrual.
- **B2 PASS**: Raw→model→DOM: Sep 1–30 n=0/null; Oct18–21 n=25/net -1746.84/best29041.38/gap27294.54; Oct1–28 n=68/net -8779.43/best86910.39/gap78130.96. Closed month unavailable is not zero.
- **B3 PASS**: Raw180 unique180; allowlist74+106 nonoverlapping; duplicate tariff and overlap cohort fixtures rejected. Groups sum to68 and net -8779.43. 2cancelled+4waiting excluded.
- **B4 PASS**: Raw, TypeScript model, generated DOM, semantic spec controls agree. Summary, groups and row table derive same period-scoped object; hypothesis/estimate/scenario visible. Existing24 facts unchanged.
- **B5 PASS**: New client numbers are computed from e.*. Dated cohort IDs and source SHA are intentional approved hypothesis provenance. Hardcoded control totals only in spec/tests; time bands explicit policy.
- **B6 PASS**: Final hash8e5d14e3b875ca75 independently recomputed. Final preview HTML contains new labels and mobile420 CSS; current kpi.png personally viewed showing8779.43,5337.57, hypothesis and non-accrual labels. Source dated28Oct; no live countdown.
- **B7 PASS**: Publishing path build-katya.ts:5705 uses problemsPage including visible hypothesis/estimate/scenario labels. CSV exports filtered problem events only; mixed tariff not inserted into events/finance. Summary unchanged when cohort removed. No separate tariff export exists.

Дополнительные adversarial-пробы прошли: 0/12/24/36/48ч и +1сек после каждой границы; cancelled/returned; отсутствующая, отрицательная и будущая передача по МСК; неизвестный ID; перекрытие/дубли allowlist; устаревшая дата источника; новый подтверждённый факт для старого ID; неизменность исходных данных; отсутствие добавления оценки в финансовые сводки.

Воспроизведение из корня репозитория:

```sh
python3 knowledge/episodes/2026-10/fbs-estimate-180/feniks-raw-probe.py
node --import ./analytics-mvp/node_modules/tsx/dist/loader.mjs knowledge/episodes/2026-10/fbs-estimate-180/feniks-runtime-probe.ts
```

Результаты сырого расчёта: `feniks-raw-results.json`. Targeted suite лично повторён: **69/69**. Полный suite автора после снятия ограничений IPC: **1375passed/3failed**. На отдельной копии baseline8b93907b независимо повторены оба падающих файла: те же3 ошибки cpc-card-spread3/4 и ym/svod cabinet articles;78pass. Лог `/private/tmp/fbs180-baseline-tests.log`. Typecheck baseline8b93907b и текущей версии: обе exit2, все81 строки диагностики побайтово одинаковы, новых ошибок нет. Лог `/private/tmp/fbs180-tsc-baseline.log`. Полный build-katya автора завершился; UI evidence ниже.

Финальный preview: `/Users/gengroup/Documents/Codex/outputs/fbs-estimate-preview-2026-10-28/katya-problems.html`. Проверено наличие финального CSS420 и новых подписей. `kpi.png` в том же каталоге лично просмотрен: числа8779.43/5337.57 и маркировки читаемы в узком viewport244px. Браузером аудитор не управлял; DOM независимо исполнен через JSDOM. Файл tracked public был старым генерированным артефактом, его восстановление после тестовой сборки не меняет публикуемый билдер.

## 25 чекпоинтов

1–5: числа размечены по смыслу (факт/оценка/гипотеза), источник открыт, дата актуальна, единица отправление, терминология и бренд согласованы. Ограничение: гипотеза74/106 не является метаданными склада.
6–10: ответственный Иван, изменение текущей сессии, существующий TS/HTML без зависимостей, измеримые контроли68/24/44, долгосрочный milestone не применим.
11–15: учтены реальные расхождения факт/часы и второй порядок при обновлении данных; альтернативы факт-only/всё по часам документированы; принцип финансовой сверки перенесён корректно; оценка не обещает новый стратегический insight.
16–20: существующий внутренний стиль сохранён, рекламных claims нет, новые строки без U+2014, нужный дашборд обновлён, подписи понятны; публичный Comprehension Gate неприменим к внутреннему операционному инструменту.
21–25: сценарий не гарантирован, P9 не нарушен, нет действия с бюджетом, null не подменяется нулём, новые ID остаются неизвестны, откат обычным PR возможен.

## Пять стресс-вопросов

1. Доказательства: первичная PSV открыта, независимо пересчитана, SHA и списки совпали.
2. Downside: при ошибке применимости или фактическом результате хуже модели сценарная экономия не реализуется; фактических списаний или автоматических решений нет.
3. Ресурсы: существующая сборка, один фиксированный JSON, новых сервисов и платежей нет.
4. Что забыто: за пределами180 нет автоматического покрытия; исторический закрытый месяц не превращён в ноль; это видно в подписи снимка/покрытия.
5. Инвестор-тест: −8779.43 ₽ есть смешанная оценка по68, из неё−5337.57 ₽ основано на24 подтверждённых ставках;78130.96 ₽ сценарный разрыв, не начисление и не фактический убыток.

## Evidence ledger и калибровка

Блокирующих воспроизводимых gaps не найдено. Остаточные пределы известны и видимы: классификация гипотетическая, новый ID не оценивается, недостающий исторический период н/д, финансовый акт не сверялся. Эти ограничения удерживают оценку ниже8.9; они не отменяют прямое поручение пользователя показать оценку.

anchor: 8.1 dialogs-registry-after-rework - этот артефакт немного выше благодаря независимому расчёту до копеек и мутационным пробам, при сохранении явного ограничения гипотезы. Scores: accuracy8.5/actionability8.0/insight8.0/brand_fit8.0/risk8.5. Weighted:2.125+2+1.6+1.2+1.275=8.2.

Аудитор писал только эпизод, /tmp и trace; продукт/сырьё не менял. Tool hooks роли здесь не загружены, ограничение соблюдено вручную. Финальный git status содержит только7 заявленных продуктовых путей, эпизод и trace. JSON audit-report и trace проверены schemas/validate.py: VALID.

AUDITED: 8e5d14e3b875ca75
VERDICT: go
