# FENIX Audit - skill `brand` (post-atomization v8→v9)

**Auditor:** ФЕНИКС #35
**Timestamp:** 2026-06-08
**Deliverable:** `.claude/skills/brand/` (SKILL.md + references/brand-colors.md + references/product-facts.md)
**Iteration:** 2 (post atomization iter-1 verdict)
**Skill applied:** `phoenix-eval` (25 checkpoints × 5 criteria)
**Confidence:** 0.86

---

## Phase 1 - Cross-check matrix

| Source | Check | Result |
|---|---|---|
| v8 source `incoming-skills/unpacked/gengroup-brand/SKILL.md` | 13 500 / 160+ figures - obsolete | v9 correctly migrated to 27 000 / 350+ |
| Atomization verdict `skill-atomization-feniks-verdict.md` | Merge plan = v9 voice + v8 colors + product-facts refactored | Executed |
| `CLAUDE.md` §7 Anti-Slop blocklist | Em dash ban, slop patterns | 0 em-dash, 0 en-dash verified by grep |
| `knowledge/semantic/` data canon | 27 000 orders confirmed (agents/data.md) | Aligned |
| `glossary v2.1` | Metal-GM, GLASS-MEMORY hyphenation | Correct |
| Web check | n/a (internal artifact) | Skipped |

---

## Phase 2 - 5 Stress-Test Questions (pre-score)

### Q1 - DATA PROOF (figures verifiable)

**Question:** 27 000 заказов, 350+ проектов, 320+ дилеров, 16 000 м², 132+ комбинаций VALONTI - where is the source?

**Answer:** Partial. `product-facts.md` is the data bank but itself has ZERO `[ДАННЫЕ: source]` tags. Strings like «Total orders: 27 000+» appear without dated snapshot pointer to `knowledge/semantic/sales-history-2018-2025.csv`. Atomization verdict explicitly named this CSV as canon source - it is NOT cited inline. **Fail.**

**Verdict:** -1 on Accuracy-1.

### Q2 - PESSIMISTIC SCENARIO

**Question:** What if author misuses the skill - reads only SKILL.md, never loads `product-facts.md`?

**Answer:** SKILL.md line 24 already embeds GENGLASS hooks with literal figures («16 000 м², 27 000 заказов, 350+ проектов»). If product-facts.md drift occurs (e.g. orders count rises to 30 000 in Q4), SKILL.md becomes stale silently. No mechanism to detect divergence. **Medium risk.**

### Q3 - RESOURCE REALITY

**Question:** Realistic for an agent to consume this skill in one pass?

**Answer:** SKILL.md = 262 lines, plus 2 reference files. Total ~370 lines for a brand skill. Cognitively heavy but executable. CSS variables block (lines 114-180) is concrete enough to copy-paste. **Pass.**

### Q4 - BLIND SPOTS

**Question:** What is missing that v8 had OR that real practice requires?

**Answer:** Multiple gaps detected:
- **No competitors reference** despite atomization verdict listing `references/competitors.md` (v8 had it, v9 SKILL.md line 257 mentions only `brand-colors.md` + `product-facts.md`, v8 line 144 mentions `competitors.md`). **Atom lost.**
- **No version field / changelog** in SKILL.md frontmatter - drift cannot be tracked
- **No anti-pattern examples per brand** (one-sentence «Forbidden» bullets, no concrete BAD vs GOOD copy pair)
- **No fallback rule** if brand identification fails at Workflow step 1
- **product-facts.md missing GENGLASS production volume per month** (Anti-Slop example line 193 says «200+ перегородок в месяц» but this number is nowhere in product-facts.md - **hallucination risk in real usage**)

**Verdict:** -2 on Insight, -1 on Actionability.

### Q5 - INVESTOR / IVAN QUESTION

**Question:** What will Иван ask first?

**Answer:** «Где доказательства 27 000? Покажи CSV.» SKILL.md cannot answer. `product-facts.md` cannot answer. Tags absent. **This is the biggest single gap.**

**Q2-style failure:** 3 of 5 are partial-fail (Q1, Q4, Q5). Pre-score escalation rule says ≥3 partial-fails → score ceiling ≤7.0. Applied.

