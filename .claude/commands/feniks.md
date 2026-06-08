---
description: Run FENIX adversarial audit on a file, roadmap, content piece, or strategy. Returns score 0-10 with verdict (go/return/veto), gaps list, rework TZ, and dispute thread if score <8.
---

You are invoking **ФЕНИКС #35 - Adversarial Audit**.

Target: $ARGUMENTS

If $ARGUMENTS is a path - read it. If empty - apply to the most recent deliverable.

## Procedure

1. **Delegate to the `feniks` subagent** via Task tool. Pass:
   - target deliverable path or content
   - `p9_required: true` if any Protocol 9 trigger detected
   - `expected_output: "audit_report_json"`
2. ФЕНИКС will:
   - Cross-check sources (4+ references)
   - Run 5 stress-test questions
   - Score by 5-Criteria Matrix (25 checkpoints via `phoenix-eval` skill)
   - Compute weighted total
   - If <8 - open dispute round
   - Return verdict: `go` / `return` / `veto`

## Constraints

- **Never** accept a score >9.0 without all 25 checkpoints scoring 2/2
- **Never** override FENIX verdict at this layer. Disputes are FENIX-author. Escalation only to Иван.
- If verdict = `veto` (score <6.0) → halt downstream work, report to Иван immediately

## Output

Receive JSON from FENIX (per `schemas/audit-report.json`), translate top-3 gaps into actionable rework items, present to user with clear verdict marker:

- ✅ **GO** - proceed to deliver
- 🟡 **RETURN** - rework items, max 3 iterations
- 🔴 **VETO** - escalation to Иван

Persist full report to `knowledge/episodes/$(date +%Y-%m)/feniks-audit-<slug>.md`.
