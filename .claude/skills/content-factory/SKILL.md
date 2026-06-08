---
name: content-factory
description: Structured 3-stage production workflow for GENGROUP marketing/sales content - КП, landing pages, sales scripts, social posts, email sequences, dealer materials, marketplace cards. Auto-invoke on - write/draft/create/produce/нпсать/составить/сделать + content/copy/текст/контент. Triggers - КП, коммерческое предложение, лендинг, скрипт продаж, пост, рассылка, презентация, дилерские материалы, content, copy, marketing. Enforces 3-stage workflow (Context Capture → Production → Shadow Test), Anti-Slop standard, FENIX gate. Complements content-expert (long-form articles) and brand (voice). References channels.md and positioning.md.
---

# Content-Factory - 3-stage workflow + channel templates

## When to invoke

Auto-trigger на production tasks: КП / landing / scripts / posts / email / dealer materials / marketplace cards. Любая «напиши контент» команда.

**Complementarity:** content-expert обслуживает website articles (deep long-form). content-factory обслуживает структурированные deliverables (КП, lending, social). Brand voice load - через skill `brand`. Production facts - `brand/references/product-facts.md`.

## Stage 1 - Context Capture (Быстрый бриф)

Перед написанием - собрать ответы на 7 вопросов. Если есть в Project Knowledge или прошлом контексте - auto-extract. Только gaps - спросить пользователя.

### 7 Required Context

1. **Brand:** Какой из 5 (определяет tone, colors, audience)
2. **Format:** КП / Landing / Script / Post / Email / Presentation / Marketplace / Other
3. **Audience:** B2C buyer / B2B designer / Dealer / HoReCa decision-maker / Other
4. **Goal:** Что должен СДЕЛАТЬ читатель после прочтения? (Call, fill form, sign contract, order sample-box)
5. **Key products/services** to feature (модели, категории, capabilities)
6. **Competitive context:** Why us vs alternatives? (Load `references/positioning.md`)
7. **Constraints:** Deadline, budget, format requirements, platform specifics

### Auto-fill from Project Knowledge

- Brand positioning → `references/positioning.md` или `GENGROUP_Marketing_Strategy_2026.docx`
- Product specs → `brand/references/product-facts.md` или Энциклопедия
- Competitor data → skill `competitor-intel`
- Sales process → `1_Продажи.docx`
- Regulations → `1_Регламенты_GEN-GROUP.docx`

## Stage 2 - Production (Anti-Slop Draft)

### Content Architecture by Format

**КП (Commercial Proposal) - 10 blocks:**

1. **COVER** - Brand + client name + date + project type
2. **HOOK** - 1 sentence: why THIS solution for THIS client (не generic)
3. **ABOUT** - 3-4 facts with numbers (16 000м², 27 000+ заказов, specific capability)
4. **SOLUTION** - Products/services tailored to client's stated need
5. **PORTFOLIO** - 2-3 relevant completed projects with photos and specs
6. **PRICING** - Table with options (Good/Better/Best или by zone для GENTERO)
7. **PROCESS** - Timeline: order → production → delivery → installation
8. **GUARANTEES** - Specific terms, не vague promises
9. **CTA** - Next step with deadline («Ответьте до [дата] для фиксации цены»)
10. **CONTACTS** - Named manager, direct phone, branded footer

**Landing Page (HTML) - 10 sections:**

1. **HERO** - Full-bleed image/video + H1 hook + CTA above fold
2. **PAIN → SOLUTION** - 3 pain points → 3 GENGROUP answers
3. **SOCIAL PROOF** - Numbers bar (27 000+ заказов, 16 000м², 8 лет)
4. **PRODUCTS** - Interactive grid / carousel (не static list)
5. **CALCULATOR / CONFIGURATOR** - if applicable (preference over catalog)
6. **PROCESS** - Visual timeline (4-5 steps)
7. **PORTFOLIO** - Photo grid with project details
8. **REVIEWS** - Real quotes with names and projects
9. **FAQ** - Top 5-7 real objections addressed
10. **CTA FINAL** - Form with phone gating + urgency element

**Sales Script - 5 steps:**

1. **OPENER** - Question that qualifies immediately (НЕ «Здравствуйте, меня зовут...»)
2. **QUALIFY** - Budget / Timeline / Decision-maker / Previous experience
3. **PRESENT** - 3 key benefits matched to qualification answers
4. **OBJECTION HANDLING** - Top 5 objections с specific responses (load `competitor-intel` + `references/positioning.md`)
5. **CLOSE** - Trial close → Calendar commitment → Next step with deadline

**Social Media Post - 4 blocks:**

1. **HOOK** (first 2 lines) - Stop-scroll: fact, провокация или вопрос
2. **BODY** - 3-5 short paragraphs, each self-contained
3. **CTA** - Specific action (link, DM, comment)
4. **HASHTAGS** - Brand + niche + location (если relevant)

**Email Sequence:**