---

## Phase 3 - 25 Checkpoints Scoring

### Accuracy (weight 25%)

| # | Checkpoint | Score | Note |
|---|---|---|---|
| A1 | Figures tagged `[ДАННЫЕ]`/`[ГИПОТЕЗА]` | 1/2 | Only 2 of ~15 figures tagged. 27 000, 350+, 320+, 132+, 16 000 in SKILL.md hooks - UNTAGGED. product-facts.md ZERO tags. Per phoenix-eval rule: «без тегов = автоматически 0» - but SKILL.md does pass once at line 186. Partial. |
| A2 | Sources verifiable (path + dated snapshot) | 1/2 | Paths exist (references/product-facts.md) but no snapshot date. `knowledge/semantic/sales-history-2018-2025.csv` named in atomization verdict NOT cited inline. |
| A3 | No conflict with `knowledge/semantic/` | 2/2 | 27 000 / 350+ matches v9 canon. Metal-GM, GLASS-MEMORY hyphenation correct. |
| A4 | Glossary v2.1 terminology | 2/2 | «палитра» «коллекция» «комплект» («Ensemble») used per glossary. Cross-brand §5 rule cited line 218. |
| A5 | Brand names correct | 2/2 | Metal-GM, GLASS-MEMORY through dash. All 5 brands consistent. |

**Accuracy = 8/10**

### Actionability (weight 25%)

| # | Checkpoint | Score | Note |
|---|---|---|---|
| A6 | Owner / responsible identified | 2/2 | Workflow steps 1-8 clear, each step has implicit owner (skill consumer agent). |
| A7 | Deadline with buffer | n/a → 2/2 | Brand skill is reference, not project. Marked pass. |
| A8 | Resources listed | 2/2 | CSS variables, fonts, HEX, references - all listed inline. |
| A9 | Concrete success metric | 1/2 | Pre-Delivery Checklist (lines 232-242) exists with 9 items, but no PASS threshold (e.g. «8 of 9 checked → ready»). Output mark YAML (line 245) has boolean fields without rule for «when is failed». |
| A10 | Intermediate milestone | 2/2 | Workflow step 6 «Audit pass» + step 7 «Humanizer pass» + step 8 «Checklist» = 3 milestones. |

**Actionability = 9/10**

### Insight (weight 20%)

| # | Checkpoint | Score | Note |
|---|---|---|---|
| I11 | Non-trivial observation | 1/2 | «Gold as punctuation, max 15% area» is non-obvious. «Premium feel = restraint» for VALONTI - good. But voice DNA sections feel templated. |
| I12 | Second-order consequences | 0/2 | What happens if all 5 brand voices applied consistently for 6 months? Brand recognition impact? Cannibalization risk between GENGLASS and VALONTI? Not discussed. |
| I13 | Alternatives analyzed | 0/2 | **Critical miss.** Atomization verdict merged v9 voice + v8 design system. SKILL.md does NOT explain WHY merged vs split (`brand-voice` + `brand-design` as two skills). No rationale, no tradeoff. Per audit request «Insight-13 (alternatives)» - explicit fail. |
| I14 | Anti-Median test | 2/2 | Specific hooks («1 объект = 6 зон», «60 дней vs 180»), brand-specific Forbidden patterns, factory floor references - default ChatGPT does NOT produce this. |
| I15 | Cross-domain reference | 0/2 | No reference to how Bose / B&O / Hermès / Aesop structure brand voice systems. Would have strengthened authority. Atomization verdict didn't require it but phoenix-eval does. |

**Insight = 3/10**

### Brand Fit (weight 15%)

