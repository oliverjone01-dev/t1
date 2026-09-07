---
name: reality-audit
description: Run Protocol 9 Reality Audit on a deliverable, idea, roadmap entry or figure. Tags every figure [ДАННЫЕ]/[ГИПОТЕЗА], answers the 5 questions, applies 10 hard rules, routes through the trifecta ДАТА → ФЕНИКС + МАРКО, returns GO / PILOT / BLOCK / KILL. Use when Иван says «reality audit», «проверь цифры», «положи в план», or when P9 triggers fire (эффект на выручку, удвоит, уникальный актив, ROMI, ICE, диапазон шире 2x, внешняя презентация).
argument-hint: "<описание инициативы, путь к файлу или цифра с контекстом>"
---

# /reality-audit - Protocol 9 (executable)

Цель: $ARGUMENTS

Если пусто - применяй к последнему deliverable в разговоре.

## Процедура

1. **Skill `protocol-9-runner`** - прочитай `.claude/skills/protocol-9-runner/SKILL.md` и выполни шаги 1-3 сам
   (разметка цифр, 5 вопросов, hard rules H1-H10) как черновик. Это вход для триады, не её замена.
2. **Триада (Step 4 runner'а), два такта:**
   - Такт 1: `Agent(subagent_type: data)` - A2A `{intent: "data_audit_request", payload: {figures, draft_tags}}`.
     ДАТА возвращает [ДАННЫЕ]/[ГИПОТЕЗА]/[РАСХОЖДЕНИЕ] с путями источников и confidence. Без её `go` дальше не идём:
     цифры без источника остаются [ГИПОТЕЗА].
   - Такт 2 (параллельно, одним сообщением): `feniks` (логика, скрытые допущения, hard rules, probes B1/D1) и
     `marco` (реальное поведение ЦА, канал, precedents из эпизодов). Оба получают размеченную ДАТОЙ версию.
3. **Сведение:** три вердикта → финальный. Любой `veto`/`kill` → BLOCK или KILL. Все `go` → GO. Иначе PILOT с
   бюджетом ≤ порога из Decision Matrix runner'а и чекпоинтом (дата, ответственный, критерий «идём дальше или сворачиваем»).
4. **Hard rules** - любое нарушение блокирует задачу, без исключений «потому что срочно».

## Деградированные режимы

- **Cowork / без custom agents:** те же три роли как general-purpose subagents с картами из
  `.claude/skills/council/references/roster-cards.md` (data, feniks, marco). Первая строка отчёта `MODE: cowork`.
- **Нет Agent tool:** HATS, три шляпы последовательно, `MODE: hats`; для Roadmap-записей это не заменяет P9 - повтор в native.

## Вывод

Один markdown-отчёт по шаблону `protocol-9-runner` (Цифры → 5 вопросов → Hard Rules → Trifecta verdicts → Final verdict
с корректировкой ICE и бюджета и чекпоинтом). Roadmap-запись - дополнительно JSON по `schemas/roadmap-entry.json`,
проверить `python3 schemas/validate.py roadmap-entry <file>`.

Сохранить в `knowledge/episodes/$(date +%Y-%m)/reality-audit-<slug>-$(date +%Y%m%d).md`, если это план или Roadmap.
Строка трейса `event: audit`, `agent: data` (roster-protocol §9). Вердикт BLOCK/KILL - эскалация явно, не смягчать.
