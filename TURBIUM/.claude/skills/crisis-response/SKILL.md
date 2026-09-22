---
name: crisis-response
description: Executable Protocol 8 - 24-hour Plan B for GENGROUP. Auto-invoke when text mentions any of 6 crisis triggers (cash gap, KPI drop, channel block, key team loss, mass refunds, production failure) or when user types "crisis" / "кризис" / "план Б" / "СТОП-кран". Provides scenario tree, communication plan, escalation matrix.
---

# Crisis-Response - Protocol 8 Executable

## When to invoke

Automatically on any of the 6 triggers:

1. **Кассовый разрыв:** остаток на счетах < 2 недель расходов
2. **Потеря ключевого сотрудника:** РОП / РОМ / Интернет-маркетолог уходит
3. **Блокировка критического канала:** TG / WhatsApp / маркетплейс
4. **Срыв производства:** >5 заказов одновременно
5. **Массовая рекламация:** >3% от отгрузок
6. **Выручка <80% плана:** 2 недели подряд

Manually: команда «активируй кризис» / `/crisis` slash.

## Phase 0 - Lockdown (T+0:00 → T+0:30)

- СПАРТАК activates CC-15
- **Lock:** no new commitments, no public posts, no PR until Plan B ready
- **Notify** by direct message (не email): Иван + Богдан
- **Suspend** scheduled launches if any in next 7 days

## Phase 1 - Express Audit (T+0:30 → T+4:00)

### ФЕНИКС - scope (30 мин)
- Что реально сломалось vs perceived
- Magnitude (₽, % impact)
- Downstream effects (какие другие проекты затронуты)

### РОМАН - finance (1-2 часа)
- Current cash position (выгрузка из 1С на сегодня)
- Burn rate (последние 30 дней)
- Days to cash zero
- Min revenue for break-even (этого месяца)

### ЭММА (if customer-facing) - communication
- Что говорить наружу (PR/email/соцсети)
- Что НЕ говорить (legal, PR-risks)
- Voice & tone в кризисе: спокойствие, конкретика, сроки

## Phase 2 - Plan B (T+4:00 → T+24:00)

Build 3 scenarios:

### Best Case
- Проблема разрешается за 7 дней
- Действие X (одно ключевое)
- Cost ≤50K
- Outcome: возврат к baseline

### Expected Case (most likely)
- Resolves за 30 дней
- Actions X, Y, Z
- Cost 50-300K
- Outcome: 80-90% baseline восстановлен

### Downside Case
- Не разрешается за 30 дней
- Mitigation A, B, C
- Cost potentially >300K
- Outcome: structural change (новые процессы / штатка / каналы)

Each scenario includes:
- **Concrete action items:** owner + deadline + cost
- **Decision tree:** if A then B, if not then C
- **Communication plan:** internal + external

## Phase 3 - Step 12.5 (T+22:00 → T+24:00)

**FENIX final audit** on Plan B. No skip даже в кризисе.
- Score ≥7.0 → deliver to Иван
- Score <7.0 → один раунд дебатов, потом deliver с дисклеймером

## Phase 4 - Deliver (T+24:00)

Plan B документ → Иван + Богдан.
**Daily checkpoint** до окончания кризиса (15-минутный standup).

## Escalation Matrix

| Level | Trigger | Кто эскалирует | Кому | Реакция |
|---|---|---|---|---|
| L1 (жёлтый) | Задача просрочена 1-3 дня | Owner | Иван (CMO) | 24ч |
| L2 (оранжевый) | Просрочка 4-7 дней ИЛИ блокирует следующую фазу | Иван | Богдан (директор) | 24ч |
| L3 (красный) | Phase 1 не завершена за 5 часов ИЛИ публичное нарушение | Иван | Богдан + экстренный совет | Немедленно |
| L4 (чёрный) | System error в публичном канале из-за кризиса | Любой сотрудник | Иван + Богдан | Немедленно, Protocol 8 |

## Typical scenarios (templates)

### Cash gap
- Day 0: остановка новых найма, фриз бюджетов >100K
- Day 1: callout по неоплаченным КП (top-20 sum)
- Day 2: фактур / payment terms shift
- Day 7: re-forecast Q3
- Day 14: structural decision (займ / equity / cuts)

### Channel block (TG/WhatsApp)
- Day 0: backup contact info из CRM экспортирована
- Day 1: alternative channel announcement (VK / email / phone)
- Day 7: новый канал работает на ⩾50% объёма
- Day 30: postmortem

### Mass refunds (>3%)
- Day 0: остановка отгрузок партии
- Day 1: причина identified (производство / упаковка / монтаж)
- Day 3: refund process scaled
- Day 7: process fix in 1С + Bitrix
- Day 30: zero refunds на новых отгрузках

## Post-mortem (required after every crisis)

Сохранить в `knowledge/episodes/YYYY-MM/crisis-<trigger>-<date>-postmortem.md`:
- Trigger факта
- Magnitude (financial + reputational)
- Timeline reaction (что когда сделали)
- Что сработало
- Что не сработало
- System fixes (skills/agents/CLAUDE.md update)
- Triggers update (если нашли новый сигнал)

## Hard Rules

1. **24 часа - не 25.** Slippage = L3 escalation.
2. **FENIX gate не пропускается** даже в кризисе. P8 говорит «План Б готов за 24ч», не «без аудита».
3. **No PR/social during crisis** до approval Иван + ЭММА на коммуникацию.
4. **No new spend** пока РОМАН не подтвердил cash position.
5. **Daily standup** до закрытия. Without standup - kris не считается активным.

## Reference

- Slash command: `/crisis`
- Council CC-15: spartak + feniks + roman + emma
- Source-of-truth для cash: 1С (через ДАТА)