| # | Checkpoint | Score | Note |
|---|---|---|---|
| B16 | Voice DNA per 5 brands | 2/2 | All 5 brands present (GENGLASS, VALONTI, GENTERO, Metal-GM, GLASS-MEMORY). Each has tone/language/imagery/hooks/forbidden structure. **Strongest section of the skill.** |
| B17 | Anti-Slop clean | 2/2 | No banned phrases in skill copy itself. Forbidden lists per brand mirror CLAUDE.md §7. |
| B18 | Em dash absent | 2/2 | **Verified by grep: 0 em-dash, 0 en-dash across all 3 files.** Clean. |
| B19 | Output routing compliant | 1/2 | Skill is reference, output routing N/A inline. But no link to Protocol 10 / `output-router` skill (would help). |
| B20 | Tone matches audience | 2/2 | Premium-but-warm for GENGLASS, B2B-precision for GENTERO, dignified for GLASS-MEMORY - all aligned with CLAUDE.md §12. |

**Brand Fit = 9/10**

### Risk Awareness (weight 15%)

| # | Checkpoint | Score | Note |
|---|---|---|---|
| R21 | Downside articulated | 0/2 | What if voice DNA conflicts with client's existing brand book on a custom project? What if Metal-GM client wants emotional copy? No fallback. |
| R22 | P9 hard rules respected | 1/2 | Em dash rule respected. But «уникальный актив» appears implicitly in VALONTI «restrained elegance» phrasing without mechanism description. Anti-Slop required hooks pass but data tagging fails (P9 H1). |
| R23 | Crisis scenarios | 0/2 | What if brand colors need urgent update (legal challenge on RAL usage, font license expiry)? No process. |
| R24 | Dependencies declared | 1/2 | References product-facts.md and brand-colors.md. But `humanizer-ru` skill mentioned line 203 / 259 without explicit «MUST run after» dependency note. CLAUDE.md / glossary.md cited but `output-router` skill not linked despite being directly relevant. |
| R25 | Reversibility | 0/2 | If voice DNA defined here turns out wrong (e.g. VALONTI repositions), how do downstream artifacts get re-audited? No rollback / re-audit trigger documented. |

**Risk Awareness = 2/10**

---

## Phase 4 - Weighted Total

```
Accuracy    8.0 × 0.25 = 2.00
Actionability 9.0 × 0.25 = 2.25
Insight     3.0 × 0.20 = 0.60
Brand Fit   9.0 × 0.15 = 1.35
Risk Aware. 2.0 × 0.15 = 0.30
                       ------
Weighted total       = 6.50
```

**Pre-score ceiling applied:** 3 partial-fails on stress tests → ceiling 7.0. Raw 6.50 is below ceiling, ceiling does not bind.

**Final score: 6.5 / 10**

---

## Phase 5 - Verdict

**VERDICT: RETURN** (6.0 ≤ 6.5 < 7.5)

Below the GO threshold of 7.5. Above veto threshold of 6.0. Two iterations remaining before veto escalation.

The skill has a strong Brand Fit core (Voice DNA per 5 brands, clean CSS variables, zero em-dash). It fails on Risk Awareness, Insight, and partial Accuracy. The figures everyone wanted tagged are still mostly untagged. The merge rationale (v9 voice + v8 design) is unexplained. Downside / reversibility absent.

---

## Top-3 Gaps (priority order)

### Gap 1 - Untagged figures (Accuracy-1, blocking)

**What:** 27 000, 350+, 320+, 132+, 16 000 м², 200+ перегородок/мес, 25+ городов, +25% Crystalvision, 320 дилеров - all appear UNTAGGED in SKILL.md hooks and ZERO tags in `product-facts.md`.

**Why it matters:** Phoenix-eval rule «без тегов = автоматически 0 по этому пункту». P9 Hard Rule H1 violation: «Нет источника цифры → блок». The canonical source CSV (`knowledge/semantic/sales-history-2018-2025.csv` per atomization verdict) is not cited even once.

**Fix:** Mass tagging pass on `product-facts.md` and SKILL.md hooks. Format:
```
- Total orders: 27 000+ [ДАННЫЕ: knowledge/semantic/sales-history-2018-2025.csv, snapshot 2026-05-31]
- 132+ combinations [ГИПОТЕЗА: 11 × 12 calculation, NOT confirmed product matrix, требует VALONTI catalog audit]
- 200+ перегородок/мес [ДАННЫЕ или ГИПОТЕЗА?] - этой цифры в product-facts.md НЕТ, риск hallucination
```

### Gap 2 - Risk Awareness near-zero (R21, R23, R25)

