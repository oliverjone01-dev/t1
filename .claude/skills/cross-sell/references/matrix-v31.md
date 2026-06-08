# Cross-Sell Matrix v3.1 - 16 Categories

**Source:** v8 gengroup-cross-sell SKILL.md (refactored to v9 standards).
**Status:** logical product affinity baseline, awaits Bitrix24 historical validation (Sprint 3+).
**Confidence:** 0.7 [ГИПОТЕЗА: cross-sell v8 SKILL line 10, no Bitrix24 co-purchase data yet].

## How to use

For any anchor product, look up its row below and present 2-3 cross-sell recommendations from the right column. Apply 5 rules from main SKILL.md (max 3-5 per anchor, one-order test, price proximity, style consistency, space logic).

## 1. Обеденные столы (anchor)

- Стулья / барные стулья (matching leg finish)
- Зеркала LED (стена столовой зоны)
- Консоли (прихожая, клиент обставляет квартиру целиком)
- Стеллажи (зонирование open-space)

## 2. Журнальные столы

- Консоли (matching collection)
- Зеркала напольные (гостиная)
- Перегородки стеклянные (зонирование)
- Полки настенные (дополнение гостиной зоны)

## 3. Зеркала (стандартные)

- Зеркала LED (апгрейд через подсветку)
- Консоли (под зеркало в прихожей)
- Вешалки / рейлинги (прихожая комплект)
- Полки настенные (рядом с зеркалом)

## 4. Зеркала LED

- Консоли (под зеркало)
- Тумбы / комоды (мебель для ванной / прихожей)
- Полки (дополнение зоны)

## 5. Стеклянные перегородки

- Двери стеклянные (полная система разделения)
- Зеркала LED (визуальное расширение пространства)
- Стеллажи (альтернативное зонирование)
- Полки настенные (дополнение зоны)

## 6. Стеклянные двери

- Перегородки (полная стеклянная система)
- Фурнитура (ручки, петли)
- Зеркала (ванная комната, если душевая дверь)

## 7. Консоли

- Зеркала (над консолью, классическая пара)
- Журнальные столы (matching collection)
- Полки настенные (прихожая или гостиная)
- Вешалки (прихожая комплект)

## 8. Стеллажи

- Журнальные столы (гостиная комплект)
- Рабочие столы (кабинет комплект)
- Полки настенные (дополнение)
- Перегородки (альтернативное зонирование)

## 9. Полки настенные

- Зеркала (стеновая композиция)
- Стеллажи (масштабирование)
- Консоли (нижний ярус)

## 10. Рабочие / письменные столы

- Стеллажи (кабинет)
- Полки настенные (над столом)
- Зеркала LED (для видеоконференций)

## 11. Барные стулья / стойки

- Обеденные столы (кухня-столовая зона)
- Полки (кухонная зона)
- Зеркала (декор кухни)

## 12. Тумбы / комоды

- Зеркала LED (спальня / ванная)
- Консоли (matching)
- Полки (дополнение)

## 13. Кофейные столики

- Журнальные столы (matching collection, разные размеры)
- Стеллажи (гостиная)
- Зеркала напольные (гостиная)

## 14. Вешалки / рейлинги

- Зеркала (прихожая, must-have пара)
- Консоли (прихожая)
- Полки (прихожая)

## 15. Подставки / аксессуары

- Основной предмет мебели, к которому аксессуар (стол → подставка)
- Другие аксессуары из коллекции

## 16. Душевые кабины / экраны

- Зеркала LED (ванная комната)
- Полки стеклянные (ванная)
- Перегородки (мокрая зона)

## Update procedure (CC-19 Reflexion)

After Bitrix24 MCP coupling (Sprint 3+):
1. Pull co-purchase events from last 90 days
2. Cross-check each row vs actual co-purchase frequency
3. Prune pairs with <5% co-occurrence rate
4. Add new pairs with ≥15% co-occurrence not currently listed
5. Bump to v3.2, log episode in `knowledge/episodes/YYYY-MM/matrix-update-vN.md`

## Confidence statement

`[ГИПОТЕЗА: автор v8 cross-sell skill, допущения: А=логика «одна зона интерьера» переносится в co-purchase, Б=price proximity 30-100% корректна для премиум-сегмента, В=клиент-дизайнер мыслит зонами а не одиночными покупками]`

Reality-corrected expected uplift after matrix v3.2 validation: average-order +8-12% (не 15-20% v8 self-claim), `[РЕТРО-ОЦЕНКА: industry benchmark cross-sell furniture sector]`.
