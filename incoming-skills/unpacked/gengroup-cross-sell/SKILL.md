---
name: gengroup-cross-sell
description: "GENGLASS cross-sell intelligence engine. Automatically recommends complementary products when discussing any GENGLASS item. Use when: client asks about a specific product, creating a commercial proposal, building a product page, advising a sales manager, or discussing upsell/cross-sell strategy. Triggers on: кросс-продажа, допродажа, cross-sell, upsell, средний чек, комплект, что ещё предложить, сопутствующие товары, bundle, рекомендация, рекомендовать. Contains GENGLASS cross-sell matrix v3.1 (317 products, 16 categories, 312 hyperlinks)."
---

# GENGLASS Cross-Sell Intelligence

## Purpose

Increase average order value by 15-20% through intelligent product recommendations. Every time a GENGLASS product is mentioned or sold, this skill identifies 3-5 complementary items that pass the "Would the client buy both in one order?" test.

---

## Cross-Sell Rules

1. **Maximum 3-5 links per anchor category** — don't overwhelm
2. **"One order" test:** Would the client realistically buy BOTH items in a single order? If not → don't recommend
3. **Price proximity:** Cross-sell items should be 30-100% of anchor item price. Don't recommend 500K₽ table with 5K₽ candle holder
4. **Style consistency:** Same aesthetic family. Don't mix industrial with classic
5. **Space logic:** Items for the same ROOM/ZONE — living room table → living room mirror, not bathroom accessory

---

## Cross-Sell Matrix v3.1 (16 Categories)

### 1. Обеденные столы (anchor)
→ Стулья/барные стулья (matching leg finish)
→ Зеркала LED (для стены столовой зоны)
→ Консоли (для прихожей — клиент обставляет квартиру)
→ Стеллажи (для зонирования open-space)

### 2. Журнальные столы
→ Консоли (matching collection)
→ Зеркала напольные (для гостиной)
→ Перегородки стеклянные (зонирование)
→ Полки настенные (дополнение гостиной зоны)

### 3. Зеркала (стандартные)
→ Зеркала LED (апгрейд — подсветка)
→ Консоли (под зеркало в прихожей)
→ Вешалки/рейлинги (прихожая комплект)
→ Полки настенные (рядом с зеркалом)

### 4. Зеркала LED
→ Консоли (под зеркало)
→ Тумбы/комоды (мебель для ванной/прихожей)
→ Полки (дополнение зоны)

### 5. Стеклянные перегородки
→ Двери стеклянные (полная система разделения)
→ Зеркала LED (для расширения пространства)
→ Стеллажи (альтернативное зонирование)
→ Полки настенные (дополнение зоны)

### 6. Стеклянные двери
→ Перегородки (полная стеклянная система)
→ Фурнитура (ручки, петли — допродажа)
→ Зеркала (ванная комната, если душевая дверь)

### 7. Консоли
→ Зеркала (над консолью — классическая пара)
→ Журнальные столы (matching collection)
→ Полки настенные (прихожая/гостиная)
→ Вешалки (прихожая комплект)

### 8. Стеллажи
→ Журнальные столы (гостиная комплект)
→ Рабочие столы (кабинет комплект)
→ Полки настенные (дополнение)
→ Перегородки (альтернативное зонирование)

### 9. Полки настенные
→ Зеркала (стеновая композиция)
→ Стеллажи (масштабирование)
→ Консоли (нижний ярус)

### 10. Рабочие/письменные столы
→ Стеллажи (кабинет)
→ Полки настенные (над столом)
→ Зеркала LED (для видеоконференций)

### 11. Барные стулья/стойки
→ Обеденные столы (кухня-столовая зона)
→ Полки (кухонная зона)
→ Зеркала (декор кухни)

### 12. Тумбы/комоды
→ Зеркала LED (спальня/ванная)
→ Консоли (matching)
→ Полки (дополнение)

### 13. Кофейные столики
→ Журнальные столы (matching collection — разные размеры)
→ Стеллажи (гостиная)
→ Зеркала напольные (гостиная)

### 14. Вешалки/рейлинги
→ Зеркала (прихожая — must-have пара)
→ Консоли (прихожая)
→ Полки (прихожая)

### 15. Подставки/аксессуары
→ Основной предмет мебели, к которому аксессуар (стол → подставка)
→ Другие аксессуары из коллекции

### 16. Душевые кабины/экраны
→ Зеркала LED (ванная комната)
→ Полки стеклянные (ванная)
→ Перегородки (мокрая зона)

---

## Application in Sales Conversations

When a client mentions or asks about product X:

1. Identify anchor category from matrix above
2. Select 2-3 most relevant cross-sell items
3. Frame as solution, not upsell: "Клиенты, которые заказывают [X], обычно сразу берут [Y] — это создаёт единый стиль [зоны]. Экономия 10-15% на комплекте."
4. If generating КП — include "Рекомендуемые дополнения" section after main products

## Application in Bitrix24 (Future Integration)

Open task: интеграция с Борисом #11 + Дмитрий Янчоглов, Q2-2026.
When a deal is created in CRM with product X → автоматический тег cross-sell-рекомендаций в карточке сделки.

## Data Gap

Currently matrix is based on logical product affinity. Open task: получить реальные данные совместных покупок из Bitrix24/OZON для валидации и ранжирования рекомендаций по частоте.
