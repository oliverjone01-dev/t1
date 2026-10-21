# Аудит целостности сборщиков OZON, итерация 2

**8.30 / 10, go** на `b603b6a22a7f430dc29c9173282c0bed74e33707`, `AUDITED b3fa6596a9b0fe5c`.

Проверил Codex по роли ФЕНИКСА, без имитации Claude/Opus. Проверена вся область PR #493: **21 путь** относительно merge-base с origin/main. Продуктовые данные, main, refs и память аудитор не менял. Ранее выданный return на44a94fed не перезаписан: это новое заключение на новое содержимое.

Это подтверждение исправлений кода и доступности проверенных API-форматов. Оно не означает, что main уже дозагрузил данные или что проведена независимая денежная сверка.

## Что изменило решение

| Прежний дефект | Независимая проверка конечной головы |
|---|---|
| CSV с пустым SKU удалял старую строку и продвигал состояние | CSV1 блокируется; прежние данные и состояние сохраняются |
| Нечитаемая корзина превращалась в0 | CSV2 блокируется |
| Название товара «Итого» обходило проверку чисел | TOTAL1 блокируется; итог распознаётся только в полях даты/SKU |
| Неполный dailyStats удалял кампанию/день | ADS1 блокируется, старый файл побайтно сохранён |
| Пустой финансовый день удалял старые начисления | FIN1/FIN2 блокируются до записей всех файлов; checkpoints не создаются |
| Составной ключ скрывал отсутствующий SKU | KEY1 блокируется |
| Фильтр sku-views скрывал явную нулевую коррекцию | Настоящий main принимает нулевую строку, сохраняет ключ и завершает день |
| Красная попытка могла скрыться за свежей max-date | Manifest последней попытки сохраняется и виден через healthHtml |

На конечном коде независимо выполнены **28/28 новых тестов** и отдельные атаки на реальные импортированные модули. Для воспроизводимости использован snapshot импортного замыкания через git show b603b6a2, с отдельным cwd в tmp и запретом сети. Команды: `node --import tsx <evidence>/iter2-b603-probes.mts`, b603-views-zero-probe.mts, b603-budget-probe.mts и b603-corrections-probe.mts из analytics-mvp. freeze.py b603b6a2 восстанавливает снимок, если tmp очищен.

Явные нули отдельно проверены на helper, настоящих acq и sku-views: они проходят, данные не подменяются пропуском. При исчерпании бюджета первой запрашивается свежая недостающая CPC-кампания; CPO с большим расходом не попадает в очередь, неудача не двигает состояние.

## Реальный формат DATE и строка «Корректировка»

Самостоятельно прочитан конечный live-лог run39596970975 на b603b6a2:

- Seller: types135, by-day110, dayTotals1, skuViews600, postings/accrual3 - все OK.
- DATE, окно27.08–20.10: кампании45812525/40015169/40047060/44989034 вернули **28/47/144/14** SKU-строк; все пробы подтвердили строки20.10.
- В последних трёх отчётах действительно присутствуют «Корректировка» с пустым SKU и отдельная строка «Всего». Это доказанная служебная форма, а не оправдание неизвестного пустого ответа.

Служебная коррекция принимается только по точной метке в DATE и пустому SKU. Обязательный callback вызывается после проверки всего CSV. Пустые значения остаются null; плохие числа, ложное название товара и поздняя повреждённая строка вызывают отказ с нулём callback-вызовов. Метаданные записываются после принятия основного ряда; сообщение на странице показывает, что сумма не распределена по SKU/дням. Она не добавлена в денежные показатели. Процент покрытия назван долей расхода кампаний с дневными SKU-строками и прямо отделён от сверки сумм.

## data-guard: восемь шагов

