---
name: cross-sell
description: GENGROUP cross-sell engine - palette-bundle discipline + 16-category complementarity matrix. Auto-invoke on cross-sell or upsell discussion, bundle creation (Прихожая/Кабинет/Зона отдыха), КП composition, follow-up email crafting, average-order-value optimization. Triggers - кросс-продажа, допродажа, cross-sell, upsell, средний чек, комплект, что ещё предложить, сопутствующие товары, bundle, рекомендация. Combines palette-discipline (no mix per glossary v2.1 §5) with 16-category product matrix from Cross-Sell v3.1.
---

# Cross-Sell - Palette Bundle + Category Matrix

## Purpose

Two parallel systems for raising average order value (target +15-20% [ГИПОТЕЗА: cross-sell v8 SKILL line 10, no Bitrix24 verified data yet]):

1. **Palette-Bundle** - готовый комплект 2-7 артикулов в **одной палитре** (Прихожая ORO, Кабинет NERO, etc). 8-12% bundle discount.
2. **Category-Complementarity** - cross-category recommendations across the 16-category product matrix (стол → стулья, зеркало → консоль). 3-5 items per anchor.

Systems work together: bundle discount applies to палитровые наборы; category matrix drives item selection within and across bundles.

## Architectural choice - почему 1 skill, не 2 (resolves FENIX iter-1 open question #1)

Альтернатива была: split на `cross-sell-matrix` (категорийная комплементарность) и `bundle-rules` (палитро-дисциплина). Отвергнута Иваном (2026-06-08) по 3 причинам:

1. **Single activation context** - оба системы вызываются на один триггер «составить КП / cross-sell / комплект» в одной сделке Bitrix24. Разделение породит две auto-invocation которые конкурируют.
2. **DRY с правилами совмещения** - bundle discount (8-12%) и designer commission (20%) - один регламент CFO, должен жить в одном месте. Split разнёс бы pricing rules между двумя skills с риском рассинхрона.
3. **Менеджер думает зонами, не категориями** - в реальном диалоге продавец сначала выбирает зону (Прихожая) → потом палитру → потом артикулы. Это flow одного skill, не двух.

Cross-domain parallel: **Bang & Olufsen room ensemble** - один configurator combines product compatibility (acoustic compatibility, не «category matrix» в нашем смысле, но functional analog) + price tier discipline (Beosound vs Beoplay tiers, аналог bundle discount). B&O **не разделяет** их на два tools - один configurator с двумя осями. То же решение здесь.

## When to invoke

- Сделка в Bitrix24 на 1-2 артикула - возможен cross-sell до комплекта
- КП для дизайнера или розничного клиента (включить раздел «Рекомендуемые дополнения»)
- Follow-up email через 7/14/30 дней после первой покупки
- Конструктор калькуляции на сайте - предложение комплектующих
- Менеджер обрабатывает «А что ещё посоветуете?»

## System A - Palette-Bundle (Ensemble)

### Базовый принцип
- Размер комплекта: 2-7 артикулов
- Все артикулы в **одной палитре** (микс палитр в одном комплекте запрещён - см. glossary v2.1 §5)
- Bundle discount: 8-12% от суммы артикулов отдельно [ДАННЫЕ: glossary.md §5.3, c=1.0]
- Дизайнер-партнёр получает **независимый** бонус 20% (не вычитается из bundle-скидки) [ДАННЫЕ: glossary.md §5.3, c=1.0]

### Действующие комплекты GENGLASS

| Зона | Артикулов | Состав | Действующие палитры |
|---|---|---|---|
| Прихожая | 4 | Зеркало + консоль + вешалка + банкетка | NERO / BIANCO / ORO / **CIPRIA (запуск весна 2026)** |
| Кабинет | 5 | Стол + стеллаж + кресло + лампа + органайзер | NERO / ORO / **CIPRIA (запуск 2026)** |
| Зона отдыха | 3 | Журнальный стол + банкетка + зеркало | NERO / BIANCO |
| Столовая группа | 3 | Стол TRUBIS + витрина + буфет | ORO |

## System B - Category-Complementarity (16-cat matrix v3.1)

Полная матрица 16 категорий с 3-5 recommendations per anchor - в `references/matrix-v31.md`.

**Quick reference (топ-5 анкеров по продажам):**

| Anchor | 1-st recommendation | Reasoning |
|---|---|---|
| Обеденный стол | Стулья (matching leg finish) | Same set logic |
| Зеркало (стандарт) | Зеркало LED (апгрейд) или Консоль | Upgrade или прихожая комплект |
| Стеллаж TRUBIS | Стол TRUBIS той же палитры | Линия TRUBIS - единый дизайн-код |
| Стеклянная перегородка | Зеркало LED | Визуальное расширение пространства |
| Консоль | Зеркало над консолью | Классическая пара в прихожей |

Все 16 категорий - см. `references/matrix-v31.md`.

### 5 правил Cross-Sell Matrix v3.1

