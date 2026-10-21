# Передача: дашборд OZON GENGLASS - сборщики, хранение, прогресс (21.10.2026)

> Файл самодостаточный. Новый аккаунт Claude читает его первым и подхватывает работу с первого запуска.
> Владелец данных и решений - Иван Раюшкин (CMO). Язык работы - русский, только дефис (U+2014 запрещён).

## 0. Первый запуск (сделать по порядку)

1. Склонировать репозиторий `oliverjone01-dev/t1` (GitHub, private), рабочая папка проекта - `analytics-mvp/`.
2. Прочитать `CLAUDE.md` в корне (правила системы, ФЕНИКС, Protocol 9, HITL), затем этот файл целиком.
3. Проверить состояние:
   ```
   git fetch origin main claude/amazing-hawking-0trncq
   git log --oneline -3 origin/main
   gh pr view 492 --json state,mergeable   # или GitHub MCP / REST, GraphQL из облака закрыт
   gh run list --workflow orders-backfill.yml --limit 3
   ```
4. Установить зависимости и прогнать тесты (только из `analytics-mvp`, в foreground):
   ```
   cd analytics-mvp && npm ci && timeout 550 npx vitest run    # ожидание: 70 файлов, 1191 тест, все зелёные
   ```
5. Сказать Ивану одной строкой: «PR #492 (сборщик заказов) ждёт слова мерж» или что изменилось.
6. Любая работа с цифрами начинается со скилла `.claude/skills/data-guard` (pre-mortem, спека, проба, инварианты, сверка, ФЕНИКС).

## 1. Где что лежит

| Что | Где |
|---|---|
| Репозиторий | `https://github.com/oliverjone01-dev/t1`, ветка по умолчанию `main` |
| Код дашборда OZON | `analytics-mvp/` (TypeScript, Node 22, tsx, vitest) |
| Коннектор Seller API | `analytics-mvp/src/connector/ozon-seller.ts` |
| Коннектор Performance (реклама) | `analytics-mvp/src/connector/ozon-performance.ts` |
| Сборщики | `analytics-mvp/src/scripts/ozon/*.ts` |
| Билдеры страниц | `analytics-mvp/src/scripts/build-katya.ts` (все katya-*), `build-tests.ts` + `plan-tab.ts` (Тесты, План), `build-site.ts` (главная), `build-reakciya.ts`, `build-boost.ts`, `report-page.ts` |
| Данные (снимки, история) | `analytics-mvp/data/*.ndjson`, `*.json` - коммитятся ботом в main |
| Сгенерированные страницы | `analytics-mvp/public/*.html` (не править руками, только через билдер) |
| Сайт | GitHub Pages: `https://oliverjone01-dev.github.io/t1/` (страницы OZON: `katya-tests.html`, `katya-money.html`, `katya-report.html`, `katya-tovary.html`, `katya-voronka.html`, `katya-marketing.html`, `katya-reakciya.html`, `katya-boost.html` и др.) |
| Съём кабинета (мак) | `analytics-mvp/tools/reakciya/` (README.md, КАБИНЕТ_эндпоинты.md, build.py), памятка `knowledge/episodes/2026-10/ozon-testy-dannye-dlya-chata.md` |
| Ручные выгрузки xlsx | `analytics-mvp/tools/{accruals,cpo,delivery,orders,exports}/*.py` |
| Решения | `knowledge/decisions.md` (не пересматривать без новой записи) |
| Спеки метрик OZON | `knowledge/semantic/metrics/ozon-*.yaml` |
| Пробы API | `knowledge/semantic/probes/` (последняя: `ozon-posting-list-v3-v4.md`) |
| Реестр ошибок | `knowledge/errors/registry.jsonl` |
| Подвохи API | `.claude/skills/data-guard/references/api-gotchas.md` |
| Аудиты ФЕНИКСА | `knowledge/episodes/2026-10/feniks-audit-ozon-*.md` |
| История сессий цепочки | `sessions/handoff/2026-10-*-ozon-*.md` (последний перед этим: `2026-10-20-ozon-testy-plan-tab-v20.md`) |

