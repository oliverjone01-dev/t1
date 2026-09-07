---
name: crisis
description: Activate Protocol 8 Crisis Response (CC-15) - 24-hour Plan B. Use when any of the 6 triggers fires (кассовый разрыв <2 недель, потеря РОПа/ключевого сотрудника, блокировка канала, срыв >5 заказов, рекламации >3%, выручка <80% плана 2 недели) or Иван says «кризис», «план Б», «СТОП-кран», «crisis». Mobilizes СПАРТАК + ФЕНИКС + РОМАН + ЭММА with the express audit in parallel, three scenarios, mandatory ФЕНИКС gate even in crisis.
argument-hint: "<какой триггер сработал и что известно>"
---

# /crisis - Protocol 8 Crisis Response (CC-15)

Описание кризиса: $ARGUMENTS

Если пусто - спроси, какой из 6 триггеров сработал, и остановись:
1 кассовый разрыв · 2 потеря ключевого сотрудника · 3 блокировка канала · 4 срыв сроков >5 заказов · 5 массовая рекламация >3% · 6 выручка <80% плана 2 недели.

Полная доктрина (фазы, сценарии, матрица эскалации L1-L4, post-mortem): `.claude/skills/crisis-response/SKILL.md`. Здесь - порядок вызовов.

## T+0 → T+0:30 - Activation
1. Lockdown: никаких новых обязательств, публикаций, PR и трат >100K до Плана Б.
2. Уведомить Ивана и Богдана сообщением (не email). Приостановить запуски ближайших 7 дней.
3. Строка трейса `event: escalation`, `agent: spartak`, `note: P8 trigger <N>`.

## T+0:30 → T+4:00 - Express Audit (параллельно, одним сообщением)
- `Agent(subagent_type: feniks)` - scope за 30 мин: что реально сломано vs воспринимаемое, magnitude в ₽ и %, downstream.
- `Agent(subagent_type: roman)` - cash position (1С через ДАТУ), burn rate, дни до нуля, min revenue для break-even.
- `Agent(subagent_type: emma)` - только если кризис клиентский: что говорить наружу, что не говорить (legal/PR), tone.
Каждому: A2A `{intent: "crisis_input_request", context: {cc: "CC-15", deadline: "<T+4h ISO>"}}`, structured return (roster-protocol §3).

## T+4:00 → T+22:00 - Plan B
4. `Agent(subagent_type: spartak)` - синтез трёх сценариев (best / expected / downside), каждый с действиями
   (owner + deadline + cost), decision tree, communication plan, self-check 25 чекпоинтов.

## T+22:00 → T+24:00 - Step 12.5 (не пропускается даже в кризисе)
5. `Agent(subagent_type: feniks)` - аудит Плана Б. Validate JSON, пересчёт весов. ≥7.0 → deliver; <7.0 → один раунд
   доработки, потом deliver с явным дисклеймером и списком незакрытых gaps (кризисное исключение из правила 3 итераций).

## T+24:00 - Deliver
6. Документ Плана Б → Иван + Богдан. Daily 15-минутный checkpoint до закрытия.
7. Эпизод `knowledge/episodes/$(date +%Y-%m)/crisis-<trigger>-$(date +%Y%m%d).md`; post-mortem после закрытия
   (шаблон в crisis-response).

## Деградированные режимы
- **Cowork:** роли из `.claude/skills/council/references/roster-cards.md` (feniks, roman, emma, spartak) как general-purpose subagents; `MODE: cowork`.
- **Нет Agent tool:** HATS, `MODE: hats`; аудит ФЕНИКСА повторить в native-среде до передачи Богдану.

## Hard Rules
- 24 часа, не 25. Slippage = L3.
- Никаких трат без подтверждённого РОМАНОМ cash position; никаких публикаций без ЭММЫ + Ивана.
- ФЕНИКС-гейт не пропускается. Daily standup обязателен, иначе кризис не считается активным.
