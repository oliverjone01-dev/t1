---
name: brand
description: Brand voice and tone authority for GENGROUP holding. Auto-invoke when crafting any brand-facing copy, choosing tone for a deliverable, deciding which of 5 brands a message belongs to, or auditing existing material for brand consistency. Owns the voice-DNA map per brand (GENGLASS / VALONTI / GENTERO / Metal-GM / GLASS-MEMORY).
---

# Brand - Voice & Tone Authority (v1.1)

## When to invoke

- Любая копия (статья, лендинг, пост, КП, ad, скрипт) перед публикацией
- Выбор бренда для нового продукта или коммуникации
- Аудит существующих материалов на соответствие voice
- Конфликт между авторским желанием и brand DNA

## Voice DNA per бренд

### GENGLASS (premium-but-warm, графичный)
- **Tone:** профессиональная теплота. Не «уважаемый клиент», не «друг», а «коллега».
- **Language:** конкретика (RAL 9005, 16 000 м², 27 000 заказов, 350+ проектов)
- **Imagery:** loft-industrial с премиальным финишем. Муар на металле, отражения в стекле.
- **Hooks:** «зонируем без капитального ремонта», «7 дней от заказа до отгрузки», «3 палитры в стандарте»
- **Forbidden:** «изысканный», «роскошный», «эксклюзивный» без описания механики

### VALONTI (authored gallery)
- **Tone:** скульптурная скупость на слова. Каждое предложение - экспонат.
- **Language:** материальный - камень (Nero Marquina, Travertino, Onyx Miele), бронза, латунь
- **Imagery:** музейная подача, драматичный свет, теневые провалы
- **Hooks:** имя автора + материал + одна формальная идея
- **Forbidden:** «современный дизайн», «модный тренд», «универсальное решение»

### GENTERO (B2B-precision)
- **Tone:** инженерная точность. ТЗ-language, технические термины уместны.
- **Language:** RAL/NCS по ТЗ, тайминги, площади, метрики проекта
- **Imagery:** архитектура объектов клиентов, fit-out схемы, чертежи
- **Hooks:** «1 объект = 6 зон», «60 дней вместо 180», «полный fit-out HoReCa»
- **Forbidden:** эмоциональный язык, метафоры, обещания «вау-эффекта»

### Metal-GM (functional, no fluff)
- **Tone:** инженер инженеру. Сухая фактура без украшательств.
- **Language:** марки сталей, толщины, допуски, объёмы партий, RAL
- **Imagery:** деталь крупным планом, цех, точность
- **Hooks:** «партия от 50 шт», «любой RAL по ТЗ», «контрактное производство»
- **Forbidden:** маркетинговые эпитеты, поэзия, апелляции к «качеству» без цифр

### GLASS-MEMORY (delicate, respectful)
- **Tone:** деликатность без манипуляций. Скорбь не используется как продажный аргумент.
- **Language:** уважительный, конкретный, без пафоса
- **Imagery:** приглушённые тона, glass texture, без людей в кадре
- **Hooks:** «память, которая переживёт нас», «Crystalvision +25%», «мемориальные наборы»
- **Forbidden:** «вечная память», «единственный шанс», эмоциональные триггеры скорби

## Workflow

1. **IDENTIFY BRAND** - какой из 5
2. **DNA LOAD** - таблица выше
3. **DRAFT** - следуя voice rules
4. **AUDIT pass:** проверить против Forbidden list бренда + Anti-Slop blocklist v2 (CLAUDE.md §7)
5. **HUMANIZER pass** (для RU) - skill `humanizer-ru`

## Cross-brand rules

- Кросс-брендовые коллекции - отдельное решение совета холдинга, по умолчанию не делаем
- Имена палитр (NERO/ORO/BIANCO/CIPRIA) принадлежат GENGLASS - другие бренды используют через лицензию
- Metal-GM канонично пишется через дефис (не GM-METAL); GLASS-MEMORY через дефис

## Output mark

```yaml
---
brand: genglass|valonti|gentero|metal-gm|glass-memory
voice_audit: passed|failed
forbidden_hits: 0
ready_for_humanizer: true
---
```

## Reference

См. CLAUDE.md §12 (Tone & Voice) + глоссарий v2.1 §9 (Brand Architecture).
