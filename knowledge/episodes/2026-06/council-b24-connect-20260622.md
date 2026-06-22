# Council CC-13: путь подключения Bitrix24 (glassmemory.bitrix24.ru)

- **Дата:** 2026-06-22
- **Оркестратор:** SPARTAK · **Режим:** CC-13 Adversarial Review
- **Ростер:** boris (тех. зона B24) · roman (build-vs-buy) · feniks (Step 12.5)
- **Получатель:** Иван
- **Бриф:** оптимальный путь подключить портал для аналитики и управления. Варианты A) gunnit MCP 30★ · B) Aiyo28/yzel 2★ единый коннектор · C) свой MCP на офиц. шаблоне bitrix24/templates-mcp · D) REST через входящий вебхук.

## Позиции бойцов

| Вариант | boris (тех) | roman (эконом) | feniks (риск) |
|---|---|---|---|
| A) gunnit MCP 30★ | фоллбэк, read-only, после аудита | условный фоллбэк | **VETO** (supply-chain к прод-CRM) |
| B) yzel 2★ единый | не брать как основу | **BLOCK** (concentration risk) | **VETO** (max blast radius) |
| C) свой на офиц. шаблоне | цель Q3-2026 (OAuth, scope) | отложить (переинвестиция сейчас) | **RETURN** (целевое для записи + guardrails) |
| D) REST вебхук | **go сейчас**, read-only | **GO**, мин. TCO (2-4ч) | **GO** с guardrails |

## Step 12.5 - ФЕНИКС
- Score 8.3/10. Вердикт пакета: **RETURN** (D/C довести по guardrails перед DELIVER), **VETO на A и B** (на прод не выпускать).
- Запись в прод-CRM = HITL Ивана (Kill Criteria §9), отдельный токен, dry-run на 10 записях + rollback.

## Решение (go-путь)
1. **Сейчас:** D - входящий вебхук Bitrix24, **read-only**, узкий scope (crm.* / tasks.* read), URL = секрет окружения (не в чат, не в git). По образцу существующего n8n-паттерна OZON.
2. **Запись (управление):** D-расширение в PILOT (dry-run 10 + rollback) под HITL Ивана.
3. **Q3-2026:** C - свой MCP на офиц. `bitrix24/templates-mcp` как целевая архитектура для записи (если нужен именно MCP-слой).
4. **A/B - не выпускать на прод ни при каких.**

## [STEAL THIS]
- boris: 3 шага - вебхук read-only → field-mapping в `knowledge/semantic/bitrix24-field-mapping.md` → A2A-враппер `bitrix24_get`.
- roman: переиспользуем уже оплаченный n8n-паттерн; это НЕ ROMI-кейс (инструмент эффективности), метрика = TCO.
- feniks: guardrails - read-only старт, мин. scope, секрет в env, ревью+pin для C, killswitch+ротация, Protocol 14 логирование.

## Чекпоинт
Создание read-only вебхука (владелец: Иван) → сбор схемы полей и первый аналитический срез (владелец: boris + Claude). Дата: при получении URL.