## 2. Ключи (GitHub → Settings → Secrets and variables → Actions)

Значения GitHub не показывает. На новом месте их вводят заново из кабинетов OZON.

| Секрет | Откуда | Кто использует |
|---|---|---|
| `OZON_SELLER_CLIENT_ID`, `OZON_SELLER_API_KEY` | seller.ozon.ru → Настройки → Seller API | orders-backfill, ozon-snapshots |
| `OZON_PERF_CLIENT_ID`, `OZON_PERF_SECRET` | performance.ozon.ru → API | ozon-snapshots (реклама) |
| `GITHUB_TOKEN` | встроенный | orders-backfill запускает ozon-snapshots |

В облачной сессии Claude ключей OZON нет: сборщик локально не запустить. Проверка - прогон workflow на ветке (`gh workflow run orders-backfill.yml --ref <ветка>`), ошибка и форма ответа читаются аннотациями: `gh api repos/oliverjone01-dev/t1/actions/runs/<id>/jobs --jq '.jobs[0].id'` → `gh api repos/oliverjone01-dev/t1/check-runs/<job>/annotations`. Логи прогонов из облака отвечают 403.

## 3. Плановые сборщики: что, когда, куда

Цепочка за день: **мак съёмом кабинета коммитит `data/reakciya.json` в main (утро ~07:50 МСК, вечер ~20:50) → push запускает `orders-backfill` → он по окончании запускает `ozon-snapshots` → `deploy-pages` собирает сайт (workflow_run)**. Cron - страховка.

### 3.1 `.github/workflows/orders-backfill.yml`
- Триггеры: push `analytics-mvp/data/reakciya.json` в main; cron `52 4 * * *` (07:52 МСК); workflow_dispatch (from/to).
- Шаги и файлы:

| Шаг | Скрипт | Файл | Методы OZON |
|---|---|---|---|
| Сбор по заказам (падение рвёт прогон) | `ozon/orders-daily.ts 2026-02-06 ""` | `orders_daily.ndjson`, `orders_accrual_types.json` | `/v3/posting/fbo/list`, `/v4/posting/fbs/list`, `/v1/finance/accrual/types`, `/v1/finance/accrual/postings` |
| Финансы по SKU (continue-on-error, 3 попытки) | `ozon/pnl-sku-accrual-daily.ts` | `pnl_sku_accrual_daily.ndjson` | postings + accrual/postings |
| Эквайринг, хранение по SKU | `ozon/acq-sku-daily.ts` | `acq_sku_daily`, `buyer_delivery_daily/_orders`, `partner_daily/_orders` | `/v1/finance/accrual/by-day` |
| Канальный P&L, общие расходы | `ozon/pnl-accrual-daily.ts` | `pnl_channel_accrual_daily`, `pnl_account_accrual_daily(+_types)` | accrual/by-day, postings |
| Реализация за месяц | `npm run pnl:realization` | `realization_monthly.ndjson` | `/v2/finance/realization` (готов с 5-го числа) |
| Реализация за день | `ozon/realization-daily.ts 31` | `realization_daily.ndjson` | `/v1/finance/realization/by-day` (премиум, OZON хранит 32 дня) |
| Калибровка соинвеста | `npm run coinv:calib` | `coinv_calibration.json` | без сети |
| Коммит в ветку запуска, затем запуск ozon-snapshots (кроме workflow_dispatch) | | | |

