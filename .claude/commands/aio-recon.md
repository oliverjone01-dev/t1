---
description: 8-step AI Visibility recon process - query 4 AI systems (ChatGPT, Perplexity, YandexGPT, Gemini), verify URLs, build competitor matrix, generate HTML team-landing. Sourced from v8 gengroup-aio-recon (atomized to slash command per skill-atomize analysis).
---

You are running **AIO Recon** - GENGROUP AI Visibility competitive intelligence sweep.

Brand to audit: $ARGUMENTS

If $ARGUMENTS is empty - ask user which of 5 brands (GENGLASS / VALONTI / GENTERO / Metal-GM / GLASS-MEMORY).

## Procedure (8 steps)

### Step 1 - Define query cluster

Identify 8-12 priority search queries from `geo-aeo` skill per brand (see "Приоритетные запросы по брендам" section). Examples:
- GENGLASS: «стеклянная перегородка на заказ Москва», «стол из стекла и металла лофт»
- GLASS-MEMORY: «ритуальные изделия из стекла», «дилер ритуального стекла»

### Step 2 - Query 4 AI systems

For each query, capture how each AI system responds:

| System | Method | Capture |
|---|---|---|
| ChatGPT (GPT-4+) | API or manual snapshot | Full answer + cited URLs + competitor mentions count |
| Perplexity | API | Full answer + structured citations |
| YandexGPT / Алиса | Manual via ya.ru | Full answer + mention of GENGROUP vs competitors |
| Google AI Mode / Gemini | Manual via google.com | Full answer + linked sources |

**ANTI-PATTERN warning:** Не путать категории. Miralls = зеркала, не перегородки. Archpole = дерево, не стекло. ПРОМСТЕКЛО = ритуал, не мебель.

### Step 3 - Verify cited URLs

For each URL мentioned by AI - actually fetch and verify:
- URL works (200, not 404)
- Content matches AI claim
- Page has Schema.org markup (Article / Product / Organization / FAQPage)
- Page has Microdata (for Yandex visibility - see `geo-aeo` Yandex Microdata section)

Flag broken URLs или mismatch claims.

### Step 4 - Build competitor matrix

For each priority query, count mentions:

| Query | GENGROUP mentions | Top 3 competitors mentioned | Citation gap |
|---|---|---|---|
| ... | X% | A, B, C | What they have that we don't |

Compute **AI Citation Rate** = % queries в которых GENGROUP упомянут vs total queries.

### Step 5 - Identify gap pages

For each competitor URL cited by AI:
- What page type? (article / product / FAQ / category)
- What 7-point checklist items present? (`geo-aeo` Part 7-point)
- What уникальные facts / hooks / Schema does it have?

Map to **our gap pages** - что у конкурентов есть, чего нет у нас. Top 5-10 gap pages = action list.

### Step 6 - Refresh competitor intel

Cross-check findings with `competitor-intel` skill Q-snapshot. If competitor data >90 days old - flag for Наташа Скриптун Q-refresh.

### Step 7 - Generate team-landing

Produce HTML internal landing for команда with:
- AI Citation Rate baseline + target (per CC-09)
- Top 10 priority gap pages with effort/impact
- Per-system findings (4 AI systems, separate tabs)
- Action plan with owners and deadlines

Use `brand` skill design system (dark + gold + СSS variables). Template path will be `knowledge/semantic/templates/aio-landing-template.md` after first use.

### Step 8 - FENIX gate

Send team-landing through `/feniks` for adversarial review. Threshold ≥7.5 to deliver to Иван.

## Constraints

- **No fake 9.99/10 self-grading** (anti-pattern v8). Real AI Citation Rate is honest.
- **Every metric tagged** [ДАННЫЕ: AI system + date snapshot] or [ГИПОТЕЗА: source]
- **Quarterly refresh** mandatory per CC-09 schedule
- **No competitor disparagement** in team-landing (Anti-pattern from `competitor-intel`)

## Output

Persist в `knowledge/episodes/$(date +%Y-%m)/aio-recon-<brand>-<date>.md`:
- Query cluster used
- 4-system findings table
- Competitor matrix
- Top 10 gap pages
- AI Citation Rate baseline + target
- Action plan with owners
- FENIX score

## Reference

- AI Citation Rate framework: skill `geo-aeo`
- Competitor data Q-snapshot: skill `competitor-intel`
- Yandex Microdata pattern: skill `geo-aeo` Schema.org section
- HTML design system: skill `brand`
- Source v8 process: `incoming-skills/unpacked/gengroup-aio-recon/SKILL.md`
