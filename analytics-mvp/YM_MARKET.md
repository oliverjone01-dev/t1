# KATYA для Яндекс Маркета (analytics-mvp, мультиплатформа)

Дашборд KATYA на данных Яндекс Маркета БЕЗ копирования проекта: та же сборка `analytics-mvp`,
параметризованная платформой. Ветка задачи: `claude/yandex-market-katya-dashboard-eeifol`.
Основание: атомы 1-2 эпизода `knowledge/episodes/2026-06/feniks-veto-uploaded-docs-20260610.md`
(единый контракт данных + поле `platform`, дашборды не переписываются).

## Кабинеты и секреты

| Что | Значение | Где |
|---|---|---|
| Api-Key Партнёрского API | секрет **`YM_DASHBOARD_1`** (один ключ на оба кабинета) | GitHub Secrets; локально `YM_API_KEY` в `.env` |
| Бизнес-кабинет «GENGLASS» (зеркала) | businessId **1023124** | `DEFAULT_BUSINESS_IDS` в `src/connector/ym-partner.ts` |
| Бизнес-кабинет «GEN GROUP» (мебель) | businessId **74986385** | там же |
| Кампании (магазины) | узнаются через `GET /campaigns` (Этап 0), фильтр по кабинетам; явно - `YM_CAMPAIGN_IDS` | опц. секреты `YM_BUSINESS_IDS`, `YM_CAMPAIGN_IDS` |

`YM_TOKEN` - это Метрика (direct-snapshots.yml), к Маркету не относится и не читается.
Ссылки-инвайты в кабинеты (с digest) в репозиторий не кладём.

## Только чтение

Коннектор `src/connector/ym-partner.ts` содержит ТОЛЬКО читающие методы: `campaigns`, `stats/orders`,
`offer-mappings`, `offers`, `offers/stocks`, `reports/*/generate` + `reports/info` + скачивание файла.
Мутирующих вызовов (цены, остатки, заказы, кампании) нет по построению. Ключ живёт в env/Secrets,
в HTML не попадает: сборка статическая из снимков; воркфлоу дополнительно грепает `public/market` на ключ.

## Этапы

| Этап | Что | Как проверить |
|---|---|---|
| 0 | `src/scripts/ym/ping.ts`, воркфлоу `ym-ping.yml` (workflow_dispatch) | Summary запуска: таблица campaignId / тип / домен / businessId + пробный stats/orders за 7 дн |
| 1 | коннектор + продьюсеры `src/scripts/ym/*` -> `data-ym/` в контракте снимков OZON, `platform="ym"`; отчёты через generate/poll/download | `npm test` (derive-lib, table, zip); dry-run на синтетике (ниже) |
| 2 | `src/paths.ts`: `DATA_DIR` / `OUT_DIR` / `PLATFORM` в build-site, build-katya, join-скриптах, smoke; выход `public/market/` | OZON байт-в-байт: `md5sum public/*.html` до/после (гейт есть в ym-snapshots.yml) |
| 3 | `ym-snapshots.yml` (маскировка, дельта-гейт, гейт OZON-md5, гейт «ключ не в HTML»), блок `/market/` в `deploy-pages.yml` | запуск воркфлоу, коммит `data-ym: снимки Яндекс Маркета` |
| 4 | `ym:reconcile` -> `data-ym/reconcile.json`: сверка §15 (реализация, выплаты ЛК, СС), три типа периода, отчёт о покрытии; полоса покрытия и бейджи пробелов на страницах KATYA | Summary запуска + полоса «Сверка §15» вверху каждой страницы /market/ |

## Конвейер (ym-snapshots.yml, ~09:40 МСК)

