---
description: Run Protocol 9 Reality Audit on the current deliverable, idea, or roadmap entry. Tags every figure, runs 5 questions, applies 10 hard rules, returns verdict.
---

You are running **Protocol 9 - Reality Audit**.

Target: $ARGUMENTS

If $ARGUMENTS is empty - apply to the most recent deliverable in conversation.

## Procedure

1. **Invoke the `protocol-9-runner` skill** - read `.claude/skills/protocol-9-runner/SKILL.md` and apply its 5-step procedure
2. **Trifecta** - route through 3 subagents in sequence via Task tool:
   - First `data` (verify each figure has `[ДАННЫЕ]` or `[ГИПОТЕЗА]` tag + source)
   - Then `feniks` (logic, hidden assumptions, dispute prep)
   - Then `marco` (CA mechanics, channel fit, real market behavior)
3. **Apply Hard Rules** - block any violations
4. **Produce verdict** - GO / PILOT / BLOCK / KILL with rationale

## Output

Single markdown report by the template in `protocol-9-runner` skill.
Save to `knowledge/episodes/$(date +%Y-%m)/reality-audit-<slug>.md` if substantial.
Return to Иван with clear verdict and actionable next steps (with owner, deadline, checkpoint).

If verdict is BLOCK or KILL - escalate explicitly. Do not soften.
