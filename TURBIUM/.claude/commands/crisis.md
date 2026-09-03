---
description: Activate Protocol 8 Crisis Response. 24-hour Plan B for cash gap, KPI drop, channel block, key team loss, mass refunds, or production failure. Mobilizes SPARTAK + FENIX + ROMAN + EMMA.
---

You are activating **Protocol 8 - Crisis Response (CC-15)**.

Crisis description: $ARGUMENTS

If $ARGUMENTS is empty - ask user which trigger fired:
1. Кассовый разрыв (cash <2 weeks)
2. Потеря ключевого сотрудника (РОП / РОМ / Интернет-маркетолог)
3. Блокировка критического канала (TG/WhatsApp/...)
4. Срыв сроков >5 заказов одновременно
5. Массовая рекламация (>3% от отгрузок)
6. Выручка <80% плана 2 недели подряд

## Procedure (24-hour Plan B)

### T+0 → T+0:30 - Activation
1. SPARTAK activates CC-15 automatically
2. Lock down - no further commitments or PR until Plan B ready
3. Notify Иван + Богдан by message (not email)

### T+0:30 → T+4:00 - Express Audit
4. **Delegate to `feniks` subagent**: 30-min scope audit
   - What's actually broken (vs perceived)
   - Magnitude (₽, % impact)
   - Dependencies and downstream effects
5. **Delegate to `roman` subagent**: financial impact
   - Current cash position (from 1С)
   - Burn rate
   - Days to cash 0
   - Min revenue for break-even
6. **Delegate to `emma` subagent** (if customer-facing crisis): communication plan
   - What to say externally
   - What NOT to say (legal/PR risks)

### T+4:00 → T+24:00 - Plan B
7. SPARTAK synthesizes 3 scenarios:
   - **Best case** (problem resolves in 7 days with action X)
   - **Expected case** (resolves in 30 days with actions X, Y, Z)
   - **Downside** (doesn't resolve, mitigation: A, B, C)
8. Each scenario with:
   - Concrete action items (owner + deadline + cost)
   - Decision tree (if A then B)
   - Communication plan (internal + external)
9. Step 12.5 - FENIX final audit on Plan B (no exceptions, even in crisis)

### T+24:00 - Deliver
10. Plan B document to Иван + Богдан
11. Daily checkpoint until crisis resolved
12. Post-mortem episode in `knowledge/episodes/YYYY-MM/crisis-<trigger>-<date>.md`

## Constraints

- **Plan B in 24 hours, not later.** Slippage = L3 escalation (red).
- **No social media / PR during crisis** until communication plan approved by EMMA + Иван.
- **No new spend commitments** until cash position confirmed by ROMAN.
- **FENIX gate not skipped** even in crisis. P8 says «План Б готов за 24ч», not «без аудита».

## Escalation Levels (Protocol 8 Matrix)

| Level | Condition | Who escalates | To whom | Reaction |
|---|---|---|---|---|
| L1 (yellow) | Task slipped 1–3 days | Owner | Иван (CMO) | 24h |
| L2 (orange) | Task slipped 4–7 days OR blocks next phase | Иван | Богдан (директор) | 24h |
| L3 (red) | Phase 0 not done in 5 days OR critical breach by client/partner | Иван | Богдан + экстренное совещание | Immediately |
| L4 (black) | System error in public channel due to wrong data | Anyone | Иван + Богдан | Immediately, Protocol 8 |

## Output

Crisis Response Document:
- **Trigger:** which of the 6
- **Magnitude:** ₽, % impact
- **Current state:** facts as of audit
- **3 scenarios:** best / expected / downside with concrete actions
- **Communication plan:** internal + external
- **Decision tree:** next 7 days
- **Checkpoint schedule:** daily until resolved

Persist to `knowledge/episodes/$(date +%Y-%m)/crisis-<slug>-$(date +%Y%m%d).md`.
