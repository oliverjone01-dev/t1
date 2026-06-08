---
description: Decompose external skills into atoms and synthesize them into v9 Claude Code skills. Multi-agent decomposition (FENIX verdicts + DATA facts extraction), then merge/refactor, then FENIX iter-2 audit on each output. Reusable for monthly skill updates via CC-19 Reflexion.
---

You are running **Skill Atomization** - multi-agent decomposition + synthesis pipeline.

Source skills directory: $ARGUMENTS

If $ARGUMENTS is empty, default to `incoming-skills/unpacked/` (expects pre-unpacked .skill archives).

## Procedure

### Phase 1 - Inventory
1. Map source skills vs current `.claude/skills/*`. Output: `knowledge/episodes/$(date +%Y-%m)/skill-atomization-inventory.md`
2. Identify: dups (merge candidates), net new (eval candidates), orphans (in v9 but not in source).

### Phase 2 - Parallel decomposition (background agents)

Launch via Task tool, run_in_background=true:

- **`feniks`** subagent: per-skill atom decomposition with verdicts (KEEP/MERGE_INTO_X/REFACTOR/DISCARD/SPLIT). Adversarial pass. Output: `skill-atomization-feniks-verdict.md`.
- **`data`** subagent: every figure extracted with [ДАННЫЕ]/[ГИПОТЕЗА]/[РЕТРО-ОЦЕНКА] tags. Discrepancies flagged. Output: `skill-atomization-data-extract.md`.

Optional follow-up passes (sequential after first two):
- `marco` for content skills (brand-voice fit per 5 brands)
- `viktor` for sales-related (competitor-intel, encyclopedia, cross-sell)
- `roman` for cost-benefit per skill (token cost vs outcome value)
- `semyon` for AI Visibility skills (geo-aeo, seo-*)
- `krea` for creative (content-expert: anti-median check)
- `emma` for packaging (encyclopedia: JTBD-mapping)

### Phase 3 - Synthesis (main agent, after Phase 2 returns)

For each merge candidate, produce a new `.claude/skills/<name>/SKILL.md` that:
1. Inherits proven atoms from v8 (per FENIX verdict KEEP)
2. Includes facts from DATA extract (with proper tags)
3. Applies v9 standards: em dash ban, [ДАННЫЕ]/[ГИПОТЕЗА] discipline, YAML frontmatter with triggers
4. References per-brand voice via skill `brand`

For net new (no merge candidate), evaluate if it warrants a skill OR slash command OR integration:
- skill if it's a reusable procedure
- slash command if it's an orchestration
- integration if it depends on external system (n8n, Bitrix24 MCP)

### Phase 4 - Step 12.5 audit per new/updated skill

For each synthesized skill, invoke `feniks` (Task tool) with phoenix-eval. Threshold:
- ≥7.5 → commit
- <7.5 → rework iteration 2 (max 3 iterations per skill)
- <6.0 → escalate to Иван, atom returns to pool

### Phase 5 - Commit + episode log

Commit each synthesized skill separately. Final episode in `knowledge/episodes/$(date +%Y-%m)/skill-atomization-summary.md`:
- What got merged, refactored, discarded, split
- New skills added
- FENIX scores per skill
- Reflexion tag for monthly CC-19 review

## Constraints

- **No skipping FENIX gate** on any synthesized skill (Step 12.5 mandatory)
- **Atoms move on merit**, not on novelty (v8 atom can beat v9 atom)
- **Discrepancies between source and v9** flagged before merge (DATA extract)
- **Anti-Slop hook** must pass on every new `.md` file
- **Brand voice** check via skill `brand` for content skills

## Output

End report with:
- Total atoms processed
- Verdicts breakdown (keep/merge/refactor/discard/split)
- Per-skill FENIX scores
- Net new skills added
- Slash commands added (if any)
- Integrations registered (if any)
- Telemetry: total agent invocations, total cost estimate, wall time

Persist to `knowledge/episodes/$(date +%Y-%m)/skill-atomization-summary.md`.