### 3.2 `.github/workflows/ozon-snapshots.yml`
- Своего cron нет с 16.10, запускается из orders-backfill. Группа concurrency `ozon-data` общая.
- Живые шаги: `backfill` → `history.ndjson`; `totals:daily` → `daily_totals`; `views:daily` → `sku_views`; `prices:daily` → `prices_daily`; `ads-daily.ts` → `ads_daily`; `ad-attribution-daily.ts` → `ads_attr_daily`; `ads:sku:daily` → `ads_sku_daily(+state)`; `ads.ts` → `ads_30d.json`, `ads_periods.json`; `skus.ts` → `skus_live_30d.json`; `offer:sku` → `sku_offer.json`; `cards:api` → `card_groups.json`; `plan:fetch` (Google-таблица CSV) → `plan_monthly.json`; `join:cogs` → `sku_cogs.json`; затем `build:site`, `katya`, коммит, «Итог синка».
- **Мёртвые шаги** (OZON отключил `/v3/finance/transaction/list` 08.09, ответ 400 code 9; ошибка уходит в warning): `pnl-sku.ts`, `pnl.ts`, `pnl-daily.ts`, `pnl:sku:daily`, `pnl:account:daily`, `pnl-sku-breakdown.ts`. Файлы `pnl_30d.json`, `pnl_sku_30d.json`, `pnl_daily`, `pnl_sku_daily`, `pnl_account_daily` заморожены на 07.09.

### 3.3 `.github/workflows/deploy-pages.yml`
- workflow_run после «OZON snapshots» (и других площадок) + cron `47 9 * * *`. Собирает `analytics-mvp/public` (`fetch:live`, `build:site`, `katya`, `smoke`) в `_site/`.

### 3.4 `.github/workflows/analytics-tests.yml`
- vitest + smoke на pull_request и push в main по `analytics-mvp/**`. Литерал `[skip ci]` в сообщении головного коммита отключает его (E092): в прозе писать «без пропуска CI».

### 3.5 Мак (не GitHub, рутины Ивана; не трогать)
- Чат Claude на маке снимает seller.ozon.ru в Chrome (company_id 3971004) 07:00-08:30 и 20:00-22:00 МСК, коммитит в main напрямую: `gap_daily`, `boost_daily`, `acts_daily`, `store_moves`, `coinv_daily`, `cpo_sku_status`, `eb_daily`, `funnel_tests`, `cabinet_orders_check`, `reakciya.json`. Ключ строки и правила замены - в `knowledge/episodes/2026-10/ozon-testy-dannye-dlya-chata.md`. Кабинет только читать.
- `coinv_daily` (стоит с 24.09) и `cpo_sku_status` (с 17.09) помечены «возобновить».

### 3.6 Ручные выгрузки (автоматики нет)
| Файл | Последний день | Источник |
|---|---|---|
| `delivery_*` | 04.10 | ведомость доставки, `tools/delivery/*.py` |
| `cpo_orders`, `cpo_sku_daily` | 30.09 | `tools/orders/build_order_joins.py`, `tools/cpo/build_cpo_sku_daily.py` |
| `order_accruals`, `acct_multi_acq_daily`, `payout_orders` | август / 04.09 / 31.08 | `tools/accruals/*.py` |
| `funnel_sku_daily` | 21.09 | разовая выгрузка |
| `promo_daily` | 23.09 | из снимков |
| `closed_pnl.json` | 30.04 | писателя в репо нет |

## 4. Свежесть данных на 21.10.2026 (main)

- Свежие (по 20-21.10): цены, разрыв, соинвест, акции, буст, история продаж, воронка, реклама.
- **Стоят на 18.10**: `orders_daily`, `acq_sku_daily`, `buyer_delivery_daily`, `realization_daily`, `pnl_channel_accrual_daily`, `pnl_account_accrual_daily`. Причина - отключение `/v2/posting/fbo/list` 19.10; чинит PR #492 (раздел 5).
- `pnl_sku_accrual_daily` кончается 15-16.10: строка пишется только по доставленным заказам с датой заказа, последние дни всегда тонкие (не баг сборщика, свойство базиса).
- Заморожены на 07.09 - см. 3.2 «мёртвые шаги».

## 5. Открытый PR #492 - сборщик заказов (главное незакрытое)