1. **Maximum 3-5 links per anchor category** - не перегружать клиента
2. **«One order» test:** клиент реально купит ОБА в одном заказе? Если нет → не рекомендовать
3. **Price proximity:** cross-sell items - 30-100% от цены anchor. Не предлагать 500K стол + 5K подсвечник
4. **Style consistency:** одна aesthetic family. Не миксить industrial и classic
5. **Space logic:** один room/zone (гостиная стол → гостиная зеркало, не bathroom accessory)

## Application in sales conversations

When client mentions or asks about product X:

1. **Identify anchor** category - какой ряд из 16
2. **Identify palette** (если уже зафиксирована) - чтобы предлагать ту же
3. **Select 2-3 relevant** cross-sell items (по правилам 1-5 выше)
4. **Frame as solution, not upsell:**
   > «Клиенты, которые заказывают [X], обычно сразу берут [Y] - это создаёт единый стиль [зоны]. Если возьмём комплектом - bundle-скидка 8-12%».
5. **In КП** - отдельный раздел «Рекомендуемые дополнения» после основных позиций

## Cross-sell triggers (по категориям GENGLASS)

| Купил | Предлагать | Логика |
|---|---|---|
| Зеркало в раме | Подсветка + банкетка + вешалка | Прихожая комплект |
| Стол TRUBIS обеденный | Стулья + витрина в той же палитре | Столовая группа |
| Стол журнальный | Зеркало + консоль | Зона отдыха комплект |
| Стеллаж TRUBIS | Стол TRUBIS той же палитры | Линия TRUBIS |
| Перегородка межкомнатная | Зеркало в той же палитре | Visual continuity при зонировании |
| Артикул CIPRIA (Drop) | Другие 6 моделей первой волны CIPRIA | Поддержка запуска Drop |

## Pricing rules

- Артикулы отдельно: 100% от прайса
- В комплекте (палитро-bundle): 88-92% (скидка 8-12%) [ДАННЫЕ: glossary.md §5.3]
- Дизайнер-партнёр: 20% independent commission [ДАННЫЕ: glossary.md, agents/viktor.md]
- Bundle discount и designer commission **НЕ складываются** в одну общую скидку - регламент CFO

## Hard Rules

1. **Никаких миксов палитр** в одном комплекте [ДАННЫЕ: glossary v2.1 §5]
2. **Никакого микса брендов** GENGLASS и VALONTI в одном комплекте [ДАННЫЕ: glossary §9]
3. Cross-sell для дизайнера - через комплект, не через одиночные допы (ROMI выше - см. agents/marco.md benchmarks)
4. Bundle discount и designer bonus не суммируются - регламент CFO
5. Bespoke / индивидуальные размеры **не cross-sell** (отдельный workflow - см. glossary v2.1 §7.3)
6. Maximum 7 артикулов в bundle (определение Ensemble) [ДАННЫЕ: glossary §5]
7. Maximum 3-5 cross-sell recommendations per anchor (правило matrix v3.1)

## A2A Integration

При триггере cross-sell от Bitrix24 (через subagent boris) - JSON-запрос по `schemas/a2a-message.json`:

```json
{
  "from": "boris",
  "to": "cross-sell",
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

Ответ - список 1-3 рекомендованных артикулов с reasoning через 5 правил matrix v3.1.

## Anti-patterns

- ❌ Предложение cross-sell в первом ответе менеджера (build trust сначала, 2-3 reply turns)
- ❌ Cross-sell разноценовых сегментов (premium стол + эконом стулья)
- ❌ Cross-sell с миксом палитр (NERO стол + ORO стулья)
- ❌ Cross-sell несовместимых брендов в одном комплекте
- ❌ Bundle на 8+ артикулов (превышает определение Ensemble)
- ❌ Игнорирование «one order test» («может, потом докупит» - НЕ cross-sell)
- ❌ Универсальный шаблон без учёта зоны клиента (гостиная stuff в bathroom context)

## Data Gap (Sprint 3+ resolution)

**Currently:** matrix v3.1 основана на логическом product affinity, не на Bitrix24 historical co-purchase data.

**Open task** (Q3-2026): получить выгрузку из Bitrix24/OZON co-purchase patterns - validate matrix и rank recommendations by frequency. Owner: Борис #11 + Дмитрий Янчоглов.

**До получения данных:** matrix v3.1 - рабочий baseline, ranking по человеческой логике (5 rules), confidence 0.7.

## Reference

- Glossary v2.1 §5 (Комплект / Ensemble): `glossary.md` lines 292-330
- 16-category matrix v3.1: `references/matrix-v31.md` (в этом skill)
- Sales scripts using cross-sell: `.claude/agents/viktor.md`
- Pricing canon: `glossary.md` §4.4 + §5.3
- A2A schema: `schemas/a2a-message.json`

## Future (Sprint 3+)

После Bitrix24 MCP coupling:
- Автоматический cross-sell prompt при создании сделки на 1-2 артикула
- Historical analytics: какие cross-sell конвертятся выше у каких сегментов
- Skill update через CC-19 Reflexion при появлении паттернов
- Matrix v3.2: pruning irrelevant pairs (по реальным данным)
