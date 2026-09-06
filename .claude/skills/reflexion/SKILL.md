---
name: reflexion
description: Run Protocol 15 Reflexion (Council CC-19) - the monthly retro of the GENGROUP multi-agent system. Aggregates P14 traces, ФЕНИКС audits and episodes for the month, compares predicted vs actual effects, finds systematic errors and calibration drift, and proposes concrete updates to skills, agents and calibration anchors. Use when Иван says «рефлексия», «ретро месяца», «reflexion», «CC-19», or on the first working day of a month.
argument-hint: "[YYYY-MM] (по умолчанию прошлый месяц)"
---

# /reflexion - Protocol 15 (CC-19)

Период: $ARGUMENTS (пусто = прошлый месяц)

## 1. Собери факты (без агентов, дёшево)

1. `python3 .claude/skills/reflexion/scripts/trace-summary.py <YYYY-MM>` - вызовы по агентам, вердикты и оценки ФЕНИКСА, режимы Council.
2. `ls knowledge/episodes/<YYYY-MM>/` - эпизоды, диспуты, аудиты за месяц. Прочитай заголовки и вердикты.
3. `.claude/agent-memory/feniks/MEMORY.md`, `.claude/agent-memory/spartak/MEMORY.md`, `.claude/agent-memory/data/MEMORY.md` - что агенты сами накопили.
4. Предыдущая рефлексия `knowledge/reflexion/<prev>.md` - какие меры обещали и что из них сделано.

## 2. Council CC-19 (параллельно, одним сообщением)

- `feniks` - систематические ошибки: какие gaps повторяются у каких авторов, дрейф оценок против
  `.claude/skills/phoenix-eval/references/calibration-anchors.md`, какие пробы находили дыры, где ФЕНИКС был неправ в диспутах.
- `data` - предсказанный эффект vs реальный по эпизодам месяца (источники: `analytics-mvp/data/`, Bitrix24-снимки, Директ-отчёты);
  каждое расхождение с меткой и причиной.
- `marco` - уроки механики рынка: какие допущения о ЦА и каналах не подтвердились.
A2A `{intent: "reflexion_input_request", context: {cc: "CC-19", period: "<YYYY-MM>"}}`, structured return.

## 3. Синтез (`spartak`)

`knowledge/reflexion/<YYYY-MM>.md`:
- Метрики месяца против success criteria MASTER_SYSTEM_v9 §8 (cost per Council, halted by P9, ФЕНИКС avg, cycle time, P9-метки, reflexion-updates).
- Top-3 систематические ошибки с evidence (эпизод, трейс).
- Меры: конкретные правки skills / agents / hooks / anchors - каждая как задача с owner и сроком. Правки в
  `calibration-anchors.md` и `CLAUDE.md` - только после решения Ивана (HITL).
- Что из мер прошлой рефлексии сделано / не сделано и почему.

## 4. Гейт и персист

- Step 12.5: `feniks` аудирует рефлексию (класс «стратегия», потолок 8.4). Self-check обязателен.
- Строка трейса `event: reflexion`, `agent: spartak`.
- Меры, принятые Иваном, превращаются в правки в тот же день (это и есть «reflexion-driven skill update ≥1/мес»).

## Деградированные режимы
Cowork / HATS - как в skill `council` §4-§5; рефлексия в HATS помечается `[HATS]` и не закрывает месячный критерий.