- Ветка `claude/amazing-hawking-0trncq`, голова `eb089e0`, CI зелёный, конфликтов нет, ФЕНИКС iter2 **go 8,25** на хеш `54b178d79b62635b` (`python3 -I .claude/skills/data-guard/scripts/audit_hash.py --rev HEAD`).
- Что сделано: списки отправлений на `/v3/posting/fbo/list` и `/v4/posting/fbs/list` (курсор, страница 100, `sort_dir`), fail-closed на ответ без списка или `has_next`; цена и `customer_price` - объект `{amount, currency}` → `moneyOf`; инварианты перед записью `checkRows` (order уникален, заказы прошлого файла не пропадают, строки, выручка и paid по FBO и FBS не меньше 99%); ошибка и форма ответа в аннотациях прогона.
- Сверка: файл main (v2, 3 881 строка по 18.10) против v3/v4 (3 905 по 19.10) - пропавших 0, добавлено 24 за 19.10, деньги у всех общих заказов совпали, выручка по месяцам 02-09 до рубля.
- В ветке лежат данные прогона на ветке (бот, коммит 43cd2db) - это нормально, после squash уйдут в main.
- **Мерж только по слову Ивана «мерж»**. Если голова изменится - новый хеш и подтверждение ФЕНИКСА (iter3).
- После слияния: дождаться зелёного orders-backfill на main, в аннотациях «форма постинга FBO/FBS», FBO в файле не меньше 34, на странице «Тесты → План» «заказы по <вчера>». Если прогон красный с «ответ без списка отправлений или has_next» - риск R1 ФЕНИКСА: разрешить отсутствие `has_next` только на неполной странице.
- После squash: `git fetch origin main && git checkout -B claude/<ветка> origin/main` (E045).

## 6. Бэклог (по приоритету)

1. **Мерж #492** (ждёт Ивана).
2. **Следующий PR по ФЕНИКСУ #492 §8:** построчный инвариант `units > 0 ⇒ revenue > 0` (A5i); выход 1 без ключей OZON в CI; инварианты в `pnl-sku-accrual-daily.ts` и `pnl-accrual-daily.ts`; форма FBS в аннотации частями (сейчас обрезана на 1 500); P4 (FBS без `in_process_at` берёт дату отгрузки); P5 (`moneyOf` 0 вместо null).
3. **Мёртвые шаги transaction/list** в ozon-snapshots: убрать или заменить; водопад и главная (`pnl_30d`) сидят на снимке 09.08-07.09, страница об этом не пишет; подпись `site.ts:407` про transaction/list; страж `pnlStale` отключён (`build-katya.ts:2924`).
4. **Полный и неполный период** (найдено 21.10, не правилось, Иван сказал «стоп»):
   - прогноз «Общих расходов» `build-katya.ts:3532-3536`: `k = totalDays/elapsed` по последнему дню начислений, недогруженный вчерашний день занижает run-rate;
   - OZON текущий месяц `build-katya.ts:3649`: `amtReal += amtNet` без фильтра выкупа, «висящие» начисления идут в прибыль (у Маркета фильтр есть, комментарий 3634-3638 обещает обратное);
   - плашка «месяц неполный» (`report-page.ts:167,242`) от последнего дня истории, а деньги по SKU кончаются раньше;
   - граница FIN_CUT (`build-katya.ts:2201-2207`) берётся с конца мёртвого `pnl_sku_daily` - любая правка файла молча сдвинет базис;
   - `realization_daily` хранится OZON 32 дня - пропуск сбора больше месяца необратим;
   - эталон §15 `knowledge/os/analytics-dod.md` ссылается на мёртвый `pnl_daily`, живой аналог - `pnl_channel_accrual_daily`.
   Правила §15: проверять итоги на трёх типах периода (закрытый месяц, часть месяца, текущий месяц), показывать покрытие.