**What:** No downside scenarios, no crisis protocol, no reversibility plan. Skill is written as if brand identity never changes and is never wrong.

**Why it matters:** Risk-aware skills outlive brand pivots. If VALONTI repositions from «quiet luxury» to «accessible premium» in 2027, every artifact using current SKILL.md becomes legacy. No mechanism to flag this.

**Fix:** Add section `## Risk & Reversibility`:
- Conflict scenario: client brand book vs GENGROUP voice DNA → rule for precedence
- Drift detection: monthly check if `product-facts.md` figures match `knowledge/semantic/` canon
- Re-audit trigger: when voice DNA section changes, list of artifacts to re-process

### Gap 3 - Insight-13 alternative analysis missing

**What:** Atomization iter-1 verdict merged v9 voice + v8 design into one `brand` skill. SKILL.md does not explain why merged vs split into `brand-voice` + `brand-design` (two skills, sharper auto-invoke).

**Why it matters:** Single 262-line skill that triggers on both «voice» AND «colors» AND «layout» triggers too broadly. Insight-13 asks: «minimum 2 alternatives considered, why not them». Atomization verdict has rationale - SKILL.md does NOT inherit it.

**Fix:** Add `## Design Decision - why one skill, not two` section:
- Option A (chosen): single `brand` skill = voice + design + facts
- Option B (rejected): split into `brand-voice` + `brand-design`
- Reasoning: brand identity is indivisible at delivery time (КП needs both colors AND tone simultaneously); split would force double-skill-load in 90% of cases; cross-references between voice and color usage (e.g. «Gold as punctuation matches GENGLASS confident craftsman voice») would be lost

---

## Additional findings (not blocking, log for iter-3)

1. **Lost atom:** `references/competitors.md` mentioned in v8 source SKILL.md line 144, NOT in v9 SKILL.md references. Per atomization verdict the competitor data lives in separate `competitor-intel` skill - but cross-link absent from `brand` SKILL.md. Add: «For positioning vs competitors, load skill `competitor-intel`».

2. **Hallucination risk:** Line 193 «Мы производим 200+ перегородок в месяц» is example copy embedded in Anti-Slop rules. This figure is NOT in `product-facts.md`. Either add to facts OR mark as illustration only.

3. **No version frontmatter:** SKILL.md lacks `version: 2.0` field. v8 had `version: 1.1.0`. Tracking regression.

4. **Premium-but-warm contradiction:** SKILL.md line 56 GENGLASS = «premium-but-warm, графичный». CLAUDE.md §12 says «Russian formal-but-warm». «Premium-but-warm» introduces a slightly different shade. Reconcile or define both.

5. **Output mark YAML (line 245-253):** Fields `voice_audit: passed|failed` and `ready_for_feniks: true` - what determines pass/fail? No criteria. Self-attestation only.

---

## rework_tz

```yaml
priority: P1 (return, not veto)
owner: marco (skill maintainer) + maks (anti-slop pass)
deadline: T+48h
threshold_for_re-audit: 7.5

actions:
  1_tagging_pass:
    file: references/product-facts.md
    action: add [ДАННЫЕ: <path>, snapshot YYYY-MM-DD] to every numeric line. For unverified figures use [ГИПОТЕЗА: <assumption>]. Canon source for GENGROUP-level figures = knowledge/semantic/sales-history-2018-2025.csv.
    estimate: 1h
  2_tagging_pass_skill_md:
    file: SKILL.md lines 24, 27, 47, 62, 186, 241
    action: append [ДАННЫЕ: references/product-facts.md] to every inline figure in voice hooks.
    estimate: 30min
  3_risk_section_add:
    file: SKILL.md
    action: add new section `## Risk & Reversibility` covering conflict (client book vs DNA), drift detection (monthly figure check), re-audit trigger (when voice changes).
    estimate: 1h
  4_alternatives_section_add:
    file: SKILL.md
    action: add `## Design Decision - single skill vs split` (3 paragraphs, A/B options, reasoning).
    estimate: 45min
  5_competitor_link:
    file: SKILL.md references section
    action: add line «For competitor positioning, load skill `competitor-intel`».
    estimate: 5min
  6_200_partition_resolve:
    file: SKILL.md line 193 OR references/product-facts.md
    action: either add 200+ перегородок/мес to product-facts (with source) OR mark as illustration in SKILL.md.
    estimate: 15min
  7_version_field:
    file: SKILL.md frontmatter
    action: add `version: 2.0.0` and `previous: v8 1.1.0`.
    estimate: 5min

