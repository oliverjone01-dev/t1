---
name: cross-sell
description: Cross-sell engine for GENGROUP - rules and triggers for proposing complementary items. Auto-invoke when a deal is being structured in Bitrix24, when crafting follow-up email, or when discussing complete-the-set offers (комплект Прихожая, Кабинет, Зона отдыха). Knows complementarity rules per category and per палитра.
---

# Cross-Sell - Bundle & Complementary Offer Logic

## When to invoke

- Сделка в Bitrix24 на 1-2 артикула - возможен cross-sell до комплекта
- Follow-up email через 7/14/30 дней после первой покупки
- Конструктор калькуляции на сайте - предложение комплектующих
- КП для дизайнера - предложение комплекта вместо одиночных артикулов

## Bundle logic (Ensemble) - комплект

### Базовый принцип
- Размер комплекта: 2-7 артикулов
- Все артикулы в **одной палитре** (микс палитр в одном комплекте запрещён)
- Скидка за комплект: 8-12% от суммы артикулов отдельно

### Стандартные комплекты GENGLASS

| Зона | Артикулов | Состав | Действующие палитры |
|---|---|---|---|
| Прихожая | 4 | Зеркало + консоль + вешалка + банкетка | NERO / BIANCO / ORO / **CIPRIA (запуск весна 2026)** |
| Кабинет | 5 | Стол + стеллаж + кресло + лампа + органайзер | NERO / ORO / **CIPRIA (запуск 2026)** |
| Зона отдыха | 3 | Журнальный стол + банкетка + зеркало | NERO / BIANCO |
| Столовая группа | 3 | Стол TRUBIS + витрина + буфет | ORO |

## Cross-sell triggers (по категориям)

| Купил | Предлагать | Reasoning |
|---|---|---|
| Зеркало в раме (категория mirrors) | Подсветка + банкетка + вешалка | Логика интерьерной зоны (прихожая) |
| Стол TRUBIS обеденный | Стулья / банкетки + витрина в той же палитре | Столовая группа |
| Стол журнальный | Зеркало + консоль (для гостиной) | Зона отдыха |
| Стеллаж TRUBIS | Стол TRUBIS в той же палитре | Линия TRUBIS - единый дизайн-код |
| Перегородка межкомнатная | Зеркало в той же палитре (для зонирования) | Visual continuity |
| Артикул в палитре CIPRIA (Drop) | Другие 6 моделей первой волны CIPRIA | Поддержка запуска Drop |

## Pricing rules

- Артикулы отдельно: 100% от прайса
- В комплекте: 88-92% (скидка 8-12%)
- Дизайнер-партнёр получает **независимый** бонус 20% (не вычитается из bundle-скидки)
- Конкретные условия совмещения - регламент CFO

## A2A integration

При триггере cross-sell от Bitrix24 - А2А запрос к skill:

```json
{
  "from": "boris",
  "to": "cross-sell-skill",
  "intent": "complementarity_query",
  "context": {
    "deal_id": "B24-12345",
    "customer_type": "designer|b2c|horeca",
    "current_items": ["GGM-02-1-2", "GGT-03-1-2-90"],
    "palette": "ORO",
    "stage": "first_purchase|followup_30d|followup_60d"
  }
}
```

Ответ - список 1-3 рекомендованных артикулов с reasoning.

## Hard Rules

1. **Никаких миксов палитр** в одном комплекте (см. glossary v2.1 §5)
2. Cross-sell для дизайнера - через комплект, не через одиночные допы (ROMI выше)
3. Скидка комплект и бонус дизайнеру не складываются в одну общую (см. glossary v2.1 §5)
4. Bespoke / индивидуальные размеры не cross-sell (отдельный workflow)

## Anti-patterns

- ❌ Предложение в первом ответе менеджера (build trust сначала)
- ❌ Cross-sell разноценовых сегментов (premium стол + эконом стулья)
- ❌ Cross-sell несовместимых брендов (артикулы GENGLASS не миксятся с VALONTI в одном комплекте)
- ❌ Bundle на 8+ артикулов (превышает определение комплекта 2-7)

## Reference

- Glossary v2.1 §5 (Комплект / Ensemble)
- Pricing details: `glossary.md` §4.4 + §5.3
- Sales scripts using cross-sell: `.claude/agents/viktor.md`

## Future (Sprint 3+)

После Bitrix24 MCP coupling:
- Автоматический cross-sell prompt при создании сделки на 1-2 артикула
- Historical analytics: какие cross-sell конвертятся выше у каких сегментов
- Skill update через CC-19 Reflexion при появлении паттернов
