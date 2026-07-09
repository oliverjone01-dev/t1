# Session Handoff - продолжение работы в новой сессии

**Дата handoff:** 2026-06-08
**Предыдущая сессия:** atomization v8 → v9 complete + FENIX iter-2 batch audit
**Текущая ветка:** `gengroup-agents-v9` (10+ коммитов поверх main)
**Открытый PR:** #2 (https://github.com/oliverjone01-dev/t1/pull/2) - v9.0 GA, ждёт Иван merge approval

## Как стартовать новую сессию

### Вариант A - терминал
```bash
cd /path/to/t1
git checkout gengroup-agents-v9
git pull
claude
```

### Вариант B - claude.ai/code
Открыть проект `oliverjone01-dev/t1`, переключиться на ветку `gengroup-agents-v9`.

## Первая команда в новой сессии

```
Читай knowledge/episodes/2026-06/HANDOFF-next-session.md и продолжай Tier 1.
```

CLAUDE.md загрузится автоматически - вся v9 система (12 агентов, 12 skills, 7 slash commands, 4 schemas, 2 hooks) уже там.

## Что сделано (контекст)

### v9 system live
- 12 subagents: feniks, spartak, marco, data, viktor, boris, emma, maks, semyon, krea, roman, trener
- 12 skills: brand, competitor-intel, content-expert, content-factory, crisis-response, cross-sell, encyclopedia-router, geo-aeo, glossary-v21, humanizer-ru, phoenix-eval, protocol-9-runner
- 7 slash commands: /reality-audit, /feniks, /council, /crisis, /skill-atomize, /aio-recon, /seo-pipeline-manual
- 4 JSON schemas (a2a-message, audit-report, council-vote, roadmap-entry) - все valid + smoke test passes
- 2 hooks (p9-trigger-detector, anti-slop-checker) - active

### Atomization complete (4 batches)
14 v8 .skill archives → 12 v9 skills + 2 slash commands. Full summary: `knowledge/episodes/2026-06/skill-atomization-summary.md`.

### FENIX iter-2 batch audit complete (12/12)
Полный scoreboard и meta-findings: `knowledge/episodes/2026-06/feniks-iter2-batch-summary.md`.

Mean 7.49 / Median 7.95 / 7 GO + 4 RETURN + 1 VETO.

## Что осталось (rework backlog)

### Tier 1 - BLOCKING (do this first in new session)

#### 1. phoenix-eval VETO (5.50/10)

**Critical:** audit tool fails own discipline. Все остальные GO verdicts суспектны до этого fix.

Файл: `.claude/skills/phoenix-eval/SKILL.md`
Audit report: `knowledge/episodes/2026-06/feniks-audit-phoenix-eval-v2.md`

Top-3 gaps (Actionability 3.0, Risk 3.0):
- Нет SLA для audit duration
- Нет early-exit логики
- Нет fallback owner
- Нет North Star metric самого skill
- Нет crisis-mode behavior (что во время Protocol 8?)
- Нет reversibility (retract ошибочного «go»)
- Calibration: веса 25/25/20/15/15 без обоснования, thresholds без validation dataset

**Action plan:**
1. Прочитать полный audit report
2. Добавить «Skill metadata» секцию: owner, SLA (max 15 min for solo audit), invocation triggers, fallback owner Иван
3. Добавить «Crisis-mode» секцию: что делать при Protocol 8 active
4. Добавить «Reversibility» секцию: процедура retract verdict
5. Добавить «Calibration rationale» секцию: почему 25/25/20/15/15 (with reference to McKinsey 5-criterion matrix)
6. **Иван calibration cross-check:** запустить /feniks на 3 реальных deliverables, сравнить с human review

#### 2. brand RETURN (6.5/10)

Файл: `.claude/skills/brand/SKILL.md` + references/
Audit report: `knowledge/episodes/2026-06/feniks-audit-brand-v2.md`

Top-3 gaps:
- Untagged figures (Accuracy-1 = 0/2): 27 000 / 350+ / 320+ / 132+ / 16 000 / 200+ без [ДАННЫЕ]
- Risk collapse (R21+R23+R25 all 0/2): нет downside, нет crisis, нет reversibility
- Insight-13: нет Architectural choice (merge v9 voice + v8 design vs split)

**Action plan:**
1. Добавить [ДАННЫЕ: brand/references/product-facts.md, c=1.0] на каждую цифру в SKILL.md
2. То же в product-facts.md - tags на каждой строке
3. Добавить Risk Section: downside (false brand-application), crisis-mode, reversibility (voice DNA pivot procedure)
4. Добавить Architectural Choice section (5-10 lines): почему 1 skill voice+design vs split

### Tier 2 - improvement (next 14 days)

#### 3. content-factory RETURN (6.60/10)

- Boundary с content-expert не определён - добавить «Boundary cases» секцию (word count threshold, channel destination, edge cases)
- Presentation pseudo-promise - либо добавить 7-й template, либо убрать из description
- Crisis scenarios (Risk-23 = 0/2)

#### 4. glossary-v21 RETURN (7.25/10)

- Header «7-уровневая архитектура» противоречит canon §1.1+§1.2 (5 вертикаль + 3 горизонталь = 8 атрибутов)
- Добавить canon_version, canon_pin_date, review_cycle в frontmatter
- Edge cases (legacy 1С, sibling conflict, over-correction партнёра)

#### 5. humanizer-ru RETURN (6.90/10)

- Actionability owner/invocation не определены - кто запускает (агент / hook / человек)
- Auto-invoke trigger размыт («≥100 слов» - кто меряет?)
- Нет threshold блокировки publish
- Crisis scenarios (deadline rush, false positive в legal context)
- Worked example end-to-end