```
ym:orders      stats/orders по кампаниям -> data-ym/orders.ndjson (факт-слой: строка = позиция заказа;
               инкремент по дате создания + перетяжка хвоста 45 дн по дате обновления)
ym:catalog     offer-mappings / offers / stocks -> data-ym/catalog.json (накопительно)
ym:realization goods-realization {campaignId, year, month} -> realization_monthly.ndjson  (эталон штук, аналог УПД)
ym:netting     united-netting {businessId, dateFrom, dateTo} -> netting.ndjson + netting_summary.json (выплаты ЛК)
ym:shows       shows-sales {businessId, день, grouping: OFFERS} -> sku_views.ndjson (показы/корзина per-SKU по дням)
ym:derive      orders + catalog + views -> history.ndjson, daily_totals.ndjson, skus_live_30d.json, pnl_30d.json,
               pnl_sku_30d.json, pnl_daily.ndjson, pnl_sku_daily.ndjson, pnl_account_daily.ndjson, sku_offer.json,
               ads_30d.json / ads_periods.json / ads_reports.json (заглушки: реклама Маркета не подключена)
validate       дельта-гейт (просадка ключевой метрики >40% - снимок не заменяем), SNAPSHOT_MIN_SKUS=1
ym:join        sku_taxonomy.json, sku_cogs.json (ключ - артикул: SKU Маркета = shopSku = артикул GG)
ym:reconcile   reconcile.json (сверка §15 + покрытие + пробелы по SKU)
ym:build       build-site + build-katya c DATA_DIR=data-ym OUT_DIR=public/market PLATFORM=ym
ym:smoke       jsdom-прогон контролов public/market/*.html
```

## Почему параллельный OUT_DIR, а не фильтр по platform (расхождение с атомом 2)

Атом 2 эпизода говорит «дашборды не переписываются - фильтр по platform». Реализовано иначе: второй
статический сайт `/market/` из отдельного `DATA_DIR=data-ym` той же сборкой. Причина - нулевой риск
для OZON-контура: фильтр по platform означал бы правку клиентского JS обоих шаблонов Кати (5 300 и
2 100 строк) и OZON-страниц, а гейт Этапа 2 требует байт-в-байт. Что теряется: сводного вида по каналам
(OZON + Маркет в одной таблице) пока нет; слот «Яндекс Маркет» в селекторе каналов на страницах
/market/ занят самим Маркетом как «живым» каналом, а OZON там показан как «нет данных». Объединение
в один вид - следующий шаг после первого живого прогона и сверки §15, отдельным решением Ивана:
поле `platform` в обоих `data/` и `data-ym/` уже есть, объединять будет что.

## Контракт данных (атом 1)

Ключ `sku` в `data-ym/` = **артикул (shopSku)**, а не числовой marketSku: так СС и таксономия
(лист СС и таксономия ведутся по артикулу) джойнятся прямым ключом; `market_sku` хранится рядом.
Поля файлов - как у OZON (см. `data/`), плюс `platform: "ym"` в каждом JSON и каждой ndjson-строке.

Семантика денег (`derive-lib.ts`):
- `revenue` (history/skus_live) = «заказано на сумму» по дате создания = Σ типов цен (BUYER + MARKETPLACE +
  CASHBACK + SPASIBO, переопределяется `YM_REVENUE_PRICE_TYPES`) × заказанные единицы, **включая заказы,
  отменённые позже** - тот же смысл, что у revenue в OZON analytics (ordered revenue). Отмены и возвраты -
  в `cancellations` / `returns`, деньги - в `accruals` / `payout`.
  **[ГИПОТЕЗА]** состав типов цен: `ym:reconcile` сверяет начисления закрытого месяца с `amount` отчёта о
  реализации и печатает, какой состав (`best_price_types`) ближе всего - по нему фиксируется
  `YM_REVENUE_PRICE_TYPES` после первого прогона.
- `accruals` / `payout` (pnl_*) = только ДОСТАВЛЕННЫЕ заказы (DELIVERED / PARTIALLY_RETURNED / RETURNED)
  по дате доставки (statusUpdateDate); `payout = accruals − Σ комиссий заказа`; комиссии `actual`,
  где Маркет ещё не закрыл - `predicted` (доля таких строк видна в pnl_30d.predicted_rows и в reconcile).
- Комиссии уровня заказа разнесены по позициям пропорционально начислениям (OZON комплекты не разносит -
  отличие зафиксировано в `pnl_sku_30d.basis`). Группы сборов - те же подписи, что у OZON
  (`FEE_GROUPS`: комиссия / эквайринг / логистика / хранение / продвижение / рассрочка / прочее).
- `pnl_account_daily` **[ГИПОТЕЗА]**: сборы уровня кабинета (плата за размещение, буст вне заказа, штрафы,
  подписки) в `stats/orders` не приходят. Источник - строки отчёта по взаиморасчётам без номера заказа
  (`netting.ndjson`, `order` пуст), разложенные по датам и группам. Пока отчёта нет - нули, и полоса
  покрытия пишет «сборы уровня кабинета: не подключены».
- Реклама: источника нет (рекламный кабинет Маркета не подключён) - `ads_*` заглушки с `note`,
  на дашборде полоса покрытия показывает «реклама: нет источника».

