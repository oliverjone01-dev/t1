---
description: Convene a multi-agent council for cross-functional decision. Use for tasks touching 3+ departments, finances >5M ₽, strategic pivot, or KPI drop <70%. Orchestrated by SPARTAK with mandatory FENIX gate (Step 12.5).
---

You are invoking **СПАРТАК - Supreme Orchestrator** for a Council session.

Task: $ARGUMENTS

If $ARGUMENTS is empty - ask user for task brief.

## Procedure

1. **Delegate to `spartak` subagent** via Task tool. Pass task brief.
2. SPARTAK will:
   - **Phase A - Assessment:** clarify, detect P9 triggers, select mode (Solo/Council/Debate), assemble roster (max 4 + FENIX)
   - **Phase B - Execution:** RAG injection, brief each agent via A2A, anonymize outputs
   - **Phase C - Synthesis:** aggregate scores, extract [STEAL THIS] from each, dual shadow simulation (CA + AI Citation)
   - **Phase D - Adversarial Gate:** **Step 12.5** - FENIX review mandatory. If verdict ≠ `go`, rework up to 3 iterations.

## Default Council Configs

Auto-select based on task signature:

| Signature | CC | Default roster |
|---|---|---|
| Финансы >5M | CC-12 Strategy Pivot | marco + roman + data + feniks |
| 3+ departments | CC-13 Adversarial Review | feniks + roman + data + проф. |
| Crisis trigger (P8) | CC-15 Crisis Response | feniks + roman + emma + проф. |
| AI Visibility | CC-09 | semyon + data + marco |
| Content blitz (>12 ед/нед) | CC-11 | maks + krea + marco |
| Skill governance audit | CC-16 | feniks + data |
| Monthly retro (P15) | CC-19 Reflexion | feniks + data + marco |

## Constraints

- Max 4 working agents + FENIX (coordination tax growth O(n²))
- Default model for working agents: sonnet. Opus only for FENIX/SPARTAK/Council aggregation (P11)
- Every Council session writes episode to `knowledge/episodes/YYYY-MM/council-<id>.md`
- Cost ceiling per Council: $1.00 (haiku/sonnet routing). If projecting >$1 - alert before continuing.

## Output

Council Episode markdown with:
- Task brief (1-liner)
- Phase B anonymized outputs (Аноним A, B, C)
- Phase C synthesis with [STEAL THIS] extractions
- Step 12.5 FENIX verdict + dispute thread if any
- Deliverable artifact path
- Recipient (default Иван)
- Next checkpoint (date + owner)

Persist to `knowledge/episodes/$(date +%Y-%m)/council-<slug>-$(date +%Y%m%d-%H%M).md`.
