---
name: brand
description: GENGROUP brand identity, design system, and tone-of-voice authority for 5 brands (GENGLASS, VALONTI, GENTERO, Metal-GM, GLASS-MEMORY). Auto-invoke on ANY visual deliverable, HTML artifact, presentation, document, landing page, КП, calculator UI, dashboard. Triggers - design, brand, visual, colors, typography, layout, tone, voice, дизайн, стиль, бренд, оформление, brand guidelines, style guide, anti-slop, voice tone. Owns master design system (color palette + CSS variables + typography + UI components) AND voice DNA per 5 brands. Routes to brand-colors.md and product-facts.md references.
---

# Brand - Identity, Design System, Voice DNA (5 brands)

## When to invoke

ANY deliverable that humans will see:
- HTML artifacts, landing pages, dashboards, calculator UI
- Presentations (PPTX), documents (DOCX)
- Social media posts, email templates
- Commercial proposals (КП)
- Marketing materials, ads

Auto-triggers: design, brand, visual, colors, typography, layout, tone, voice, дизайн, стиль, бренд, оформление, anti-slop.

## Voice DNA per 5 brands

### GENGLASS (flagship, premium-but-warm, графичный)

- **Tone:** Confident craftsman. Direct, technical when needed, warm but not fluffy. «Мы делаем. Вы получаете.»
- **Language:** конкретика (RAL 9005, 16 000 м², 27 000 заказов, 350+ проектов)
- **Imagery:** loft-industrial с премиальным финишем. Муар на металле, отражения в стекле
- **Hooks:** «зонируем без капитального ремонта», «7 дней от заказа до отгрузки», «3 палитры в стандарте»
- **Forbidden:** «изысканный», «роскошный», «эксклюзивный» без описания механики
- **Speak from:** factory floor authority - 16 000 м² Домодедово

### VALONTI (authored gallery, премиум)

- **Tone:** Quiet luxury. Restrained elegance. Short sentences. «Камень. Металл. Стекло. Точка.»
- **Language:** материальный - камень (Nero Marquina, Travertino, Onyx Miele), бронза, латунь
- **Imagery:** музейная подача, драматичный свет, теневые провалы. Photography-led, less text
- **Hooks:** имя автора + материал + одна формальная идея
- **Forbidden:** «современный дизайн», «модный тренд», «универсальное решение»
- **Premium feel = restraint:** typography thinner weights, more whitespace

### GENTERO (B2B-precision)

- **Tone:** Professional partner. Solutions language. «1 объект = 6 зон. 1 подрядчик = 0 проблем.»
- **Language:** RAL/NCS по ТЗ, тайминги, площади, метрики проекта
- **Imagery:** архитектура объектов клиентов, fit-out схемы, чертежи, charts
- **Hooks:** «1 объект = 6 зон», «60 дней вместо 180», «полный fit-out HoReCa»
- **Forbidden:** эмоциональный язык, метафоры, обещания «вау-эффекта»
- **Layout:** структурированный, grid-based, data-driven visuals

### Metal-GM (functional, no fluff)

- **Tone:** Industrial pragmatism. Specs-first. Lead times. Capabilities.
- **Language:** марки сталей, толщины, допуски, объёмы партий, RAL
- **Imagery:** деталь крупным планом, цех, точность, фото actual CNC/laser/bending
- **Hooks:** «партия от 50 шт», «любой RAL по ТЗ», «контрактное производство», «гибка/сварка/покраска - от чертежа до отгрузки за 10 дней»
- **Forbidden:** маркетинговые эпитеты, поэзия, апелляции к «качеству» без цифр. **НЕ маркетплейсовый бренд.**
- **Aesthetic:** technical spec-sheet, tables, dimensions, tolerances. No decorative elements.

### GLASS-MEMORY (delicate, respectful)

