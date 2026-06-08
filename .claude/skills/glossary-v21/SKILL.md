---
name: glossary-v21
description: GENGROUP terminology v2.1 consistency checker. Auto-invoke when text uses brand-specific terms (палитра / линия / коллекция / комплект / артикул / Scena / Drop / Core / Bespoke / IS / MTO). Catches old-terminology errors (GM-METAL → Metal-GM, "коллекция NERO" → "палитра NERO", "коллекция TRUBIS" → "линия TRUBIS"). Provides bridging phrases for managers (translate client old-speak to v2.1 без direct correction). Sibling to encyclopedia-router (which handles factual routing to Project Knowledge documents).
---

# Glossary-v21 - Terminology Consistency Checker

## Purpose

Глоссарий v2.1 = canonical terminology layer GENGROUP. Этот skill валидирует использование терминов в тексте перед публикацией. Catches drift и провоцирует corrections per glossary v2.1 standards.

**Sibling skill:** `encyclopedia-router` (PK routing для фактов). Use both: router для «где факт», glossary для «как называется».

## When to invoke

- Любой текст с терминами архитектуры продукта (палитра / линия / коллекция / комплект / артикул / режим продаж / Scena)
- Audit публичных страниц (genglass.ru, маркетплейсы, КП, презентации)
- Подготовка новой коммуникации с упоминанием брендов / палитр / линий / коллекций / комплектов
- Конфликт между авторским желанием и канонической терминологией
- Менеджер обрабатывает диалог с клиентом, использующим старую терминологию

## Core terms (v2.1)

### 7-уровневая архитектура продукта GENGROUP

- **Бренд (Brand):** 5 брендов - GENGLASS, VALONTI, GENTERO, **Metal-GM** (НЕ GM-METAL!), GLASS-MEMORY
- **Категория (Categoria / Category):** зеркала, столы, хранение, перегородки, мягкая мебель, стеклянные доски, комплектующие
- **Линия (Linea / Line / Family):** сквозной дизайн-код через категории. **TRUBIS** - первая линия GENGLASS
- **Модель (Modello / Model):** конкретный дизайн в рамках категории - EVELIX, RAUNTEL, KUVINO, TRUBIS Oval
- **Артикул (SKU / Codice):** уникальная единица товара. Форматы:
  - Зеркала: `GGM-XX-C-S` (пример: GGM-02-1-2)
  - Зеркала LED: `GGL-XX-S-KKKK-T` (пример: GGL-02-L-3000-2)
  - Столы: `GGT-XX-C-D-SS` (пример: GGT-03-1-2-90)
  - Перегородки стд: `GGP-01-C-G-HH-WW`
  - Перегородки прем: `GGP-02-C-G-HH-WW`
- **Палитра (Palette):** сквозной финиш / цвет / покрытие. Core: NERO (RAL 9005), ORO (BS002), BIANCO (RAL 9003). Drop весна 2026: CIPRIA (RAL 3015). В разработке: INDUSTRIAL (RAL 7024)
- **Коллекция (Collezione):** сквозной дизайн-концепт с именным автором - первая ожидается Q3-Q4 2026. **НЕ существует сейчас!**
- **Комплект (Ensemble):** 2-7 артикулов для зоны интерьера - Прихожая / Кабинет / Зона отдыха / Столовая группа

### Режимы продаж

- **In-Stock (IS):** 1-3 рабочих дня, со склада Домодедово (Core-палитры в стандартных размерах)
- **Made-to-Order (MTO):** 5-30 дней по категории (производство по факту заказа, надбавка 5-15% за нестандарт)
- **Bespoke / Custom Project:** 20-90 дней, уникальный проект по чертежам клиента/дизайнера

### Типы палитр

- **Core Palette:** постоянно в ассортименте, складская программа (NERO, ORO, BIANCO)
- **Drop Palette:** сезонный релиз 3-12 месяцев (CIPRIA весна 2026)

### Типы коллекций (когда появятся)

- **Capsule Collection:** 6-18 месяцев, ограниченный тираж, событийный launch
- **Core Collection:** постоянно, флагманская линия

### Прочие термины

- **Scena / Интерьерное решение / Interior Scheme:** визуальная подача комплекта через фото или 3D-рендер. **НЕ товар**, а способ презентации.
- **Pre-release / Soft launch / Active drop / Decision point:** этапы жизненного цикла палитры

