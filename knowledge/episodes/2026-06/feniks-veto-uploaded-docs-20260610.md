# ФЕНИКС-вето: загруженные CLAUDE.md / SKILL.md / mp.py (uploads) - решение Ивана

**Owner:** Claude (ФЕНИКС-контур), утверждено Иваном
**Timestamp:** 2026-06-10T12:10:00Z
**Verdict:** veto 4.3/10 (Accuracy 6.0 / Actionability 3.0 / Insight 2.0 / Brand Fit 7.0 / Risk 4.0)
**Решение Ивана:** файлы не принимать, три атома забрать (эта запись и есть фиксация)

## Что было предложено

Три файла извне: (1) замена CLAUDE.md тонкой репо-справкой, (2) SKILL.md коннектора gengroup-marketplace, (3) mp.py - Python-скелет CLI на OZON/WB/ЯМ с NotImplementedError-заглушками.

## Почему veto

1. **VIOLUR-регрессия.** Файл утверждал «VALONTI/VIOLUR - не на маркетплейсах». По решению Ивана (2026-06-09) VIOLUR - столы GENGLASS, легально на OZON: 16 SKU, 1 609 858 ₽/30д [ДАННЫЕ: data/skus_live_30d.json, окно 2026-05-11..06-09]. Ошибка уже вычищена из DOC_00/01/02/05, n8n и сайта - принять файл значило вернуть её в самый авторитетный документ.
2. **Описан несуществующий репозиторий.** Evidence.dev и skills/gengroup-marketplace в t1 нет. Боевой конвейер другой: n8n-вебхуки → fetch:live → data/ → статические дашборды (GitHub Pages, smoke-гейт). Смёржен в main 2026-06-10 (PR #10).
3. **Дубликат работающего.** OZON-заглушки mp.py - те же endpoint (v1/analytics/data, v5/product/info/prices, v4/product/info/stocks), что уже в бою в n8n «Товары (live SKU)». Второй конвейер к тем же endpoint = неизбежное расхождение цифр = удар по Протоколу 9.
4. **Затирание конституции v9.0** без ФЕНИКС-approval (нарушение §14).

## Три принятых атома

### Атом 1 - единый контракт данных (принят как ориентир схемы)
`date, platform, sku, name, units, revenue, cogs, ad_spend, returns` → производные `margin = revenue - cogs - ad_spend`, `drr = ad_spend / revenue`.
Реализация - в существующем конвейере analytics-mvp (расширение схемы data/), НЕ отдельным CLI. Колонка `platform` закладывается при первом не-OZON источнике.

### Атом 2 - дорожная карта WB + Яндекс Маркет
Когда дойдём до мультиплатформы: новые n8n-workflow по проверенному OZON-паттерну (webhook → Set-параметры → Code-сбор → Respond), отдающие данные в едином контракте из атома 1. Референсы SDK: eslazarev/wildberries-sdk (sales-funnel v3), yandex-market-partner-api (OpenAPI). Дашборды не переписываются - фильтр по platform.
Статус: backlog, без дедлайна до решения Ивана о выходе на WB/ЯМ.

### Атом 3 - задача: креды OZON из n8n-узлов в credentials vault
Сейчас Client-Id / Api-Key / Performance-secret лежат открытым текстом в Set-узлах четырёх workflow (gengroup-ozon-ads, -skus, -pnl, -pnl-sku). Это gap: любой с доступом workflow:read видит ключи.
Задача: перенести в n8n Credentials (HTTP Header Auth / custom), узлы Code переключить на this.getCredentials. Владелец: Иван (доступ к n8n-аккаунту) + Claude (правка workflow). Приоритет: средний, до подключения внешних подрядчиков к n8n - обязательный.

## Файлы

Загруженные файлы в репозиторий НЕ закоммичены (uploads остались вне git). Единственный след - эта запись и строка в CLAUDE.md §14 об источнике правды analytics-mvp.