## Definition of Done (CLAUDE.md §15) - статус

Пока не сделан ни один живой прогон (ключ доступен только в Actions), поэтому все числа Маркета -
**[ГИПОТЕЗА]**. Что закрыто кодом и что остаётся:

1. **Сверка с эталоном** - `ym:reconcile` (логика в `reconcile-lib.ts`, тесты рядом):
   штуки - доставлено нетто по заказам vs нетто `goods-realization` (закрытый месяц);
   деньги - «к выплате» по заказам vs выплаты `united-netting` **по номеру заказа** (не по датам: Маркет
   платит с лагом) плюс кумулятив с начала данных; допуск max(50 ₽, 0.5%); строки без номера заказа -
   сборы уровня кабинета, отдельной строкой;
   выручка - начислено vs `amount` реализации с подбором состава типов цен;
   СС - покрытие SKU/оборота листом СС. Результат в `reconcile.json`, Summary воркфлоу и в полосе вверху
   КАЖДОЙ страницы /market/ (и katya-*, и obzor/tovary/money/...). **Вердикт `return`, пока нет отчётов,
   есть расхождения по закрытому месяцу, СС покрывает <90% оборота или в отчётах есть битые ячейки;
   при `return` на страницах крупная плашка «ПРЕДВАРИТЕЛЬНО».**
2. **Три типа периода** - закрытый месяц, его 1-15, текущий месяц: считаются в reconcile по каждому пункту.
3. **Отчёт о покрытии** - `coverage` в reconcile.json + бейджи `⚠ нет СС / нет в таксономии / нет в реализации`
   у затронутых строк (скрипт GAPS_JS ищет артикул в ячейках) + сводка сверху (coverageStrip).

Открытые допущения, которые снимет первый живой прогон (`_probe/*.json` сохраняет заголовки отчётов):
- формат дат `stats/orders` (парсер принимает DD-MM-YYYY и ISO);
- названия колонок CSV-отчётов - `src/scripts/ym/report-columns.json` (regex, править по `_probe`);
- формат файла отчёта (zip/csv/кодировка) - `decodeReport` пробует zip -> utf-8 -> windows-1251; xlsx отвергается
  с понятной ошибкой (запрашиваем `format=CSV`);
- лимит диапазона `stats/orders` (окна по 30 дней) и фильтр `updateFrom` (фолбэк на дату создания).

## Гигиена ключа и данных

- Ключ маскируется первым шагом воркфлоу (до `npm ci`), в лог не печатается даже его длина.
- Перед каждым коммитом `grep -rF` ключа по `public/market` и `data-ym`.
- `_probe/*.json` хранят заголовки отчётов и **маскированные** образцы строк (цифры → 9, буквы → x),
  форму сырого заказа (ключи и типы без значений) - номера заказов и суммы в git не попадают.
- Бюджет отчётов за прогон `YM_REPORT_BUDGET` (10 по умолчанию), факт-слой заказов коммитится
  промежуточным шагом до отчётов, чтобы обрыв отчётов не терял выкачанные заказы.

## Локальный dry-run без ключа (синтетика, в data-ym не пишет)

```
S=/tmp/ym-dry; export YM_DATA_DIR=$S/data
npx tsx src/scripts/ym/dryrun.ts && npx tsx src/scripts/ym/derive.ts
DATA_DIR=$S/data PLATFORM=ym npx tsx src/scripts/build-taxonomy-join.ts
DATA_DIR=$S/data PLATFORM=ym npx tsx src/scripts/build-cogs-join.ts
npx tsx src/scripts/ym/reconcile.ts
DATA_DIR=$S/data OUT_DIR=$S/public PLATFORM=ym npx tsx src/scripts/build-site.ts
DATA_DIR=$S/data OUT_DIR=$S/public PLATFORM=ym npx tsx src/scripts/build-katya.ts
OUT_DIR=$S/public npx tsx src/scripts/smoke.ts
```

## Что НЕ меняется

- `data/`, `fixtures/`, `public/*.html` (OZON): гейт md5 в ym-snapshots.yml, проверка diff до/после в Этапе 2.
- Логика OZON-продьюсеров и n8n-миграция (`MIGRATION_n8n.md`).
- `CLAUDE.md` (нужен ФЕНИКС-approval): при принятии дашборда добавить в §14 строку про `data-ym/`.