## Common errors (catch & fix)

| ❌ Неправильно | ✅ Правильно |
|---|---|
| «Коллекция NERO / ORO / BIANCO / CIPRIA» | **Палитра** NERO / ORO / BIANCO / CIPRIA |
| «Коллекция TRUBIS» | **Линия** TRUBIS |
| «Розовая коллекция» / «Розовая линия» | Палитра CIPRIA (Drop весна 2026) |
| GM-METAL | **Metal-GM** (с мая 2026 каноничное имя) |
| «Ежемесячный комплект» | Комплект (Ensemble), без частоты |
| «Квартальная коллекция» | Квартальный Drop палитры |
| «SKU» (когда имеется в виду тип дизайна) | **Модель** (если тип) / **Артикул** (если единица) |
| «Интерьерное решение» (как товар) | Scena - способ подачи комплекта, **не товар** |
| «Коллекция INDUSTRIAL» | Палитра в разработке INDUSTRIAL |
| GLASS_MEMORY (с подчёркиванием) | **GLASS-MEMORY** (с дефисом) |

## Audit workflow

1. **GREP** - найти все упоминания контрольных терминов в тексте
2. **CONTEXT CHECK** - каждое в контексте:
   - цвет → палитра
   - дизайн-код через категории → линия
   - авторский концепт → коллекция
   - 2-7 артикулов для зоны → комплект
3. **FIX** - заменить с сохранением падежей и согласования
4. **CROSS-CHECK** - после правки прогнать ещё раз (вторая ошибка часто сидит рядом)

## Bridging phrases (для менеджеров)

Когда **клиент** использует старую терминологию - НЕ корректировать в лоб, а переводить через себя:

| Клиент | Менеджер |
|---|---|
| «Из розовой коллекции» | «Наш весенний релиз - **палитра CIPRIA**, 7 моделей» |
| «Покажите коллекцию TRUBIS» | «**Линия TRUBIS** - наш бестселлер, столы и стеллажи» |
| «А какие у вас коллекции?» | «Три базовых **палитры** - чёрная, золотая, белая; плюс весенняя **CIPRIA**. Первая авторская **коллекция** с именным дизайнером выйдет ближе к концу года» |
| «Дайте коллекцию INDUSTRIAL» | «**Палитра INDUSTRIAL** ещё в разработке, доступна по запросу через GENTERO B2B» |

## Pricing implications

Терминология влияет на цену:

- Палитра Core (NERO / ORO / BIANCO): референсная цена
- Палитра Drop (CIPRIA): +5-15%
- Коллекционная модель: +15-30%
- Лимитированная серия (50 шт, нумерация): доп. +10-20%

Это критично - смешать «коллекцию» и «палитру» в КП = смешать ценовые тиры = blow up клиента или underprice бренд.

## Hard rules

1. **Никаких миксов палитр** в одном комплекте (Ensemble) [glossary §5]
2. **Никакого микса брендов** GENGLASS + VALONTI в одном комплекте [glossary §9]
3. Имена палитр (NERO/ORO/BIANCO/CIPRIA) принадлежат GENGLASS - другие бренды используют через лицензию
4. Metal-GM канонично пишется через дефис (НЕ GM-METAL и НЕ Metal_GM)
5. GLASS-MEMORY канонично пишется через дефис

## When to use sibling skill

| Question type | Use this skill | Use encyclopedia-router |
|---|---|---|
| «Какая цена / срок / спека X?» | - | ✅ routes to PK |
| «Это палитра или коллекция?» | ✅ terminology check | - |
| «Кто отвечает за выгрузку 1С?» | - | ✅ routes to Регламенты |
| «Чем линия отличается от коллекции?» | ✅ terminology | - |
| «GM-METAL → Metal-GM правильно?» | ✅ also catches | ✅ common errors table |

## Reference

- Sibling: skill `encyclopedia-router` for PK fact routing
- Full glossary v2.1: `/home/user/t1/glossary.md`
- Landing site: `/home/user/t1/index.html` + `sections/*.html` + `appendix/*.html`
- Migration map v1/v2 → v2.1: `glossary.md` Appendix B
- Sales bridging scripts: `.claude/agents/viktor.md`
- FENIX terminology checkpoint (accuracy_4): `.claude/skills/phoenix-eval/SKILL.md`
