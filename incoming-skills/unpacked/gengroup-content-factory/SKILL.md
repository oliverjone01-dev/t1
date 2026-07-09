---
name: gengroup-content-factory
version: 1.1.0
description: "Structured workflow for producing GENGROUP marketing content: commercial proposals (КП), landing pages, sales scripts, social media posts, email sequences, dealer materials, presentations. Use whenever asked to write, draft, create, or produce any marketing or sales content for GENGLASS, VALONTI, GENTERO, Metal-GM, or GLASS-MEMORY. Triggers on: КП, коммерческое предложение, лендинг, скрипт продаж, пост, рассылка, презентация, дилерские материалы, content, copy, текст, контент. This skill enforces the GENGROUP Anti-Slop standard and 3-stage co-authoring workflow."
---

# GENGROUP Content Factory

## Overview

This skill provides a structured 3-stage workflow for producing any marketing/sales content for GENGROUP brands. It enforces Anti-Slop standards, brand consistency, and adversarial quality checks.

**Before starting:** Load `gengroup-brand` skill for visual standards. Both skills work together.

---

## Stage 1: CONTEXT CAPTURE (Быстрый бриф)

Before writing, gather answers to these 7 questions. If information is available in Project Knowledge or past context — extract it automatically. Only ask the user for gaps.

### Required Context
1. **Brand:** Which of the 5 brands? (Determines tone, colors, audience)
2. **Format:** КП / Landing / Script / Post / Email / Presentation / Other
3. **Audience:** B2C buyer / B2B designer / Dealer / HoReCa decision-maker / Other
4. **Goal:** What should the reader DO after consuming this? (Call, fill form, sign contract, order sample-box)
5. **Key products/services** to feature (specific models, categories, or capabilities)
6. **Competitive context:** Why us vs alternatives? (Load from references/positioning.md)
7. **Constraints:** Deadline, budget, format requirements, platform specifics

### Auto-fill from Project Knowledge
- Brand positioning → GENGROUP_Marketing_Strategy_2026.docx
- Product specs → Энциклопедия GEN GROUP
- Competitor data → GENGLASS и VALONTI конкуренты РФ.pdf
- Sales process → 1_Продажи.docx
- Regulations → 1_Регламенты_GEN-GROUP.docx

---

## Stage 2: PRODUCTION (Anti-Slop Draft)

### Content Architecture by Format

**КП (Commercial Proposal):**
```
1. COVER — Brand + client name + date + project type
2. HOOK — 1 sentence: why THIS solution for THIS client (not generic)
3. ABOUT — 3-4 facts with numbers (16000m², 13500+ orders, specific capability)
4. SOLUTION — Products/services tailored to client's stated need
5. PORTFOLIO — 2-3 relevant completed projects with photos and specs
6. PRICING — Table with options (Good/Better/Best or by zone for GENTERO)
7. PROCESS — Timeline: order → production → delivery → installation
8. GUARANTEES — Specific terms, not vague promises
9. CTA — Next step with deadline ("Ответьте до [дата] для фиксации цены")
10. CONTACTS — Named manager, direct phone, branded footer
```

**Landing Page (HTML):**
```
1. HERO — Full-bleed image/video + H1 hook + CTA above fold
2. PAIN → SOLUTION — 3 pain points → 3 GENGROUP answers
3. SOCIAL PROOF — Numbers bar (13500+ заказов, 16000m², X лет)
4. PRODUCTS — Interactive grid/carousel (not static list)
5. CALCULATOR/CONFIGURATOR — If applicable (preference over catalog)
6. PROCESS — Visual timeline (4-5 steps)
7. PORTFOLIO — Photo grid with project details
8. REVIEWS — Real quotes with names and projects
9. FAQ — Top 5-7 real objections addressed
10. CTA FINAL — Form with phone gating + urgency element
```

**Sales Script:**
```
1. OPENER — Question that qualifies immediately (not "Здравствуйте, меня зовут...")
2. QUALIFY — Budget / Timeline / Decision-maker / Previous experience
3. PRESENT — 3 key benefits matched to qualification answers
4. OBJECTION HANDLING — Top 5 objections with specific responses
5. CLOSE — Trial close → Calendar commitment → Next step with deadline
```

**Social Media Post:**
```
1. HOOK (first 2 lines) — Stop-scroll: fact, provocation, or question
2. BODY — 3-5 short paragraphs, each self-contained
3. CTA — Specific action (link, DM, comment)
4. HASHTAGS — Brand + niche + location (if relevant)
```

### Anti-Slop Enforcement Checklist

During writing, continuously verify:
- [ ] Every paragraph contains ≥1 specific number (₽, %, m², days, units)
- [ ] No sentence starts with "В мире современного..." or similar generic openers
- [ ] No "мы гордимся", "инновационные решения", "широкий ассортимент" without proof
- [ ] Client benefit stated before feature description (WIIFM first)
- [ ] Competitive differentiation is specific, not "лучше конкурентов"
- [ ] CTA has urgency mechanism (deadline, limited slots, price lock)

---

## Stage 3: SHADOW TEST (ФЕНИКС Review)

Before delivery, run adversarial quality check:

### 5 ФЕНИКС Questions
1. **DATA CHECK:** Are all numbers accurate per Project Knowledge? (Dates, prices, specs)
2. **ANTI-SLOP:** Could default ChatGPT generate this without GENGROUP context? If YES → rewrite.
3. **AUDIENCE FIT:** Would the target audience actually respond to this language? (B2C ≠ B2B ≠ dealer)
4. **CTA STRENGTH:** Is there a clear, urgent next step? Or does it fade out?
5. **BRAND CONSISTENCY:** Does tone match the specific brand? (GENGLASS ≠ GLASS-MEMORY)

### Scoring
Rate 1-10 on: Accuracy, Impact, Brand Fit, Actionability, Anti-Slop Compliance.
**Threshold:** ≥8.0 average to deliver. Below 8.0 → iterate.

---

## Reference Files

- `references/positioning.md` - Brand positioning statements and competitor differentiators
- `references/channels.md` - Channel-specific rules: Telegram, VK, Дзен, Email, OZON/WB (format limits, best practices, anti-patterns)
- `references/golden-examples.md` - [PLACEHOLDER: top-5 КП и top-3 лендинга с результатами. Заполняется Иваном, апрель 2026]

---

## Format-Specific Notes

### For GLASS-MEMORY dealer materials:
- Current data sources: Бриф v5 + Сценарий Лебедев
- Old КП/presentations are OUTDATED: wrong phones, flat 30% discount (now progressive), OptiWhite (now Crystalvision +25%), year 2015 (correct: 2016)
- Always check Project Knowledge for latest pricing before generating КП

### For GENGLASS calculator/configurator pages:
- Configurator preferred over catalog (avoids price benchmarking of serial items)
- Custom configuration = unbenchmarkable = higher conversion
- Good CPL from Yandex.Direct correlates with traffic to custom order landing, NOT catalog

### For GENTERO B2B materials:
- Position as "единый подрядчик по зональному фитауту", NOT product manufacturer
- "1 объект = 6 зон" concept must be present in every GENTERO piece
- Zone unity increases contract value 3-5x — quantify this in every proposal
