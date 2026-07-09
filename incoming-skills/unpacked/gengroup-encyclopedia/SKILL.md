---
name: gengroup-encyclopedia
description: "GENGROUP knowledge base router and fact-checker. The central reference for ALL factual questions about GENGROUP: products, processes, prices, team, regulations, sales methodology, production capabilities, materials, installation. Use BEFORE answering any factual question about GENGROUP to ensure accuracy. Triggers on: any mention of GENGLASS, VALONTI, GENTERO, Metal-GM, GLASS-MEMORY products, specs, prices, processes, team members, regulations, production, materials, installation, delivery, warranty, payment terms. Also triggers on: энциклопедия, регламент, продажи, база знаний, как мы работаем, наш процесс, кто отвечает за. This skill routes to the correct Project Knowledge document and section."
---

# GENGROUP Encyclopedia — Knowledge Router

## Purpose

Prevent factual errors by routing every GENGROUP-related question to the authoritative source in Project Knowledge. This skill does NOT contain the full data — it tells you WHERE to find it.

**Critical rule:** When in doubt about ANY GENGROUP fact — search Project Knowledge FIRST. Never answer from memory alone. Data changes (prices, team, processes).

---

## Document Map (Project Knowledge)

### 1. Энциклопедия GEN GROUP
**Contains:** Complete product encyclopedia across all brands.
**Use when asked about:**
- Product specifications (dimensions, materials, finishes)
- Article/SKU naming conventions (GGP-01-2-B-240-100 format)
- Glass types (clear, tinted, frosted, reeded, film)
- Metal finishes and colors
- Standard sizes and custom capabilities
- Product categories and subcategories
- Production processes (cutting, bending, welding, painting, assembly)
- Materials: steel, aluminum, brass, glass types, stone types
- Partitions: standard vs premium, marketplace vs custom
- Key fact: serial partitions are NOT shower partitions (different segment, usually aluminum)
- Key fact: aluminum is most popular profile material, never remove from catalog

### 2. Регламенты GEN-GROUP
**Contains:** Internal processes, responsibilities, workflows.
**Use when asked about:**
- Order processing workflow
- Who is responsible for what (roles)
- Quality control procedures
- Client communication protocols
- Installation and delivery standards
- Complaint handling process
- Payment terms and procedures (Анна — payments)

### 3. Продажи (1_Продажи.docx)
**Contains:** Sales methodology, scripts, objection handling.
**Use when asked about:**
- Sales funnel stages
- Qualification criteria
- Objection handling scripts
- Pricing methodology
- Discount policies
- CRM workflow in Bitrix24
- Key person: Виталий (РОП GENGLASS)

### 4. Алиса — AI продавец (1_GG-Алиса-для_AI-продавца.docx)
**Contains:** AI sales assistant training data.
**Use when asked about:**
- Chatbot responses and knowledge base
- FAQ for clients
- Product recommendations logic
- Automated sales scripts

### 5. Маркетинговая стратегия 2026 (GENGROUP_Marketing_Strategy_2026.docx)
**Contains:** Full marketing strategy with targets.
**Use when asked about:**
- Revenue targets per brand (GENGLASS 320M, VALONTI 130M, etc.)
- Marketing budgets and channel allocation
- SWOT analysis
- Competitive positioning
- KPIs and metrics
- 3 scenarios (conservative 560M, base 620M, optimistic 680M)
- Priority ranking of brands and initiatives

### 6. AI Master System v7.0 (GENGROUP_AI_MASTER_SYSTEM_v7_0.docx)
**Contains:** Complete agent system architecture.
**Use when asked about:**
- Agent profiles (all 36 agents)
- Council Configurations (CC-01 through CC-15)
- Protocols (1-8)
- СПАРТАК workflow
- ФЕНИКС audit framework
- Governance Layer rules
- HITL checkpoints

### 7. Конкуренты GENGLASS и VALONTI (GENGLASS__и_VALONTI___конкуренты_РФ_.pdf)
**Contains:** Competitor analysis with pricing, positioning.
**Use when asked about:**
- Competitor names, prices, positioning
- Market segments per brand
- Competitive advantages/disadvantages
- Pricing benchmarks

### 8. Research Documents
- **CLAU-GENGLASS_Research_LoftModern_2026.docx** — Market research for GENGLASS segment
- **CLAU-GENTERO_Research_HoReCa_Office_2026.docx** — Market research for GENTERO segment
- **CLAUРынок стеклянных ритуальных изделий.pdf** — Ritual glass market analysis for GLASS-MEMORY
- **CLAUVALONTI_Premium_Furniture_Market_Analysis.pdf** — Premium market analysis for VALONTI

### 9. Presentations & Catalogs
- **1_Презентация_GENGLASS.pdf** — Official GENGLASS presentation
- **VALONTI_каталог.pdf** — VALONTI product catalog

---

## Key People Directory

| Name | Role | Responsibility |
|---|---|---|
| **Иван** | CMO | Marketing strategy, AI system, all brands |
| **Богдан Валайко** | Co-owner | Strategic decisions, final approval |
| **Виталий** | РОП GENGLASS | Sales team management, GENGLASS sales |
| **Дмитрий Янчоглов** | Digital/Bitrix24 | CRM, integrations, forms, webhooks |
| **Наташа Скриптун** | Pricing/Marketplaces | OZON, WB, Avito, pricing strategy |
| **Татьяна Гаврилова** | ПТО/Сметы | Estimates, technical documentation |
| **Анна** | Payments | Payment processing, invoicing |
| **Екатерина** | Top analyst (S-rank) | Data analysis, reporting |

---

## Common Errors to Avoid

These factual errors have appeared in past deliverables. ALWAYS verify:

| Error | Correct |
|---|---|
| GLASS-MEMORY founded 2015 | Founded **2016** |
| Flat 30% dealer discount | **Progressive** discount system |
| OptiWhite glass | **Crystalvision** (+25% premium) |
| Old phone numbers in КП | Check current contacts in Project Knowledge |
| Metal-GM is a marketplace brand | Metal-GM is **B2B contract manufacturing** |
| Brass for profiles | Brass for **hardware only** (hinges, connectors). Profiles = steel/aluminum |
| Aluminum should be removed | Aluminum is **most popular** material, NEVER remove |
| GENTERO = product manufacturer | GENTERO = **zone fitout contractor** (1 object = 6 zones) |

---

## Search Strategy

When you need a GENGROUP fact:

1. **First:** Search Project Knowledge with specific keywords
2. **If not found:** Check this routing table — maybe looking in wrong document
3. **If still not found:** Flag as DATA GAP. Do not guess. Say: "Нет данных в текущей базе знаний. Требуется уточнение у [person]."
4. **If data conflicts:** Priority order: Project Knowledge > Memory > Prompt assumptions