1. Реестр E027/К7 и E018/К6 самостоятельно прочитан через registry_match; первоначальные реальные fault injection подтверждены в первой итерации.
2. Контракт и self-check25 прочитаны. Новые формулы денег, gross/net и даты признания не вводятся; недатированная коррекция вынесена отдельно.
3. Живая форма подтверждена на конечном коммите: пять Seller-проверок и четыре DATE-отчёта.
4. Негативные инварианты и положительные explicit-zero сценарии воспроизведены независимо.
5. Три периода неизменённой базы проверены: сентябрь312/24185394руб,01–15.10 186/12685902руб,20.10 25/1525483руб; ключи уникальны. Это контроль базы, не межсемейная денежная сверка.
6. Claims ограничены полученными доказательствами. Проверка кода/API не названа производственным восстановлением.
7. Настоящее заключение go связано с самостоятельно рассчитанным hash `b3fa6596a9b0fe5c`.
8. Ретро: прежние разрушающие пути закрыты и приложены регрессии; незакрытые ограничения перечислены ниже. Реестр и память аудитор не менял.

## Ограничения и дальнейшая эксплуатационная проверка

- Каждый файл заменяется атомарно, общей транзакции между data, metadata и checkpoint нет. Сбой диска/процесса между rename остаётся отдельным сценарием восстановления.
- 55/62-дневные окна и бюджет ограничивают автоматическое восстановление. После слияния нужно проверить фактические campaign/day покрытия и остаток очереди, без обещания полного исторического backfill.
- Недатированные корректировки сохранены отдельно; их бухгалтерское распределение не выполнено. Независимого денежного документа нет.
- Final exacthead CI39596970988 was independently read: **1219/1219 tests,71/71 files; OZON21/21 and YM18/18 smoke pages**. These clean-runner counts supersede the earlier local23-page count, which included old temporary files. Own targeted28/28 also passed.
- Author selfcheck now reflects final live and CI success. Minor formatting gap: DATA labels apply to shared paragraphs rather than every individual figure; factual sources are available.

## Пять вопросов

1. Доказательства: реальные модули, изолированные файлы, неизменный снимок и независимое чтение live-лога; источник каждого вывода приложен.
2. Downside: повреждённый/неполный ответ теперь останавливает соответствующий срез и сохраняет прошлый; общая файловая транзакция остаётся ограничением.
3. Ресурсы: существующие Node/Actions/API, ограниченная последовательная очередь, без нового сервиса и изменения кабинета.
4. Забытое: служебная коррекция обнаружена живой пробой и не скрыта в нулях; текущая неполнота видна пользователю.
5. Короткий ответ: код защищает прежние данные в воспроизведённых отказах и принимает подтверждённую живую форму; данные main ещё требуют отдельного прогона после слияния.

## Red-team probes

| ID | Результат | Evidence |
|---|---|---|
|H1|PASS|Independent hash b3fa6596a9b0fe5c; HEAD b603b6a2; all21 changed paths reviewed, no data paths; immutable import closure snapshot used for own fixtures.|
|B1|PASS|Real live final log run39596970975 read independently; fiveSeller and fourDATE passed; old failure fixtures and author logs crosschecked; no monetary reconciliation claim.|
|B2|PARTIAL|Three unchanged-data periods independently counted: September312/24185394; October1-15 186/12685902; October20 25/1525483. No production backfill or external monetary document in branch audit.|
|B3|PASS|KEY1 literalundefined blocked; duplicate/NaN tests pass; explicit zero kept. Old nonzero full keys preserved in campaign/day/SKU and finance slices before writes.|
|B4|PASS|Shared healthHtml in both builders; own failure manifest visible despite fresh dates, correction metadata warning visible, CPC SKU/attribution gaps independently signalled.|
|B5|PASS|No new financial hardcode; historical date and bounded collection windows labelled. Diff contains no emdash additions; health counts derived.|
|B6|PASS|Live final on exact b603 commit uses four real dashboard campaigns with positive20.10 spend and includes20.10 rows; earlier failures documented rather than reclassified as empty.|
|B7|PASS|CSV1/2,TOTAL1,ADS1,FIN1/2,KEY1 now block before destructive replacement/checkpoint. False-stop viewszero fixed. Failure and undated correction warnings reach HTML; no claim that coverage percentage reconciles amounts.|
|P1|PASS|Own28/28 passed; exacthead CI1219/1219,71files,OZON21+YM18smoke independently read and green.|
|P2|PASS|No-callback correction throws; valid exactDATElabel+emptySKU yields separate nullable metadata; badnumber/laterbadrow/misleadingname throw with0callbacks.|
|P3|PASS|Earlier independent repeatcursor and lawful2page accrual probes passed; unchanged pagination code. Live Seller byday110 succeeded, not proof of every possible pagination boundary.|
|P4|PASS|Own forced budget expiry selects urgentfresh before oldexpensive, requests no CPO, and leaves stateempty after timeout; helpers/realacq/realviews accept explicit zero.|
|D1|PASS|No self-claimed audit score in product/spec; selfcheck25 exists.|
|D2|N/A|No agent delegation logic changed.|
|D3|N/A|No agent frontmatter changed.|
|D4|PASS|Final audit JSON and trace schema validation run before delivery; weighted8.30 and25checkpoint sums crosschecked.|
|D5|N/A|No role/tier changes.|
|D6|N/A|No skill trigger changes.|
|D7|PASS|Explicit collector failures remain nonzero; partial source updates committed before red summary, with persisted failure manifest. CPO excluded by paymentType only.|
|D8|PARTIAL|Sequential async windows<=60days and9/12min soft budgets; urgency ordering verified; collecting all remaining campaigns can require more runs.|
|D9|PASS|No product/data/memory/ref writes by auditor. Readonly API job uses contentsread; snapshots jobs main-only; no untrusted artifacts executed by changed deploy path.|
|D10|N/A|No Cowork/agent runtime changes.|
|D11|PASS|52 multiline shell blocks bash-n passed in first iteration; new record_attempt function syntax checked separately; workflow changes inspected, live GitHub job successfully executed final verify workflow.|

