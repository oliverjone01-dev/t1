---
name: encyclopedia-router
description: GENGROUP knowledge base router and fact-checker. Use BEFORE answering any factual question about GENGROUP - products, prices, processes, team, regulations, sales methodology, materials, installation. Auto-invoke on - энциклопедия, регламент, продажи, база знаний, как мы работаем, кто отвечает за, where to find, source-of-truth. Routes to authoritative Project Knowledge document. Catches common factual errors (GLASS-MEMORY 2016 not 2015, Crystalvision not OptiWhite, progressive discount not flat 30%, etc).
---

# Encyclopedia-Router - Knowledge Base Router

## Purpose

Prevent factual errors by routing every GENGROUP-related question to the authoritative source in Project Knowledge. This skill does **NOT** contain the full data - it tells you **WHERE** to find it.

**Critical rule:** When in doubt about ANY GENGROUP fact - search Project Knowledge FIRST. Never answer from memory alone. Data changes (prices, team, processes).

**Sibling skill:** `glossary-v21` - terminology consistency checker (палитра / линия / коллекция / комплект). Use both: router tells you WHERE, glossary tells you WHAT terms mean.

## Document Map (Project Knowledge in repo root)

### 1. Энциклопедия GEN GROUP

**Path:** `1_Энциклопедия_GEN_GROUP__1_.docx`

**Use for:** product specifications, dimensions, materials, finishes, SKU naming, glass types, metal finishes, standard sizes, production processes.

**Key facts:**
- Serial partitions are NOT shower partitions (different segment, usually aluminum)
- Aluminum is most popular profile material - never remove from catalog
- Brass is for hardware (hinges, connectors), not profiles

### 2. Регламенты GEN-GROUP

**Path:** `1_Регламенты_GEN-GROUP.docx`

**Use for:** order processing, role responsibilities, QC procedures, client communication protocols, installation standards, complaint handling, payment terms.

### 3. Продажи

**Path:** `1_Продажи.docx`

**Use for:** sales funnel stages, qualification criteria, objection handling, pricing methodology, discount policies, CRM workflow in Bitrix24.

**Key person:** Виталий (РОП GENGLASS).

### 4. Алиса (AI-продавец)

**Path:** `1_GG-Алиса-для_AI-продавца.docx`

**Use for:** chatbot responses, FAQ, product recommendations logic, automated sales scripts.

### 5. Маркетинговая стратегия 2026

**Path:** `GENGROUP_Marketing_Strategy_2026.docx`

**Use for:** revenue targets per brand, marketing budgets, channel allocation, SWOT, KPIs.

**Key targets [ГИПОТЕЗА: v8 product-facts.md, требует CFO confirmation]:** GENGLASS 320M / VALONTI 130M / GENTERO 180M / Metal-GM 70M / GLASS-MEMORY 50M = 750M total.

### 6. AI Master System v7-v8 (legacy reference)

**Path:** `GENGROUP_AI_MASTER_SYSTEM_v7_0.docx` + `GENGROUP_v8_PRO_CHANGELOG.md`

**Use for:** legacy v7-v8 agent profiles, original Council Configurations CC-01 to CC-15, original protocols 1-8. **NOTE:** v9 system overrides - see `agents-v9/MASTER_SYSTEM_v9.md` and `CLAUDE.md` first.

### 7. Конкуренты GENGLASS и VALONTI

**Path:** `GENGLASS__и_VALONTI___конкуренты_РФ_.pdf`

**Use for:** competitor names, prices, positioning, market segments, advantages/disadvantages, pricing benchmarks. См. также skill `competitor-intel`.

### 8. Research documents

- `CLAU-GENGLASS_Research_LoftModern_2026.docx` - GENGLASS segment
- `CLAU-GENTERO_Research_HoReCa_Office_2026.docx` - GENTERO segment
- `CLAUРынок_стеклянных_ритуальных_изделии__в_России__глубокии__анализ_для_GlassMemory.pdf` - ritual glass for GLASS-MEMORY
- `CLAUVALONTI_Premium_Furniture_Market_Analysis__Russia_20242025_Strategic_Opportunities.pdf` - VALONTI premium

