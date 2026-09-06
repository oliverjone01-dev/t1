---
name: feniks
description: Run the ФЕНИКС adversarial audit (Step 12.5) on a file, roadmap, content piece, strategy, gate/hook, dashboard or agent definition. Use when Иван asks «проверь», «аудит», «review», «red team», before publishing, before any deliverable >500K ₽, or when Protocol 9 triggers fire. Returns score 0-10 with verdict go/return/veto, evidence-backed gaps, rework TZ, calibration anchor and red-team probe results; validates the JSON report against schemas/audit-report.json. Works in Claude Code (feniks subagent) and in Cowork (role card + phoenix-eval skill inline).
argument-hint: "<путь к файлу | описание артефакта | пусто = последний deliverable>"
---

# /feniks - Step 12.5 Adversarial Audit

Цель: $ARGUMENTS

Если цель - путь, прочитай файл целиком. Если пусто - применяй к последнему deliverable в разговоре.

## 1. Подготовка (делает автор, то есть эта сессия; ФЕНИКС без этого не начинает)

1. **Класс артефакта:** стратегия/КП · контент наружу · гейт/хук/инструмент · дашборд/цифры · агент/skill/workflow.
2. **P9-детектор** (CLAUDE.md §5): триггер есть → `p9_required: true`.
3. **Self-check автора:** пройди 25 чекпоинтов `.claude/skills/phoenix-eval/SKILL.md` в формате «N: да/нет/частично»
   без оценок. Это не аудит, это гигиена: без self-check ФЕНИКС возвращает артефакт без скоринга.
4. **A2A-конверт:**
   ```json
   {"from":"<этот агент или ivan>","to":"feniks","intent":"review_request","thread_id":"feniks-<ISO>",
    "deliverable_ref":"<path>","context":{"p9_required":false,"artifact_class":"<класс>"},
    "payload":{"self_check":["1: да","2: частично", "..."]},"expected_output":"audit-report"}
   ```

## 2. Запуск

- **Claude Code:** `Agent(subagent_type: feniks)` с конвертом. ФЕНИКС сам: CLASSIFY → CROSS-CHECK (4+ источника) →
  5 stress-вопросов → red-team пробы класса → 25 чекпоинтов → anchor → JSON + evidence ledger → validate → трейс.
- **Workflow / batch:** `agent(prompt, {agentType: "feniks", schema})` - см. `.claude/workflows/council.js` (AUDIT_SCHEMA).
- **Cowork (custom agents недоступны):** general-purpose subagent, в промпт инлайнить карту `feniks` из
  `.claude/skills/council/references/roster-cards.md`, текст `.claude/skills/phoenix-eval/SKILL.md`,
  `references/calibration-anchors.md` и таблицу проб класса из `references/red-team-probes.md`. Пробы без Bash - `N/A`,
  потолок для гейтов/дашбордов/агентов - 7.9. Первая строка отчёта: `MODE: cowork`.
- **Нет Agent tool:** ФЕНИКС-шляпа по карте, отчёт помечается `[HATS: не независимый аудит]`; для критических
  артефактов (CLAUDE.md §4) это не Step 12.5, нужен повтор в native-среде.

## 3. Приём отчёта (не доверяй, проверяй)

1. Сохрани JSON во временный файл, прогони `python3 schemas/validate.py audit-report <file>`. Не VALID → верни ФЕНИКСУ на исправление отчёта (не артефакта).
2. Пересчитай `weighted_total = 0.25*accuracy + 0.25*actionability + 0.20*insight + 0.15*brand_fit + 0.15*risk_awareness`. Расхождение >0.05 - ошибка отчёта.
3. Проверь наличие: `anchor`, evidence на каждый gap, `probes` для класса A/B/D (иначе risk ≤5.0 и verdict ≤ return).
4. Вердикт не переопределяется на этом уровне. Диспут - между автором и ФЕНИКСОМ (max 2 раунда), дальше Иван.

## 4. Вывод Ивану

- ✅ **GO** (≥7.5) - deliver, gaps в backlog следующей итерации
- 🟡 **RETURN** (6.0-7.4) - top-3 gaps как rework-задачи с ответственным и сроком, max 3 итерации
- 🔴 **VETO** (<6.0) - остановить downstream-работу, эскалация Ивану немедленно

Формат: одна строка вердикта, anchor, таблица gaps (gap · evidence · чекпоинт), rework_tz, пробы FAIL (если есть).

## 5. Персист

- Полный отчёт: `knowledge/episodes/$(date +%Y-%m)/feniks-audit-<slug>-$(date +%Y%m%d).md` (JSON + evidence ledger + пробы + anchor).
- Строка трейса `event: audit` в `traces/$(date +%F)/agents.jsonl` (`feniks_score`, `verdict`, `deliverable_ref`) - roster-protocol §9.
- Диспут (если был): `knowledge/episodes/$(date +%Y-%m)/disputes/<slug>.md`.

## Ограничения

- Score >9.0 только при всех 25 чекпоинтах 2/2 с evidence; в 2026 году таких не было.
- Никогда не переопределяй вердикт ФЕНИКСА на уровне этого skill. Никогда не проси его «подвинуть оценку».
- Em dash в отчёте - дефект отчёта.