- **Tone:** Respectful, dignified. Never salesy. «Керамическая печать. Crystalvision. Память, которая не выцветает.»
- **Language:** уважительный, конкретный, без пафоса
- **Imagery:** приглушённые тона, glass texture, без людей в кадре. Memorial settings - dignified, not staged
- **Hooks:** «память, которая переживёт нас», «Crystalvision +25%», «320+ дилеров в 25+ городах»
- **Forbidden:** «вечная память», «единственный шанс», эмоциональные триггеры скорби, countdown timers, «СКИДКА», восклицательные знаки

## Master Design System

Полные HEX-палитры с usage rules per 5 брендов - в `references/brand-colors.md`. Общая система ниже.

### Primary colors (all brands)

- Background Dark: `#0A0A0A` (primary dark surfaces)
- Background Alt: `#111111` (cards, panels, secondary)
- Gold Accent: `#C8A951` (CTAs, highlights, premium accents)
- White: `#FFFFFF` (primary text on dark)
- Gray Text: `#999999` (secondary text, captions)
- Border: `#222222` (subtle dividers)

### Brand-specific accents (quick reference)

- **GENGLASS:** Gold `#C8A951` + Industrial `#333333`
- **VALONTI:** Deep Gold `#B8943D` + Marble White `#F5F0EB` (warmer undertone)
- **GENTERO:** Corporate Blue `#2A4D6E` + Steel `#4A4A4A`
- **Metal-GM:** Raw Steel `#555555` + Safety Orange `#E8712B`
- **GLASS-MEMORY:** Memorial Blue `#1A3A5C` + Crystal `#E8E8E8`

Detailed HEX/RGB/usage rules per brand - `references/brand-colors.md`.

### Typography

- **Headlines:** SB Sans Display (fallback: Montserrat, Arial)
- **Body:** Montserrat (fallback: Helvetica Neue, Arial)
- **Accent/Quotes:** Georgia (fallback: Times New Roman)

**Hierarchy:**

| Level | Size | Weight | Spacing |
|---|---|---|---|
| H1 | 48-64px | 700 | letter-spacing -0.02em |
| H2 | 32-40px | 600 | - |
| H3 | 24-28px | 600 | - |
| Body | 16-18px | 400 | line-height 1.6 |
| Caption | 14px | 400 | color #999999 |

### Layout Principles

- **Dark-first:** Default background `#0A0A0A`, not white
- **Generous spacing:** min 48px between sections, 24px between elements
- **Asymmetric grids:** avoid centered-everything (anti-AI-slop)
- **Full-bleed imagery:** photos and renders edge-to-edge when possible
- **Gold as punctuation:** `#C8A951` sparingly - CTAs, key numbers, section dividers. Never as background fill. Max 15% of visual area [ДАННЫЕ: references/brand-colors.md GENGLASS usage rules]

### UI Components - CSS Variables (use in any HTML artifact)

```css
:root {
  --bg-primary: #0A0A0A;
  --bg-secondary: #111111;
  --bg-card: #1A1A1A;
  --accent-gold: #C8A951;
  --accent-gold-hover: #D4B85E;
  --text-primary: #FFFFFF;
  --text-secondary: #999999;
  --text-muted: #666666;
  --border: #222222;
  --border-hover: #333333;
  --success: #4CAF50;
  --error: #E53935;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow: 0 4px 24px rgba(0,0,0,0.4);
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Button styles

```css
/* Primary */
.btn-primary {
  background: var(--accent-gold);
  color: var(--bg-primary);
  border-radius: 8px;
  padding: 14px 28px;
  transition: var(--transition);
}
.btn-primary:hover { transform: scale(1.02); filter: brightness(1.1); }

