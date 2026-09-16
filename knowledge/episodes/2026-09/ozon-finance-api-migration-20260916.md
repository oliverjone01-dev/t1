# Миграция финансов OZON: /v3/finance/transaction/list -> /v1/finance/accrual/* (2026-09-16)

## Что случилось
OZON **08.09.2026** отключил `/v3/finance/transaction/list` (HTTP 400 `{"code":9,"message":"obsolete method cannot be used"}`).
Ночной синк падал на нём (шаг «Снимки напрямою», `pnl-sku.ts`+`pnl.ts` под `set -e`) -> замерзали все данные
на 08.09. **Устранено** (PR #339 + коммит e2de629): финансовые продьюсеры сделаны «мягкими», синк
догоняет продажи/историю/рекламу и не молчит при пустом прогоне (гейт «Итог синка»).

Осталась **миграция самих финансов** (деньги: К выплате, сборы, per-SKU финансы) на новые методы.

## Схема новых методов (снята probe `accrual-probe.ts`, окно август 2026)

### POST /v1/finance/accrual/types  (справочник, 124 типа)
Тело `{}`. Ответ: `{accrual_types:[{id,name,description}]}`. Ключевые id -> категория дашборда:
- **69** SaleCommission (Вознаграждение за продажу) -> **комиссия**
- **1** Acquiring (Эквайринг) -> **эквайринг**
- **32** Logistic, **29** LastMileCourier, **59** ReturnFlowLogistic, **28** LastMile, **45** PickUpPointReturnAcceptance -> **логистика/доставка/возвраты**
- **46** Placements (склады) -> **хранение**
- **41** PayPerClick, **54** Promotion, **75** Stencil (Трафареты), **33** Marketing, **49** PremiumCashbackPromotion, **87** SocialMediaAdvertising -> **реклама**
- **62** RfbsClientDeliveryCharge, **124** RfbsBuyerDelivery -> **доставка от покупателя** (компенсируется)
- **51/52** Premium подписки, **89-94** Defect fines (штрафы), и т.д.
(полный список 124 - в логах probe run #136; при реализации выгрузить в `data/accrual_types.json`.)

### POST /v1/finance/accrual/postings  (начисления по отправлениям, per-SKU)
Тело: `{posting_numbers:[...]}` (1..200 номеров за запрос). Ответ:
```
{posting_accruals:[{ posting_number, accruals:[
   {type_id, accrued:{amount:"-316",currency:"RUB"}, accrual_date:"2026-08-25", seller_price:null, sku:3492813785, quantity:1}
]}]}
```
**Даёт сборы по SKU и типу** (для pnl-sku / pnl-sku-daily). Номера отправлений - из `/v2/posting/fbo/list`
и `/v3/posting/fbs/list` за период (batching по 200).

### POST /v1/finance/accrual/by-day  (все начисления за один день) - ЛУЧШИЙ источник сборов
Тело: `{date:"YYYY-MM-DD"}` (строго 10 символов, один день; пагинация `last_id`). Ответ:
```
{accruals:[{ accrual_id, date, total_amount:{amount,currency}, unit_number,
   accrued_category:"ITEM|NON_ITEM", posting,
   item_fees:{fees:[{sku, fees:[{type_id, accrued:{amount}}]}]},   // для ITEM: per-SKU per-type
   non_item_fee:{type_id, accrued:{amount}},                        // для NON_ITEM: кабинетный сбор
   container_fees }], last_id}
```
ITEM-пример: `item_fees.fees=[{sku:3492822125, fees:[{type_id:1, accrued:{amount:"-385.04"}}]}]` (эквайринг по SKU).
**Даёт per-день/per-SKU/per-type сборы** (ITEM -> pnl-sku-daily; NON_ITEM -> pnl-account-daily). Один вызов на день,
итерировать даты периода. Это заменяет разбор services[] старого transaction/list.

### Выручка (в accrual/* её НЕТ) - источники
- `/v2/finance/realization {month,year}` - авторитетная бухгалтерская выручка/УПД (уже собирается pnl-realization).
- `/v2/posting/fbo|fbs/list with:{financial_data:true}` -> `financial_data.products[]:{product_id(sku), price,
  commission_amount, commission_percent, payout, old_price, total_discount_value}`. ВНИМАНИЕ: в примере payout=0,
  commission_amount=0 - financial_data отражает цену на момент ЗАКАЗА, не расчётную к выплате. Для сверки к выплате
  опираться на реализацию (закрытый месяц) + сборы из accruals, financial_data - только цена/скидка.

## Главный нюанс (почему это не «поменять URL»)
Старый `transaction/list` отдавал в одной операции И выручку за продажу (`accruals_for_sale`), И комиссию,
И услуги, И `items[{sku}]`. Новые `accrual/*` несут **только сборы/услуги** (все 124 типа - платежи), а
**выручку за продажу отдельно нет**. Значит финмодель пересобирается из ДВУХ источников:
- **выручка / начислено за продажу** -> из `/v2/finance/realization` (уже используется pnl-realization) или
  `financial_data` отправлений (`posting/fbo|fbs/list` with financial_data, поле price/payout по SKU);
- **сборы** (комиссия/логистика/эквайринг/хранение/реклама/доставка) -> из `accrual/postings` (по SKU) и
  `accrual/by-day` (дневной срез уровня кабинета).

Потребители читают из операции: `amount, accruals_for_sale, sale_commission, delivery_charge,
return_delivery_charge, services[], items[{sku}], operation_date, operation_type_name`.

## План миграции (порядок)
1. Коннектор: `accrualTypes()`, `accrualPostings(nums[])`, `accrualByDay(date)`, `postingNumbers(from,to)`
   (FBO+FBS). Выгрузить `data/accrual_types.json` + карта `typeBucket(type_id)` в отдельном модуле.
2. Адаптер `transactionsFromAccruals(from,to)` -> та же форма operations, что ждут потребители (выручка из
   realization/financial_data + сборы из accruals, разложенные по bucket -> services/commission/delivery).
   Тогда pnl-sku / pnl-daily / pnl-sku-daily / pnl-account-daily / pnl-sku-breakdown правятся минимально.
3. **§15 обязательная сверка** на закрытом месяце (август 2026, есть старые pnl_* до отключения): новые
   pnl_daily / pnl_sku должны совпасть со старыми в пределах округления; расхождение - с причиной. Только
   после этого включать в синк вместо «мягких» заглушек.

## Сверка августа (§15, reconcile new by-day vs old pnl_sku_daily) - КРИТИЧЕСКАЯ НАХОДКА
Прогон `pnl-accrual-reconcile.ts` за 2026-08 (2485 начислений by-day) против старого pnl_sku_daily:
- **acquiring -143 233 vs -141 005 (Δ 1.6%)** и **storage -14 181 vs -14 181 (Δ 0%)** - СОШЛИСЬ. Карта
  категорий (accrual-buckets) и интеграция by-day верны.
- **commission: новый 0 vs старый -9 055 751** - by-day НЕ несёт комиссию за продажу (type 69).
- **delivery: -3 790 vs -229 648** - by-day несёт только сервисную логистику, не логистику продаж.
- **ads -2 320 481** - by-day отдаёт рекламу (PayPerClick/Promotion/Stencil); осторожно с двойным
  счётом против Performance API (AN_ADSSKU).

ВЫВОД: **источник сборов по продаже (комиссия+логистика) - `accrual/postings` (по отправлениям),
НЕ by-day.** by-day - только кабинетные/сервисные (эквайринг/хранение/подписки/реклама). Наивная
миграция на by-day обнулила бы -9 млн комиссии. Сверка поймала это до выката (ценность §15).

## Уточнённый план (после сверки)
1. Собрать номера отправлений периода (posting/fbo|fbs/list) -> `accrualPostings(nums)` для комиссии +
   логистики продаж по SKU (там type 69 и пр.). by-day - для кабинетных сборов (NON_ITEM) и эквайринга/хранения.
2. Выручку - из реализации (УПД, закрытый месяц) / financial_data (цена). к выплате = выручка − все сборы.
3. Повторная сверка августа: commission/delivery теперь должны сойтись со старым; к выплате в допуске §15.
4. Только после этого пересобрать pnl-sku-daily/pnl-daily/pnl-account-daily на новом источнике и включить в синк.

## Статус
Причина простоя устранена, продажи+реклама обновляются ежедневно (до 15.09). Схема снята полностью,
фундамент (коннектор accrual/* + карта категорий + тесты) собран и в ветке. Сверка августа прошла
частично и ПОЙМАЛА, что комиссия/логистика продаж идут через postings, а не by-day - план уточнён (выше).
Пересборка через postings + повторная сверка - следующий заход.
