# Roistat API: что реально отдаёт наш проект

Снято разведчиком `roistat/probe.mjs` 30.09.2026, run 36677111817. Ключ `ROISTAT_API`
(32 символа), проект `ROISTAT_PROJECTID`. Все ответы приходят с кодом HTTP 200:
отказ лежит внутри тела в полях `status`, `error`, `description`. Проверять код
ответа недостаточно, надо смотреть тело.

База: `https://cloud.roistat.com/api/v1`. Авторизация - ключ в строке запроса
(`?key=<ключ>&project=<id>`). Заголовок `Api-key` работает не везде, поэтому
загрузчик использует только query.

## Работает, данные идут

| Метод | Что отдаёт | Поля |
|---|---|---|
| `POST /project/analytics/metrics-new` | справочник метрик, 217 | `name`, `title`, `group`, `type`, `formula`, `is_has_attribution_model`, `is_available`, `custom_metric_id` |
| `POST /project/analytics/dimensions` | справочник разрезов, 651 | `name`, `title`, `group`, `is_customizable`, `is_filtration_disabled` |
| `POST /project/analytics/source/list` | рекламные каналы, 1079 | `source`, `title`, `type` (system/custom), `level`, `icon` |
| `POST /project/integration/order/list` | сделки | `id`, `revenue`, `profit`, `cost`, `status`, `creation_date`, `update_date`, `client_id`, `visit_id`, `roistat`, `custom_fields`, `is_multichannel`, `visit`, `products`, `source_type`, `url` |
| `POST /project/site/visit/list` | визиты | `id`, `first_visit_id`, `date`, `landing_page`, `host`, `ip`, `device`, `geo`, `source`, `cost`, `order_ids`, `roistat_param1..5`, `roistat_params`, `metrika_client_id`, `google_client_id`, `gclid`, `ab_test`, `fbc`, `fbp` |
| `POST /project/integration/status/list` | статусы сделок, 52 | `id`, `name`, `type` (`progress` / `paid` / `canceled`) |

## Отказы и их причина

| Метод | Ошибка | Что это значит |
|---|---|---|
| `/project/analytics/data` | `request_data_validation_error`: `Metric 'visitsCount' is invalid` | Метод доступен. Имена метрик я задал по памяти, они неверные. Брать имена из справочника метрик |
| `/project/statistics/get-daily` | `incorrect_request`: `Argument period is not a valid date interval` | Метод доступен, формат периода другой. Уточнить по документации |
| `/project/integration/lead/list` | `resource_not_found` | Такого пути нет. Заявки приходят внутри сделок и визитов либо лежат по другому адресу |
| `/project/integration/call/list` | `resource_not_found` | Такого пути нет. Про звонки коллтрекинга спрашивать отдельно |
| `/project/integration/costs/list` | `resource_not_found` | Такого пути нет. Расходы брать метрикой в `analytics/data`, а не отдельным списком |
| `/project/site/visit/list` заголовком `Api-key` | `request_limit_error` | Не права, а лимит запросов. У API есть rate limit, синк делать бережно, с паузами и повтором |

## Наша воронка уже внутри Ройстата

В справочнике метрик 33 пользовательских показателя повторяют воронку Битрикса.
Это значит, что выручку и стадии можно получить в разрезе рекламного канала
без склейки на нашей стороне.

| Метрика | Что считает |
|---|---|
| `custom_1` … `custom_12` | стадии от «Новые заявки» до «Закрыто не реализовано» |
| `custom_13`, `custom_14`, `custom_15` | рабочие, оплаченные, результирующие стадии |
| `custom_16` … `custom_26` | выручка по стадиям и прогнозируемая выручка |
| `custom_27` … `custom_33` | лиды Б24 по статусам, включая отказ, спам и дубль |

Деньги и товары из штатных групп: `payment_average_revenue`, `payment_net_cost`,
`payment_profit`, `payment_marginality_rate`, `payment_first_sales`,
`payment_repeated_sales*`, `products_revenue*`, `products_profit*`, `products_roi`.
Часть метрик поддерживает модель атрибуции (`is_has_attribution_model`): одна
сделка даёт разные ответы на вопрос «чей это канал» в зависимости от модели.

## Разрезы, пригодные для маркетингового дашборда

- источник по уровням: `marker_level_1` … `marker_level_7`;
- метки: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `roistat_param1..50`;
- страница и площадка: `host`, `landing_page`, `referrer`, `referrer_host`;
- аудитория: `country`, `region`, `city`, `device`, `browser`, `os`;
- реклама: `ad_position_type`, `ad_position`, `search_phrase`;
- время: визит `daily`/`weekly`/`monthly`, заявка `order_creation_day|week|month|week_day|hour`, продажа `order_paid_daily|weekly|monthly|week_days|hours`;
- поля сделки `order_field_1..112`: статус, воронка, бюджет, менеджер, теги, плюс группы расчёта себестоимости, доставки, розничной цены, прибыли и рентабельности.

## Что закрывает подключение Ройстата

Цифра 11% в `kontur-dashboard/tools/build_data.py:463` до сих пор помечена
`[ГИПОТЕЗА]` с пояснением «со слов команды (Roistat GENGROUP, D2C), выгрузки в
репозитории нет». Разрез `marker_level_1` с метриками выручки переводит её в
`[ДАННЫЕ]`.

## Что выяснить до загрузчика

1. Точные имена метрик визитов, заявок и расходов - взять из справочника
   (`analytics/data` ждёт их, а не угаданные).
2. Формат `period` для `analytics/data` и `statistics/get-daily`.
3. Лимит запросов: сколько можно в минуту, чтобы ночной синк не ловил
   `request_limit_error`.
4. Звонки коллтрекинга: есть ли метод чтения или только внутри визита.
