---
name: council
description: Convene the GENGROUP multi-agent Council orchestrated by СПАРТАК with a mandatory ФЕНИКС gate (Step 12.5). Use for tasks touching 3+ departments, finances >5M ₽, strategic pivot, KPI drop <70%, or when Иван says «собери бойцов», «council», «концилиум», «multi-team задача», «дебаты», «red team». Runs in Claude Code (custom subagents, parallel Agent fan-out, optional saved workflow `council`) and in Cowork (role cards from references/roster-cards.md, general-purpose subagents or HATS mode). Writes the Council episode and the P14 trace line.
argument-hint: "<задача> [--mode council|debate|red_team|solo] [--roster marco,data,roman] [--cc CC-13] [--workflow]"
---

# /council - Council GENGROUP (СПАРТАК + бойцы + ФЕНИКС)

Задача: $ARGUMENTS
Время старта (UTC): !`date -u +%Y-%m-%dT%H:%M:%SZ`

Если `$ARGUMENTS` пуст - спроси у Ивана бриф одной фразой и остановись.

## 0. Разбор аргументов

`--mode`, `--roster`, `--cc`, `--workflow` - необязательные. Всё остальное - задача. Ростер из аргументов не меняй,
только проверь пересечение зон (roster-protocol §6). Разрешённые бойцы: marco, data, viktor, boris, emma, maks,
semyon, timur, krea, roman, trener. ФЕНИКС и СПАРТАК в ростер не входят.

## 1. Определи среду (одна проверка, результат - в первую строку эпизода)

| Среда | Признак | Путь |
|---|---|---|
| **Claude Code, native** | Agent tool есть, `subagent_type: spartak` доступен | §2 |
| **Workflow** | Иван сказал `--workflow`, «use a workflow», «ultracode» | §3 |
| **Cowork / без custom agents** | Agent tool есть, кастомных типов нет (`.claude/agents` не загружен) | §4 |
| **HATS** | Agent tool недоступен (headless, вложенная делегация заблокирована) | §5 |

Никогда не имитируй параллельность: если бойцов запускает один голос, это HATS и так и пишется.

## 2. Native path (по умолчанию в Claude Code)

Оркестрация идёт из этой сессии; СПАРТАК используется как assessor и synthesizer, бойцы и ФЕНИКС - как subagents.
Это дешевле и не зависит от вложенной делегации. Полная делегация СПАРТАКУ (`subagent_type: spartak`, у него есть
Agent tool) допустима, когда Иван просит «один вызов - один результат».

1. **Phase A.** `Agent(subagent_type: spartak)`: бриф по A2A `{intent: "council_assess"}`. Ожидай: clarified_task, mode,
   cc, roster (max 4), p9_required, rag_paths (реальные файлы), success_criteria, stop_conditions, ≤1 уточняющий вопрос.
   P9 сработал → в ростере обязательны data и marco.
2. **Phase B.** Все бойцы **одним сообщением** (параллельно), каждому `subagent_type: <name>` и A2A-конверт
   (`intent: council_position_request`, `payload.stance`: expert | pro | contra | attacker, `max_words: 600`).
   Требуй структуру ответа roster-protocol §3 и evidence ≥3. Файлы правят параллельно → `isolation: worktree`.
3. **Peer review.** Второй параллельный блок: каждый боец получает позиции остальных как Аноним A/B/C (своей не видит)
   и возвращает оценки по `schemas/council-vote.json` (5 критериев, vote, top_strength, top_weakness).
   В DEBATE и SOLO peer review не нужен.
4. **Phase C.** `Agent(subagent_type: spartak)`: позиции + tally → синтез с conflicts (проверка ложного консенсуса),
   [STEAL THIS] из каждой позиции, dual shadow simulation, self-check 25 чекпоинтов (да/нет/частично).
5. **Phase D.** `Agent(subagent_type: feniks)`: A2A `{intent: "review_request", deliverable_ref, context.p9_required,
   payload.self_check}`. Полученный JSON сохрани во временный файл и прогони
   `python3 schemas/validate.py audit-report <file>`; пересчитай weighted_total по весам 0.25/0.25/0.20/0.15/0.15.
   `go` → deliver · `return` → доработка СПАРТАКОМ по rework_tz, повтор (max 3) · `veto` → стоп, Иван.