### Tier 3 - polish (monthly CC-19)

7 GO skills minor gaps - см. summary file:
- crisis-response: cross-trigger correlation map, L5 fallback, kill criteria for Plan B
- encyclopedia-router: Wilstream doc, PRL series granular routing, snapshot date
- protocol-9-runner: lost v8 pre-send checklist, scope removed, history empty
- content-expert: Microdata templates, boundary с content-factory, negative scope
- competitor-intel: Architectural choice rationale, snapshot dates, Sentinel scenarios
- geo-aeo: lost Long-Tail point, unqualified claims без [ГИПОТЕЗА], weak risk

## Critical meta-findings (для будущей работы)

### M1 - Insight-13 alternatives missing (повторено 3x)

Repeated in cross-sell (fixed), competitor-intel, content-factory. **Mandatory action:** обновить `/skill-atomize` template - каждый synthesized skill должен иметь «Architectural choice» секцию.

### M2 - Risk Awareness systemic weakness (4 skills <6.0)

**Mandatory action:** обновить SKILL.md template - Risk Section обязательное поле с подсекциями (downside, crisis, reversibility, owner-when-broken).

### M3 - Phoenix-eval self-VETO

**Mandatory action:** Иван calibration cross-check на 3 реальных deliverables перед trusting иной FENIX verdict.

### M4 - Silent v8→v9 content losses

**Mandatory action:** запустить diff-report `v8 source → v9 synthesis` на всех 12 skills. Использовать paragraph-level diff + LLM-judge для сравнения «что потеряно по смыслу».

## Other open items (lower priority)

- 3 templates (aio-landing-template.md, plan-b-template.md, content-forge-prompt.md) deferred - создать когда понадобится
- Archive `incoming-skills/unpacked/` → `archive/v8-2026-06/` после Tier 1
- CLAUDE.md §14 Sources of Truth update когда references stabilize
- video-content standalone skill - если usage prove separate skill needed
- Bitrix24 MCP coupling (Sprint 3+, depend on Иван)
- Browser/Computer Use для FENIX + СЕМЁН (Sprint 3+)
- Telemetry collector via Stop hook (Sprint 4+)
- First Reflexion CC-19 (Protocol 15) - после Tier 1+2 complete

## Полезные команды

```bash
# Проверка состояния
git log --oneline gengroup-agents-v9 ^origin/main | head -20
git status

# Запуск Tier 1 audit
# В новой сессии:
> /feniks .claude/skills/phoenix-eval/SKILL.md
> /feniks .claude/skills/brand/SKILL.md

# После rework - re-audit
> /feniks .claude/skills/phoenix-eval/SKILL.md (iter 3)

# Validate schemas
python3 schemas/smoke-test.py
```

## Episode logs (для контекста)

- Inventory: `knowledge/episodes/2026-06/skill-atomization-inventory.md`
- FENIX iter-1 verdict (86 atoms): `knowledge/episodes/2026-06/skill-atomization-feniks-verdict.md`
- DATA extract (150+ figures): `knowledge/episodes/2026-06/skill-atomization-data-extract.md`
- Summary (12 skills + 2 cmds): `knowledge/episodes/2026-06/skill-atomization-summary.md`
- FENIX iter-2 batch summary (THIS audit): `knowledge/episodes/2026-06/feniks-iter2-batch-summary.md`
- Per-skill audits: `knowledge/episodes/2026-06/feniks-audit-<skill>-v2.md` (11 files)
- Master manifesto: `agents-v9/MASTER_SYSTEM_v9.md` (FENIX iter 2 GO 8.15/10)

## Контакты системы

- **CMO:** Иван Раюшкин (final approval gate, escalation L1+)
- **Co-owner:** Богдан Валайко (L2+ escalation)
- **CRM/1С:** Дмитрий Янчоглов (Bitrix24 integration when ready)
- **Pricing/Marketplaces:** Наташа Скриптун (Q-snapshot competitor refresh)
- **Payments:** Анна
- **Top analyst:** Екатерина

## Что НЕ забыть в новой сессии

1. **CLAUDE.md auto-loaded** - не надо его читать вручную
2. **Anti-Slop hook active** - будет ловить em dash / en dash / blocklist patterns
3. **P9 hook active** - будет нудить про reality-audit на финансовые/планировочные триггеры
4. **Step 12.5 mandatory** - перед любым critical DELIVER нужен FENIX gate
5. **Model routing** - phoenix-eval всегда opus, рутина sonnet/haiku (P11)

## Дополнительные напоминания

- Не амендить published commits без явной просьбы
- При коммитах: использовать heredoc для commit message формата
- При длинных задачах: дробить на batches с коммитами per milestone
- При параллельной работе агентов: коммитить inbetween чтобы Stop hook не ругался

## Backup ветки

- `gengroup-agents-v9` - текущая работа (на ней open PR #2)
- `claude/check-agent-skills-visibility-Lab3T` - предыдущая ветка с glossary site (PR #1 still open)
- `main` - последний v8 baseline

Если что-то ломается - rollback:
```bash
git checkout main && mv .claude .claude.v9.disabled
# work proceeds как в v8
```

---

**Передаю эстафету.** Удачи в новой сессии. Tier 1 займёт ~2-3 часа, Tier 2 ~4-5 часов. Atomization будет clean GA после Tier 1+2 закрытия.

Если phoenix-eval VETO не получится починить за iter 3 - escalate Богдану + pre-mortem по schemas/audit-report.json правилу.