## Оценка

|Критерий|Балл|Вес|Вклад|
|---|---|---|---|
|accuracy|8|0.25|2.00|
|actionability|8|0.25|2.00|
|insight|8|0.2|1.60|
|brand_fit|10|0.15|1.50|
|risk_awareness|8|0.15|1.20|

Итого:2.00+2.00+1.60+1.50+1.20=8.30. Все25 checkpoint в JSON; оценка проверяется валидатором.

anchor: 8.1 reestr-go: our8.30 is higher by0.20 because destructive cases were independently replayed and a real liveformat probe now passes, with failures visible on export. Below8.5 timur-activation because cross-file crash transaction, bounded historical coverage and undated monetary corrections remain explicit limitations.

## Evidence ledger

|Gap|Evidence|Checkpoint|
|---|---|---|
|Multi-file finance/data+metadata+checkpoint writes are individually atomic renames, not one filesystem transaction; a process/disk failure between files still requires recovery.|acq/pnl sequential atomicText calls then recordSuccess; adsku writeRows then saveCorrections then checkpoint. Explicitly disclosed in selfcheck.|risk_23|
|55/62-day windows and7-day replay plus budget do not prove completion of older missing history or all campaigns; verify actual main backfill and campaign/day coverage after merge.|ad-attribution recent=max(FLOOR,to-54), replay7; adsku WINDOW62, budget9/12 and checkpoints; own budget-probe leaves pending campaigns without data mutation.|risk_24|
|Undated corrections are preserved and warned about but cannot be assigned to SKU/day; there is no independent monetary document or financial reconciliation in this audit.|live CSV CORRECTION three campaigns with undated:true; own values preserve null; sourceHealth warning and separate adjustments file; no external document supplied.|accuracy_3|
|Quantitative claims in author selfcheck are marked by shared DATA paragraphs rather than every figure individually; all final test counts have now been verified.|author-selfcheck-final.md: DATA tag at block introduction; following28/28 and CI claims share that paragraph. Actual final exacthead CI1219/1219,71files,OZON21+YM18smoke independently read.|accuracy_1|

Артефакты: JSON рядом; доказательства в `feniks-probes-ozon-collector-integrity-iter2/`. Код/данные/refs/память не менялись. Ограничения Claude write-hooks в Codex соблюдены самим аудитором, автоматическое исполнение этих hooks не заявлено.

Validation: audit-report JSON VALID; agent-trace JSONL 2/2 VALID. Independent weighted total:8*.25+8*.25+8*.20+10*.15+8*.15=8.30. Final HEAD and worktree hashes both b3fa6596a9b0fe5c.

AUDITED: b3fa6596a9b0fe5c
VERDICT: go