total_estimate: ~3.5h
re-audit_trigger: ФЕНИКС iter-3 when all 7 done.
```

---

## JSON output (per `schemas/audit-report.json`)

```json
{
  "agent": "feniks",
  "skill": "phoenix-eval",
  "task_id": "audit-brand-v2-2026-06-08",
  "timestamp": "2026-06-08T00:00:00Z",
  "deliverable_ref": ".claude/skills/brand/",
  "iteration": 2,
  "checkpoints": {
    "accuracy_1_figures_tagged": 1,
    "accuracy_2_sources_verifiable": 1,
    "accuracy_3_no_conflict_with_rag": 2,
    "accuracy_4_glossary_terminology": 2,
    "accuracy_5_brand_names_correct": 2,
    "actionability_6_owner_assigned": 2,
    "actionability_7_deadline_buffer": 2,
    "actionability_8_resources_listed": 2,
    "actionability_9_metric_concrete": 1,
    "actionability_10_milestone": 2,
    "insight_11_nontrivial": 1,
    "insight_12_second_order": 0,
    "insight_13_alternatives_analyzed": 0,
    "insight_14_anti_median": 2,
    "insight_15_cross_domain": 0,
    "brand_16_voice": 2,
    "brand_17_anti_slop": 2,
    "brand_18_no_em_dash": 2,
    "brand_19_output_routing": 1,
    "brand_20_tone_audience": 2,
    "risk_21_downside": 0,
    "risk_22_p9_hard_rules": 1,
    "risk_23_crisis_scenarios": 0,
    "risk_24_dependencies": 1,
    "risk_25_reversibility": 0
  },
  "scores": {
    "accuracy": 8.0,
    "actionability": 9.0,
    "insight": 3.0,
    "brand_fit": 9.0,
    "risk_awareness": 2.0
  },
  "weighted_total": 6.5,
  "verdict": "return",
  "gaps": [
    "Untagged figures (27 000, 350+, 320+, 132+, 200+, 16 000): product-facts.md has zero [ДАННЫЕ] tags, SKILL.md only 2 tags out of ~15 figure mentions",
    "Risk Awareness near-zero: no downside, no crisis, no reversibility, no drift detection",
    "Insight-13 alternative analysis missing: merge v9-voice + v8-design rationale not in SKILL.md (only in atomization verdict)",
    "Lost atom - competitors.md reference dropped from references section, no link to competitor-intel skill",
    "Hallucination risk - 200+ перегородок/мес in Anti-Slop example NOT in product-facts.md",
    "No version frontmatter, no changelog for drift tracking",
    "Premium-but-warm (line 56) vs formal-but-warm (CLAUDE.md §12) - shade conflict unresolved"
  ],
  "rework_tz": "See rework_tz block above. 7 actions, ~3.5h estimated, owner marco+maks, deadline T+48h, re-audit threshold 7.5.",
  "iteration_max_before_veto": 3,
  "confidence": 0.86
}
```

---

## Special notes

- **Voice DNA (5 brands) - strongest section.** Don't touch in rework. It's the reason skill is salvageable.
- **Em-dash discipline - clean.** 0 em, 0 en across 3 files. This was a key blocker in v8 (236 dashes per atomization verdict). Resolved.
- **27 000 vs 13 500 migration - clean.** Pre-Delivery Checklist line 241 explicitly notes «не v8 13 500 / 160+» - good defensive practice.
- **No dispute round triggered.** Author can act on gaps directly. If marco disagrees with Risk Awareness scoring, escalate to round 1 dispute, max 5 rounds.

**Next:** ФЕНИКС iter-3 when rework_tz items 1-7 complete. If score still <7.5 → escalation to Иван (skill may need split into 2).
