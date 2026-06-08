# Skill Atomization - Inventory (2026-06-08)

Source: 14 .skill архивов из Claude.ai global skills, импортированы пользователем в `incoming-skills/`.

## Map: v8 source → v9 target

| # | v8 source skill | Lines | References | v9 equivalent | Status |
|---|---|---|---|---|---|
| 1 | gengroup-aio-recon | 353 | - | (none) | **NEW** - кандидат на новый skill |
| 2 | gengroup-brand | 158 | brand-colors.md (61), product-facts.md (61) | `.claude/skills/brand/` | dup, надо мержить (v8 has real refs) |
| 3 | gengroup-competitor-intel | 106 | - | `.claude/skills/competitor-intel/` | dup, надо мержить |
| 4 | gengroup-content-expert | 732 | - | (none) | **NEW** - самый большой artifact |
| 5 | gengroup-content-factory | 140 | channels.md (50), positioning.md (34) | `.claude/skills/content-factory/` | dup, надо мержить (v8 has refs) |
| 6 | gengroup-crisis-response | 115 | - | `.claude/skills/crisis-response/` | dup, надо мержить |
| 7 | gengroup-cross-sell | 129 | - | `.claude/skills/cross-sell/` | dup - **v8 has 317 products matrix**, мой stub беднее |
| 8 | gengroup-encyclopedia | 144 | - | `.claude/skills/encyclopedia/` | dup, надо мержить |
| 9 | gengroup-geo-aeo | 104 | - | `.claude/skills/geo-aeo/` | dup, надо мержить |
| 10 | gengroup-humanizer-ru | 211 | - | `.claude/skills/humanizer-ru/` | dup, надо мержить |
| 11 | gengroup-phoenix-eval | 163 | benchmarks.md (54), dispute-template.md (54) | `.claude/skills/phoenix-eval/` | dup, надо мержить (v8 has refs) |
| 12 | gengroup-reality-audit | 366 | - | `.claude/skills/protocol-9-runner/` | dup (другое имя) |
| 13 | gengroup-seo-manual | 324 | - | (none) | **NEW** - SEO pipeline без n8n |
| 14 | gengroup-seo-pipeline | 358 | - | (none) | **NEW** - SEO через n8n + 3 workflows |

**Total source:** 20 файлов, 3 717 строк
**Net new candidates:** 4 (aio-recon, content-expert, seo-manual, seo-pipeline)
**Merge candidates:** 10 (все остальные)

## Атомы для извлечения

Из inventory headers видны конкретные ценные атомы:

1. **cross-sell matrix v3.1** - 317 продуктов, 16 категорий, 312 hyperlinks (мой stub содержит только template)
2. **brand references** - brand-colors.md + product-facts.md (реальные данные, у меня нет)
3. **phoenix-eval references** - benchmarks.md (CR/CAC/LTV per industry) + dispute-template.md
4. **content-factory references** - channels.md (TG/VK/Дзен limits) + positioning.md (per brand)
5. **aio-recon 8-step process** - 4 AI системы, URL верификация, HTML-лендинг
6. **content-expert** - конкретные benchmarks Miralls/Dantone Home/Askona
7. **humanizer-ru 30 patterns** - нужно сверить с моими 30 (могут отличаться)
8. **seo-manual orchestration** - оркестрирует 6 skills (content-expert/humanizer-ru/brand/geo-aeo/cross-sell/encyclopedia)
9. **seo-pipeline n8n workflows** - 3 готовых workflow с spec
10. **reality-audit** - 366 строк vs мой 220-строчный protocol-9-runner

## Multi-lens decomposition plan

Каждый агент анализирует по своему lens. Запуск параллельный.

| Lens | Агент | Скоп | Что ищет |
|---|---|---|---|
| Adversarial inventory | **ФЕНИКС** | Все 14 | Дубликаты, конфликты, hidden assumptions, что keep/refactor/discard |
| Data & numbers | **ДАТА** | Все 14 + references | Все цифры с источниками, фактические данные для семантической памяти |
| Brand voice fit | **МАРКО** (+ skill brand) | 8 контентных | Соответствие voice 5 брендов, что про мерж |
| Sales applicability | **ВИКТОР** | competitor-intel, encyclopedia, cross-sell | Что работает в живом диалоге |
| Cost-benefit | **РОМАН** | Все 14 | Token cost vs outcome value, ROMI per skill |
| AI Visibility | **СЕМЁН** | aio-recon, geo-aeo, seo-manual, seo-pipeline | Что про AI Citation Rate |
| Anti-Median | **КРЕА** | content-expert, content-factory | Default LLM сгенерит то же? |
| Packaging | **ЭММА** | brand, encyclopedia | JTBD-mapping, what-why structure |

## Output target

После decomposition:
- `knowledge/episodes/2026-06/skill-atomization-decomposition.md` - agregated findings
- Per-lens reports в той же папке
- Final reconstructed skills в `.claude/skills/` (с merge для duplicates + 4 new)
- ФЕНИКС iter 2 на каждый final skill, threshold ≥7.5

## Next: run multi-agent decomposition

Парallel agents launched сейчас. Wall time estimate 5-10 minutes.
