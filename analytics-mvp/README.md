# GENGROUP Analytics MVP

Соразмерная стартовая версия аналитики OZON для GENGLASS. Без n8n: коннектор -> SQLite (история) -> витрина -> дашборд. Логика и подводные камни перенесены из `DOC_00..DOC_05` как тестируемый TypeScript.

## Стек
TypeScript + better-sqlite3 + vitest. Никаких Postgres/Redis/ClickHouse на старте (см. аудит ФЕНИКСА, P1).

## Структура
```
src/
  types.ts                  # Provenance, Reliability, Metric (DOC_05 §1.5)
  util/num.ts               # десятичная запятая OZON, safeDiv, дельты
  period.ts                 # единый разбор периода, равные окна, клампинг
  store.ts                  # SQLite, идемпотентный upsert
  connector/
    ozon-seller.ts          # analytics/data, stocks, prices
    ozon-performance.ts     # token, campaigns, daily stats (батч 25)
  env.ts                    # загрузка .env
  scripts/ping.ts           # S2: проверка боевой связи
```

## Команды
```
npm install
npm test          # юнит-тесты (S1)
npm run typecheck
cp .env.example .env   # заполнить ключи (в репозиторий не попадает)
npm run ping      # S2: проверить связь с OZON
```

## Шаги до MVP
- S1 каркас + тесты (сделано)
- S2 боевая связь (`npm run ping`)
- S3 бэкфилл в SQLite с 2026-02-01
- S4 витрина + сравнение периодов
- S5 дашборд v0 (Обзор + SKU, переключатель A/B)

## Безопасность
Ключи только в `.env` (vault на проде). После тестов ротировать - сейчас они также в нодах n8n (аудит G4).

## Яндекс Маркет (/market/)
Тот же конвейер, параметризованный платформой: `DATA_DIR=data-ym OUT_DIR=public/market PLATFORM=ym`.
Коннектор только читает Partner API (ключ - секрет `YM_DASHBOARD_1`). Подробно: `YM_MARKET.md`.
```
npm run ym:ping      # Этап 0: связь + список campaignId
npm run ym:orders && npm run ym:catalog && npm run ym:derive && npm run ym:join && npm run ym:reconcile
npm run ym:build && npm run ym:smoke
```