/* Secondary */
.btn-secondary {
  background: transparent;
  border: 1px solid var(--accent-gold);
  color: var(--accent-gold);
}
```

### Card styles

```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: var(--transition);
}
.card:hover { border-color: var(--accent-gold); }
```

### Input styles

```css
input, textarea {
  background: var(--bg-secondary);
  border: 1px solid var(--border-hover);
}
input:focus {
  border-color: var(--accent-gold);
  box-shadow: 0 0 0 2px rgba(200,169,81,0.2);
}
```

## Anti-Slop Content Protocol

MANDATORY для всего текста:

1. **Authenticity:** использовать REAL GENGROUP data - 16 000 м² производство, 27 000+ заказов, 350+ проектов, 320+ дилеров [ДАННЫЕ: references/product-facts.md]. Никаких hypotheticals.
2. **Boldness:** если default ChatGPT без брифа сгенерит то же - REJECT. Должно быть provocative, non-obvious.
3. **Specificity:** exact numbers, ₽, %, м², dates. «Мы производим 200+ перегородок в месяц», не «много».
4. **Experience:** human perspective - factory floor stories, client feedback, installation edge cases.
5. **Extractability:** каждый абзац = self-contained unit. Can be cut and pasted independently.
6. **Anti-Median test:** generic LLM produces the same output without GENGROUP context → REJECT.

### Forbidden patterns (AI Slop)

- «В мире современного дизайна...» - generic opener
- «Мы гордимся тем, что...» - corporate cliché
- «Инновационные решения» без конкретики
- «Широкий ассортимент» без цифр
- «Высокое качество» без параметров
- Purple/blue gradients, centered everything, Inter font
- Stock-photo aesthetics, rounded-corner everything

См. полный blocklist 30+ паттернов в skill `humanizer-ru`.

### Required patterns

- Open с FACT или PROVOCATION, не platitude
- ≥1 specific number per paragraph
- Reference production reality (materials, processes, timelines)
- End with ACTION, не inspiration

## Cross-brand rules

- Кросс-брендовые коллекции = отдельное решение совета холдинга. По умолчанию не делаем.
- Имена палитр (NERO/ORO/BIANCO/CIPRIA) принадлежат GENGLASS. Другие бренды используют через лицензию.
- Metal-GM канонично пишется через дефис (НЕ GM-METAL). GLASS-MEMORY через дефис.
- Один комплект (Ensemble) НЕ миксит палитры [glossary v2.1 §5].
- Один комплект НЕ миксит бренды (GENGLASS + VALONTI в одном комплекте - нет).

## Workflow

1. **IDENTIFY BRAND** - какой из 5
2. **DNA LOAD** - voice section выше
3. **COLORS LOAD** - master palette + brand-specific accents (`references/brand-colors.md` если нужны детали)
4. **FACTS LOAD** - конкретные числа из `references/product-facts.md`
5. **DRAFT** - следуя voice rules + numerical density
6. **AUDIT pass:** Forbidden patterns + Anti-Slop blocklist v2 (CLAUDE.md §7)
7. **HUMANIZER pass** (для RU) - skill `humanizer-ru` (двойной финальный проход)
8. **CHECKLIST** (см. ниже) - перед delivery

## Pre-Delivery Checklist

- [ ] Dark background (#0A0A0A или #111111) - НЕ white
- [ ] Gold accent (#C8A951) used as punctuation, не flood (max 15% area)
- [ ] SB Sans Display / Montserrat typography
- [ ] Не centered-everything layout
- [ ] Anti-Slop: каждый абзац имеет specific number
- [ ] Brand tone matches специфическому бренду (GENGLASS ≠ VALONTI ≠ GLASS-MEMORY)
- [ ] Никаких generic AI patterns («В мире современного...», «гордимся», «инновационные»)
- [ ] CTAs are action-oriented с urgency (но для GLASS-MEMORY - без давления)
- [ ] Числа актуальные (27 000+ orders, 350+ projects, не v8 13 500 / 160+)

## Output mark

```yaml
---
brand: genglass|valonti|gentero|metal-gm|glass-memory
voice_audit: passed|failed
forbidden_hits: 0
ready_for_humanizer: true
ready_for_feniks: true
---
```

## Reference

- Detailed colors per brand: `references/brand-colors.md`
- Production facts data bank (Anti-Slop source-of-truth): `references/product-facts.md`
- Full anti-slop blocklist: `.claude/skills/humanizer-ru/SKILL.md`
- Glossary v2.1 (термины): `/home/user/t1/glossary.md`
- FENIX brand-fit checkpoints: `.claude/skills/phoenix-eval/SKILL.md` (B16-B20)
