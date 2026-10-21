# OZON Seller API: списки отправлений /v3/posting/fbo/list и /v4/posting/fbs/list

- **Дата проверки:** 2026-10-20, прогоны orders-backfill на ветке claude/amazing-hawking-0trncq: 39439059890 (ошибка v2), 39439844466 (v3/v4, цена как число - выручка 0), 39441351008 (v3/v4, moneyOf - сошлось).
- **Повод:** с 19.10.2026 ~10:00 UTC `/v2/posting/fbo/list` отвечает HTTP 400 `{"code":9,"message":"obsolete method cannot be used"}` (та же формула, что при отключении transaction/list 08.09, см. `knowledge/episodes/2026-09/ozon-finance-api-migration-20260916.md`). Прогон 19.10 04:50 UTC ещё проходил. Официальной страницы с датой отключения из облака не найти (docs.ozon.ru, dev.ozon.ru, t.me недоступны из сессии); сторонние клиенты (gam6itko/ozon-seller V3/Posting/FboService, V4/Posting/FbsService; HRAKEH/seller_analytics_bot PR #5 от 30.09.2026) уже на v3 FBO и v4 FBS.

## Запрос (обе схемы одинаковы)
```
POST /v3/posting/fbo/list   |   POST /v4/posting/fbs/list
{ "cursor": "", "filter": { "since": "2026-02-06T00:00:00.000Z", "to": "2026-10-19T23:59:59.999Z" },
  "limit": 100, "sort_dir": "asc", "translit": false, "with": { "financial_data": true } }
```
- Пагинация курсором: ответ `{postings: [...], has_next: bool, cursor: string}`, следующий запрос с этим `cursor`. `offset` и `dir` из v2 не используются. Страница до 100 (сторонние клиенты; 1000 из v2 не проверялась).
- Окно 06.02-19.10 (8,5 месяцев) принято: 3 905 отправлений, 40 страниц FBO+FBS, шаг «Сбор по заказам» 32 с в итоговом прогоне 39441351008 (73 с - прогон 39439844466 с нулевой выручкой; 71 с на v2). Ограничение периода не задето.
- Rate limit: 429 не ловился за 3 прогона; у коннектора повторы withRetry (5, 1-30 с).
- Дата фильтра: по дате заказа (in_process_at), UTC, как в v2 - проверено совпадением строк по дням.

## Форма ответа (имена полей и типы, аннотация прогона 39441351008)
- FBO posting: `posting_number, order_id, order_number, status, substatus, cancellation, products:[{offer_id, name, sku:number, quantity, price:{amount:string, currency}, ...}], financial_data:{products:[{payout, product_id, old_price, price:number, total_discount_value, total_discount_percent, actions, commission:{amount, percent, currency}}], cluster_from, cluster_to}, created_at, in_process_at, ...`
- FBS posting: то же плюс `delivery_method, delivery_schema, tracking_number, shipment_date, in_process_at` (без `created_at`), `products[].price:{amount:string, currency}`, `financial_data.products[]` дополнительно `quantity` и `customer_price:{amount:string, currency}`.
- **Отличие от v2:** `products[].price` и `financial_data.products[].customer_price` - объект `{amount, currency}`, не число. Чтение как число даёт 0: прогон 39439844466 - 3 905 строк, revenue 0 и paid null у всех. Теперь `moneyOf()` в коннекторе читает число, строку и объект.
- У FBO в `financial_data.products[]` нет `customer_price` и `quantity` - как и в v2 (paid у 34 FBO-заказов всегда null).

## Эталон (сверка старого и нового контракта)
Файл `orders_daily.ndjson` с main (v2, по 18.10, 3 881 строка) против сбора v3/v4 (по 19.10, 3 905 строк): пропавших заказов 0, добавлено 24 (все за 19.10, по дням 15-19.10: 19, 18, 25, 25, 24); у 3 881 общих заказов revenue, paid, units, sku, offer, d, t совпали у всех; выручка по месяцам 02-09.2026 совпала до рубля; изменились только status (72), начисления (commission 21, other 22, delivery 9) и scheme (13 FBS -> rFBS по новым realFBS-начислениям) - обычные дневные обновления. Семейство источников одно (API OZON), это проверка контракта, не денежная сверка.

## Пусто, 0, ошибки
- Нет отправлений в окне: `postings: []`, `has_next: false` (по сторонним тестам; в наших прогонах не встречалось).
- `has_next: true` без нового курсора - коннектор бросает ошибку (бесконечный цикл исключён).
- 4xx кроме 429 не повторяются; текст ошибки OZON уходит в `::error::` аннотацию прогона без ключей кабинета.
