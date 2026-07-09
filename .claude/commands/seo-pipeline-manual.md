---
description: Manual SEO content pipeline orchestrator - semantic harvest (без Keys.so/n8n) + клустеризация + content plan + Content Forge generation. Orchestrates 5 skills (content-expert + humanizer-ru + brand + geo-aeo + cross-sell). Sourced from v8 gengroup-seo-manual (atomized to slash command per skill-atomize analysis).
---

You are running **Manual SEO Pipeline** - 3-phase content production без external tools (Keys.so / n8n).

Target niche: $ARGUMENTS

If $ARGUMENTS is empty - ask user which brand/category (e.g., «GENGLASS перегородки», «GLASS-MEMORY мемориальное стекло», «VALONTI камень+металл»).

## Procedure (3 phases)

### Phase 1 - Semantic Harvest (без Keys.so)

Manual seed-collection method:

1. **Web search probe** - запустить 10-15 базовых запросов из ниши через WebSearch / WebFetch:
   - «купить [продукт]»
   - «как выбрать [продукт]»
   - «сколько стоит [продукт]»
   - «[продукт] на заказ»
   - «[продукт] Москва»
   - «[продукт] vs [альтернатива]»
2. **Competitor catalog scan** - открыть топ-5 конкурентов из `competitor-intel` skill, выгрузить их title pages по категории
3. **Поисковые подсказки** - manual snapshot через ya.ru autocomplete и google autocomplete
4. **Bitrix24 CRM keywords** - выгрузка реальных формулировок клиентов из заявок (если есть доступ)

**Output Phase 1:** список 100-300 запросов в `knowledge/episodes/$(date +%Y-%m)/semantic-harvest-<niche>.md`.

### Phase 2 - Cluster + Content Plan

1. **Group по intent:**
   - Informational («как выбрать», «что такое», «отличия»)
   - Commercial («купить», «цена», «на заказ», «топ-5»)
   - Transactional («заказать», «калькулятор», «расчёт»)
   - Navigational («[бренд] контакты», «[бренд] доставка»)

2. **Cluster по theme** (5-10 кластеров на нишу). Каждый кластер = 1 pillar + 3-7 satellite (см. `content-expert` Part 3 Cluster Architecture).

3. **Choose template** per article per `content-expert` Part 2 (8 types):
   - Informational → Type 1 Expert Guide или Type 3 Technical Deep Dive
   - Commercial → Type 2 Top-N или Type 5 Comparison
   - Transactional → Type 4 Project Case Study или Type 8 Category SEO
   - FAQ → Type 7 FAQ Hub

4. **Prioritize** по формуле: search volume × intent value × content effort.

**Output Phase 2:** content plan в виде таблицы articles × priority в `knowledge/episodes/$(date +%Y-%m)/content-plan-<niche>.md`.

### Phase 3 - Content Forge Manual (без n8n)

For each top-priority article:

1. **LOAD CONTEXT** - skills: `brand` (voice), `content-expert` (template), `competitor-intel` (для comparison articles), `encyclopedia-router` (facts), `glossary-v21` (terminology)
2. **WRITE DRAFT** following `content-expert` 12-step Workflow (Part 12)
3. **HUMANIZER PASS** - `humanizer-ru` double final pass (51 patterns)
4. **GEO-AEO** check - 7-point checklist (`geo-aeo` Part 7-point) + Schema.org templates (`content-expert` Part 8) + Yandex Microdata
5. **CROSS-SELL HINTS** - add product widgets per `cross-sell` matrix v3.1
6. **FENIX GATE** - `/feniks <draft>` для adversarial review. Threshold ≥7.5.

**Output Phase 3:** 6-block deliverable per `content-expert` Part 9 Workflow (META / ТЕКСТ / ИЛЛЮСТРАЦИИ / SCHEMA / GEO-AEO / ПЕРЕЛИНКОВКА).

## 5-skill orchestration

This command orchestrates these skills in sequence:
1. `content-expert` (templates + SEO engine + Schema)
2. `humanizer-ru` (51-pattern dedup pass)
3. `brand` (voice DNA per brand)
4. `geo-aeo` (7-point checklist + Yandex Microdata)
5. `cross-sell` (inline product widgets)

## Constraints

- **No Keys.so** - all keywords manual + web search probe
- **No n8n** - all pipeline manual through Claude Code
- **Client-First Principle** (см. `content-factory` Client-First section) - всегда структура от задачи читателя, не каталога
- **Anti-Slop hook** будет ловить нарушения автоматически

## Output

Final article persisted в:
- `knowledge/episodes/$(date +%Y-%m)/articles/<slug>.md`

Plus:
- Semantic harvest log
- Content plan
- FENIX audit report per article (`knowledge/episodes/$(date +%Y-%m)/feniks-audit-<slug>.md`)

## Reference

- Content templates: skill `content-expert` (8 types + SEO engine)
- AI Visibility: skill `geo-aeo`
- Anti-Slop: skill `humanizer-ru`
- Brand voice: skill `brand`
- Cross-sell widgets: skill `cross-sell`
- Source v8 process: `incoming-skills/unpacked/gengroup-seo-manual/SKILL.md`

## n8n alternative (Sprint 4+)

When n8n integration ready - this manual pipeline can be replaced by `/seo-pipeline-n8n` slash (3 workflows: Semantic Harvester / Content Forge / AI Visibility Monitor per v8 source). Until then - this manual command is the working pipeline.