5. **Иван решает:** E021 третий случай - ежедневный canary-вызов методов списков (рекомендовано, limit 1 в ozon-snapshots) или хук; исключить `.claude/agent-memory/` из audit_hash (сейчас запись памяти ФЕНИКСА в ветку меняет хеш и снимает go); цвет Δ в разделе 5 «Плана» (ФЕНИКС #490: красить только при значимом отличии от темпа магазина, решить до 22.10); строка «снято вручную» (#489); ветка `claude/brave-euler-uukpb6` (память ФЕНИКСА и пороги pereezd) - слить отдельным PR.
6. Проверка плана 29.10 (вкладка «План», спека `knowledge/semantic/metrics/ozon-plan-15-10.yaml`).
7. Директ не трогать (Иван 21.10: «директ не нужно», «только по дашборду озон»).

## 7. Решения, которые не пересматривать

- Мерж только по слову Ивана «мерж» и после go ФЕНИКСА на хеш головы; после влития main - короткое подтверждение ФЕНИКСА.
- «Чини сборщик» (20.10) - прямое поручение, правка кода сборщика разрешена; мутаций кабинета OZON нет, только чтение API.
- Раздел 5 «Плана» (20.10): только смены цены, заказы по артикулу 01-14.10 и с 15.10, Δ шт/нед; допущения в decisions.
- Заказы по дате заказа, день по Москве (t + 3 ч); день, обрезанный выгрузкой, отбрасывается.
- База налога OZON - «Реализовано» отчёта о реализации (F + G - J - K), за незакрытый месяц - отчёт за день (Иван 25.09).
- Сбор заказов полный, от 06.02.2026 до вчера, каждый день (доначисления подтягиваются сами).
- Все решения с датами - `knowledge/decisions.md`.

## 8. Грабли

- OZON отключает методы без предупреждения в доке, ответ HTTP 400 `{"code":9,"message":"obsolete method cannot be used"}` (08.09 transaction/list, 19.10 posting/fbo/list). Анонсы - Telegram @OzonSellerAPI; из облака docs.ozon.ru, dev.ozon.ru и t.me не открываются.
- Новый контракт OZON проверять пробой формы ответа, а не по сторонним клиентам: в v3/v4 деньги стали объектом, первый прогон дал выручку 0 при верном числе строк.
- Workflow сбора на рабочей ветке коммитит данные в эту ветку (К12); снимки только на main.
- Фоновый Bash не применяет `cd`: vitest запускать в foreground из `analytics-mvp`.
- ФЕНИКС аудирует рабочее дерево: пока он работает, файлы ветки не править; трейсы и отчёты коммитить пачкой (E047).
- `gh pr create` из облака не работает (GraphQL 403): PR через GitHub MCP `create_pull_request` или REST.
- После рестарта контейнера git теряет учётные данные: `add_repo` (access push).
- Чек-ины (send_later): 50 мин, потом 4 ч, с 23:00 до 08:00 МСК не ставить, 3 пустых - стоп.
- Переезд в новую сессию: скилл `pereezd` с ~400K контекста, Иван просил порог 500K.

## 9. Как Иван любит работать

По-русски, коротко. Вопросы через AskUserQuestion с вариантом «(рекомендую)». Цифры объяснять простыми словами: где на странице и что это дало. Self-check строго 25 пунктов (`knowledge/feniks/eval-checklist.md`). Только дефис. Не писать «выглядит хорошо», «отлично подойдёт».

## 10. Перенос на другой аккаунт GitHub (если репозиторий меняет владельца)

Пошагово - `HANDOFF.md` в корне (вариант B «только OZON-аналитика»: `analytics-mvp/` + workflows `orders-backfill.yml`, `ozon-snapshots.yml`, `deploy-pages.yml`, `analytics-tests.yml`). Ключи из раздела 2 вводятся заново, Actions и Pages включаются вручную, рутина мака перенастраивается на новый репозиторий (путь репо в промпте съёма).