- 5-7 писем, частота 2-5 дней
- Каждое = одна mission (welcome / educate / soft-pitch / case / urgency / re-engagement / hard-pitch)
- Subject ≤50 знаков, без emoji, без КАПСА

**Marketplace Card (WB/Ozon/Я.Маркет):**

- Title: модель + палитра + размер + размерности
- Description: ≥1000 знаков structured (что / для кого / габариты / материалы / комплектация / срок / гарантия)
- 8+ фото + 1 видео

### Channel-specific limits

См. `references/channels.md` - детальные правила по каналам (Telegram / VK / Дзен / Email / OZON+WB).

Quick reference:

| Канал | Длина | Особенности |
|---|---|---|
| Telegram | 200-1500 знаков | Hook в первых 2 строках. Emoji умеренно (1-2). 10:00-12:00 / 18:00-20:00 MSK |
| VK | 1000-3000 знаков | Карусели до 10 фото. Хэштеги 3-5. Кнопки-действия |
| Дзен | 500-2000 слов | SEO-заголовок. «Как выбрать», «Ошибки при», «Сравнение». НЕ копипаст с сайта |
| Email | 200-400 слов B2C / до 600 B2B | Subject ≤50. Одна главная CTA |
| OZON / WB | 1000-2000 знаков | 7+ фото с инфографикой. 5-7 буллетов с цифрами |

## Stage 3 - Shadow Test (FENIX gate)

Перед delivery - adversarial quality check. См. полный workflow в `phoenix-eval` skill.

### 5 FENIX Pre-delivery questions

1. **DATA CHECK:** Все ли числа точны по Project Knowledge? (Даты, цены, спеки)
2. **ANTI-SLOP:** Могла бы default ChatGPT сгенерить это без GENGROUP context? Если YES → rewrite
3. **AUDIENCE FIT:** Целевая аудитория реально откликнется на этот язык? (B2C ≠ B2B ≠ dealer)
4. **CTA STRENGTH:** Clear, urgent next step? Или fade out?
5. **BRAND CONSISTENCY:** Tone соответствует конкретному бренду? (GENGLASS ≠ GLASS-MEMORY)

### Scoring

Rate 1-10: Accuracy, Impact, Brand Fit, Actionability, Anti-Slop. Threshold ≥8.0 average to deliver. Below 8.0 → iterate. Полная checklist - `phoenix-eval` skill.

## Anti-Slop Enforcement (continuous during writing)

- [ ] Каждый абзац содержит ≥1 specific number (₽, %, м², дней, units)
- [ ] Ни одно предложение не начинается с «В мире современного...» или generic openers
- [ ] Нет `мы гордимся`, `инновационные решения`, `широкий ассортимент` без proof (см. полный 51-pattern blocklist в `humanizer-ru`)
- [ ] Client benefit stated before feature description (WIIFM first)
- [ ] Competitive differentiation specific, не «лучше конкурентов»
- [ ] CTA has urgency mechanism (deadline, limited slots, price lock)

Полный 51-pattern checklist - skill `humanizer-ru`.

## Client-First Principle (главный)

Типичный читатель - женщина 28-45, делает ремонт или купила студию. Техэкспертиза около нуля. Боится:
- что стекло разобьётся
- что будет дорого
- что монтаж разрушит ремонт

Структура любого контента строится **от её задачи**, не от каталога:

1. Какую задачу ты решаешь?
2. Какой вариант тебе подходит?
3. Это безопасно? Нужно ли согласовывать?
4. Сколько это стоит? (3 бюджета: эконом / оптимум / премиум)
5. Как проходит процесс?
6. Не пожалею ли? (кейсы, отзывы)
7. Что делать прямо сейчас? (CTA)

## Format-Specific Notes

### GLASS-MEMORY dealer materials

- Current sources: Бриф v5 + Сценарий Лебедев
- Old КП/презентации OUTDATED: wrong phones, flat 30% discount (now progressive), OptiWhite (now Crystalvision +25%), year 2015 (correct: 2016)
- Всегда проверять Project Knowledge для актуального pricing перед генерацией КП

### GENGLASS calculator / configurator pages

- Configurator preferred over catalog (избегает price benchmarking серийных позиций)
- Custom configuration = unbenchmarkable = higher conversion
- Good CPL из Yandex.Direct correlates с traffic to custom order landing, НЕ catalog

### GENTERO B2B materials

- Position as «единый подрядчик по зональному фитауту», НЕ product manufacturer
- «1 объект = 6 зон» концепт обязательно в каждом GENTERO piece
- Zone unity увеличивает контракт x3-5 - quantify в каждом proposal

## Reference

- `references/channels.md` - детальные правила Telegram/VK/Дзен/Email/OZON+WB
- `references/positioning.md` - taglines + elevator pitches + top objections per 5 brands
- Brand voice DNA + Master Design System: skill `brand`
- Anti-Slop blocklist (51 patterns): skill `humanizer-ru`
- Long-form для website (8 templates): skill `content-expert`
- Competitor data: skill `competitor-intel`
- FENIX gate: skill `phoenix-eval`