### 9. Presentations & Catalogs

- `1_Презентация_GENGLASS.pdf` - official GENGLASS
- `VALONTI_каталогcompressed.pdf` - VALONTI product catalog

### 10. PRL series (Production Reality Library v0-v8)

8 PDF files `GENGROUP_PRL_v0..v8_*.pdf` + `GENGROUP_PRL_D1_Data_Pack_v1_0.pdf` + `GENGROUP_PRL_Pocket_Cards_v1_0.pdf`. Use for: production infrastructure, equipment, glass production, metal production, finishing processes, brands, regulations, logistics, glossary.

### 11. Protocol 9 Reality Audit

**Path:** `GENGROUP_Protocol_9_Reality_Audit.docx`

**Use for:** doctrinal reference for P9. Operational version - skill `protocol-9-runner`.

## Key People Directory

| Name | Role | Responsibility |
|---|---|---|
| **Иван Раюшкин** | CMO | Marketing strategy, AI system, all brands. Final approval gate |
| **Богдан Валайко** | Co-owner | Strategic decisions, escalation L2+ |
| **Виталий** | РОП GENGLASS | Sales team management, GENGLASS sales |
| **Дмитрий Янчоглов** | Digital/Bitrix24 | CRM, integrations, forms, webhooks |
| **Наташа Скриптун** | Pricing/Marketplaces | OZON, WB, Avito, pricing strategy, Q-snapshot competitor refresh |
| **Татьяна Гаврилова** | ПТО / Сметы | Estimates, technical documentation |
| **Анна** | Payments | Payment processing, invoicing |
| **Екатерина** | Top analyst (S-rank) | Data analysis, reporting |

## Common Errors to Avoid

These factual errors have appeared in past deliverables. **ALWAYS verify:**

| Error | Correct |
|---|---|
| GLASS-MEMORY founded 2015 | Founded **2016** [ДАННЫЕ: brand/references/product-facts.md] |
| Flat 30% dealer discount | **Progressive** discount system |
| OptiWhite glass | **Crystalvision** (+25% premium) |
| Old phone numbers in КП | Check current contacts in PK |
| Metal-GM is a marketplace brand | Metal-GM is **B2B contract manufacturing** |
| Brass for profiles | Brass for **hardware only**. Profiles = steel / aluminum |
| Aluminum should be removed | Aluminum is **most popular** profile, NEVER remove |
| GENTERO = product manufacturer | GENTERO = **zone fitout contractor** (1 object = 6 zones) |
| 13 500+ orders | **27 000+** orders (v9 canon per data agent) |
| 160+ projects | **350+** projects (v9 canon) |
| GM-METAL (old name) | **Metal-GM** (canonical since May 2026) |

## Search Strategy

When you need a GENGROUP fact:

1. **First:** Search Project Knowledge with specific keywords
2. **If not found:** Check Document Map above - maybe wrong document
3. **If still not found:** Flag as DATA GAP. Do not guess. Say: «Нет данных в текущей базе знаний. Требуется уточнение у [person из Key People]»
4. **If data conflicts:** Priority order from CLAUDE.md §10 - **Semantic > Procedural > Episodic > Working** (свежие фактические данные побеждают свежие воспоминания)

## When to use sibling skill

| Question type | Use this skill | Use glossary-v21 |
|---|---|---|
| «Какая цена / срок / спека X?» | ✅ routes to PK | - |
| «Это палитра или коллекция?» | - | ✅ terminology check |
| «Кто отвечает за выгрузку 1С?» | ✅ routes to Регламенты | - |
| «Чем линия отличается от коллекции?» | - | ✅ terminology |
| «GM-METAL → Metal-GM правильно?» | ✅ common errors table | ✅ also catches |

## Reference

- Sibling: skill `glossary-v21` for terminology v2.1
- Memory tiering hierarchy: `CLAUDE.md` §10
- v9 system override notes: `agents-v9/MASTER_SYSTEM_v9.md`
- Sources of truth: `CLAUDE.md` §14