6. **Deliver.** Эпизод `knowledge/episodes/$(date +%Y-%m)/council-<slug>-$(date +%Y%m%d-%H%M).md` по шаблону из
   `.claude/agents/spartak.md` (Output format), строка `event: council` в `traces/$(date +%F)/agents.jsonl`
   (roster-protocol §9, `mode`, `feniks_score`, `verdict`), HITL-пометки CLAUDE.md §9 (бюджет, публикация, цены).

## 3. Workflow path (только по явному opt-in)

```
Workflow({ name: "council", args: { task: "<задача>", ts: "<UTC выше>", roster: [...]?, cc: "CC-13"?, mode: "council"?, max_iterations: 3 } })
```
Скрипт `.claude/workflows/council.js` делает фазы A-D сам (агенты по `agentType`, структурированные выходы по схемам,
пороги enforced кодом). Результат - объект; эпизод, трейс и HITL-пометки пишешь ты (в workflow нет даты и Write).
Без opt-in Workflow не запускай: это правило инструмента, не пожелание.

## 4. Cowork path (custom agents недоступны)

Если в Cowork установлен плагин `gengroup-roster`, агенты ростера доступны как subagents (по docs - `<name>@synced`):
тогда иди по §2, а этот раздел не нужен. §4 - только когда плагина нет.

Тот же порядок фаз, но роли берутся из role-карт: `${CLAUDE_SKILL_DIR}/references/roster-cards.md`.
- Каждый боец = general-purpose subagent, в промпт инлайнится его карта + краткая версия roster-protocol §3-§4-§7 + A2A-бриф.
- ФЕНИКС = general-purpose subagent с картой feniks + текстом `.claude/skills/phoenix-eval/SKILL.md` (Comprehension Gate,
  25 чекпоинтов) + `references/calibration-anchors.md`. Пробы, требующие Bash, помечает N/A.
- Хуков нет: em dash (`grep -c $'\xe2\x80\x94'`), Anti-Slop §7 и валидацию JSON делай сам перед deliver.
- Approval-файлы Protocol 6 недоступны: любая мутация внешних систем = `HITL: Иван`, только подготовка.
Первая строка эпизода: `MODE: cowork (custom agents недоступны)`.

## 5. HATS path (Agent tool недоступен)

Ты сам проходишь роли по role-картам последовательно, каждую позицию подписываешь `Аноним X (роль)`. Peer review
не проводится (одним голосом он бессмыслен), вместо него честный conflict scan. ФЕНИКС-шляпа надевается последней и
отдельно от синтеза. Первая строка эпизода: `MODE: hats (причина)`. Оценка ФЕНИКСА в HATS помечается
`[HATS: не независимый аудит]` и не считается Step 12.5 для критических артефактов (CLAUDE.md §4) - такие идут
на повторный /feniks в native-среде.

## Default Council Configs

| Сигнатура | CC | Ростер по умолчанию |
|---|---|---|
| Финансы >5M | CC-12 Strategy Pivot | marco + roman + data + feniks |
| 3+ департамента | CC-13 Adversarial Review | feniks + roman + data + профильный |
| Кризис (P8) | CC-15 Crisis Response | feniks + roman + emma + профильный |
| AI Visibility | CC-09 | semyon + data + marco |
| Контент-blitz (>12 ед/нед) | CC-11 | maks + krea + marco |
| Skill governance | CC-16 | feniks + data |
| Monthly retro (P15) | CC-19 Reflexion | feniks + data + marco (см. skill `reflexion`) |
| Платный трафик | CC-13 + timur | timur + data + roman + feniks |

## Ограничения

- Max 4 бойца + ФЕНИКС (coordination tax O(n²)). Модели бойцов - из их frontmatter (P11), не переопределять.
- Стоимость Council > $1 или >4 бойцов → предупредить Ивана до старта.
- Без self-check синтеза ФЕНИКС возвращает без скоринга. Без валидного JSON по схеме вердикта нет.
- 3 итерации без `go` → эскалация Ивану с историей оценок. Конфликт СПАРТАК vs ФЕНИКС → Иван (Rule 5).
- Em dash запрещён во всех артефактах Council.
