# FENIX Atomization Verdict - 14 v8 skills (iteration 1)

**Auditor:** ФЕНИКС #35
**Timestamp:** 2026-06-08
**Confidence:** 0.88
**Total atoms identified:** 86

## Atom counts

| Verdict | Count | % |
|---|---|---|
| KEEP | 18 | 21% |
| MERGE_INTO_<v9-skill> | 41 | 48% |
| REFACTOR | 19 | 22% |
| SPLIT_INTO_N | 5 | 6% |
| DISCARD | 3 | 3% |

## Critical findings

### 1. v9 stubs побеждены v8 в большинстве

v9 skills, которые я создал, оказались **скелетами без мяса**. v8 source содержит реальную фактуру: 317-product matrix v3.1, ТУ ДомГласс размеры, industry benchmarks с pessimistic/optimistic диапазонами, 8 content templates.

**v9 побеждает только в:** terminology v2.1 (encyclopedia) + Voice DNA per brand (brand) + 25-checkpoint matrix structure (phoenix-eval) + Phase timings T+0:00 (crisis-response) + Phase Decision tree (geo-aeo).

**v8 побеждает outright в:** competitor-intel (real data: Archpole/Miralls/Cattelan), content-expert (8 templates + ТУ ДомГласс), cross-sell (317-product matrix), seo-manual (Client-First принцип).

### 2. Data conflict: 13 500 vs 27 000 заказов

v8 говорит **«13 500+ заказов, 160+ проектов»** в 8+ файлах.
v9 + agents/data.md говорит **«27 000 заказов с 2018, c=1.0»** (из knowledge/semantic/sales-history-2018-2025.csv).

**Canon:** v9 (27 000). v8 устарел. **Refactor pass обязателен** для всех 8 файлов с устаревшими цифрами.

### 3. 236 em dashes в 17 v8 файлах

Все нужно sanitize перед merge. Anti-Slop hook поймает каждое нарушение.

### 4. Competitor list conflict (требует решения Ивана)

v9: Cassina / Minotti / MR.DOORS / Бельведер
v8: Archpole / Miralls / Loft Designe / LOFFI / Cattelan Italia

**Кто реально конкурент GENGLASS?** Подозрение: v9 hallucination (Minotti как конкурент loft-GENGLASS маловероятен). v8 ближе к РФ-реальности.

## Final synthesis recommendation

### 12 skills после atomization (был 10 v9, +2 net new)

| # | Skill | State | Атомов |
|---|---|---|---|
| 1 | `brand` | MERGED (v9 voice + v8 colors+CSS+facts) | 6 |
| 2 | `competitor-intel` | MERGED (v8 берёт верх для GENGLASS-segment) | 9 |
| 3 | `content-factory` | MERGED (v9 architecture + v8 templates + Client-First) | 8 |
| 4 | **`content-expert`** | **NEW** (8 templates + ТУ ДомГласс + Schema.org templates) | 11 |
| 5 | `crisis-response` | MERGED (v9 phases + v8 Plan B template) | 4 |
| 6 | `cross-sell` | MERGED (v9 bundle palette + v8 16-cat matrix v3.1) | 5 |
| 7 | `encyclopedia` | **SPLIT_INTO_2: encyclopedia-router + glossary-v21** | 4+4 |
| 8 | `geo-aeo` | MERGED (v9 7-point + v8 Schema templates + Yandex Microdata) | 7 |
| 9 | `humanizer-ru` | MERGED (~45 unique паттернов, dedup из v8+v9) | 4 |
| 10 | `phoenix-eval` | MERGED (v9 25-checkpoint + v8 benchmarks.md + dispute-template.md + Inter-Skill Feedback) | 9 |
| 11 | `protocol-9-runner` | MERGED (v9 backbone + v8 genesis story + 10 anti-patterns) | 11 |
| 12 | `video-content` (опционально) | **NEW** (extracted from content-expert Part 12) | 5 |

### 2 slash commands (новые)

- `/aio-recon` - 8-step AI Visibility recon process (из gengroup-aio-recon)
- `/seo-pipeline-manual` - Manual SEO orchestrator (из gengroup-seo-manual)

### 3 templates (в knowledge/semantic/templates/)

- `aio-landing-template.md` (из aio-recon Шаг 7)
- `plan-b-template.md` (из crisis-response v8)
- `content-forge-prompt.md` (из seo-pipeline A14.7)

### Discarded entirely

- `gengroup-seo-pipeline` - deployment artifact, не skill. → переместить в `n8n/`
- `gengroup-aio-recon` (как whole skill) - атомы расходятся в geo-aeo + competitor-intel + slash-command
- `gengroup-seo-manual` (как whole skill) - то же

## 5 open questions для Ивана (блокируют execute)

1. **Cross-sell split:** 1 skill с 2 секциями или 2 отдельных (`cross-sell-matrix` + `bundle-rules`)?
2. **Encyclopedia split:** Согласен с `encyclopedia-router` + `glossary-v21`?
3. **content-expert** как отдельный skill или extension content-factory?
4. **Competitor list:** кто реально конкурент GENGLASS - Archpole/Miralls (v8) или Cassina/Minotti (v9)?
5. **27 000 vs 13 500** заказов - окончательный canon (default: 27 000 per v9 agents/data.md)

## P9 Hard Rules system-wide check

| Rule | Violations | Severity |
|---|---|---|
| Em dash ban | 236 em dashes в 17 v8 files | **BLOCKER** |
| [ДАННЫЕ]/[ГИПОТЕЗА] метки | benchmarks без snapshot date | Medium |
| «Уникальный актив» без механики | brand «premium feel», aio-recon «премиальный лендинг» | Low |
| Data confusion 13500 vs 27000 | 8+ файлов | **HIGH** |

## Confidence breakdown

- 0.88 = high confidence in atom decomposition
- 0.12 deducted на 5 open questions требующих human решения
- Recommend iteration 2 после первого merge - наверняка вылезут детали

## Recommended next steps

1. Ответы Ивана на 5 open questions
2. REFACTOR pass (em dash sweep + 13500→27000 numerical update). Owner: maks или marco
3. Merge per skill (12 итераций)
4. ФЕНИКС iter 2 на каждый merged skill, threshold ≥7.5
5. CLAUDE.md §14 - обновить ссылки на refs
6. Переместить `incoming-skills/unpacked/` → `archive/v8-2026-06/` после успешного merge
