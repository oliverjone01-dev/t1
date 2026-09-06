# Ростер v3: апгрейд СПАРТАКА, бойцов и ФЕНИКСА до multi-agent уровня (design record)

**Дата:** 2026-09-06 · **Инициатор:** Иван (запрос: «доработать навыки до уровня высшего прогресса мультиагентных систем, для Cowork и апгрейда скиллов Claude Code») · **Исполнитель:** Claude Code (ветка `claude/spartak-roster-phoenix-skills-hgzf45`) · **Гейт:** Step 12.5 ФЕНИКС до PR

## 1. Что было (аудит ростера v2.0, факты)

- [ДАННЫЕ: `.claude/agents/spartak.md` v2.0, строка `tools: Read, Grep, Glob, Bash, Write, Task`] инструмент `Task` переименован платформой в `Agent`; СПАРТАК как subagent не мог делегировать. Подтверждение: эпизод `knowledge/episodes/2026-06/council-dashboard-audit-20260609.md`, «Task-tool недоступен внутри текущего контура … Council проведён в режиме носимых шляп».
- [ДАННЫЕ: `CLAUDE.md` §3, MASTER_SYSTEM_v9 §3.7-3.8] Protocol 14 (traces) и 15 (reflexion) описаны как «Sprint 4 / планируется»; `knowledge/reflexion/` физически отсутствовал; в `traces/` только direct-writes и три ручных json ФЕНИКСА.
- [ДАННЫЕ: `.claude/skills/phoenix-eval/SKILL.md` v2] ни одного калибровочного якоря; при этом в эпизодах 2026 года 11 реальных оценок от 3.7 до 8.9. Итерация 1 стабильно 5-6, итерация 2 стабильно 7.6-8.5 - системный сигнал, нигде не зафиксированный.
- [ДАННЫЕ: `knowledge/episodes/2026-07/agent-timur-activation-20260708.md`] три дыры в гейте найдены только live-атакой ФЕНИКСА (ATTACK A/B), но «пробы» как обязательный шаг в роли ФЕНИКСА отсутствовали.
- [ДАННЫЕ: docs Claude Code, снимок 2026-09-06 через claude-code-guide] Cowork не загружает `.claude/agents` и проектные хуки; skills и plugins - только из аккаунта. Значит ростер v2 в Cowork не существовал вообще.
- [ДАННЫЕ: `.claude/agents/data.md` v2] в списке skills - `cohort-analyzer`, `source-resolver`, которых нет в `.claude/skills/`.
- [ДАННЫЕ: `schemas/smoke-test.py` v1] требовал `pip install jsonschema`, которого нет в контейнере → smoke-test не запускался.

## 2. Что сделано

| Блок | Файлы | Механика |
|---|---|---|
| Общий протокол | `.claude/skills/roster-protocol/SKILL.md` (preload во все 13) | RECEIVE → GROUND → WORK → VERIFY → RETURN; структура ответа; evidence; stop conditions; handoff; трейсы; деградированные режимы |
| СПАРТАК v3.0 | `.claude/agents/spartak.md` | `tools: … Agent`; 6 режимов; fan-out одним сообщением; self-check перед ФЕНИКСОМ; пересчёт порогов; `memory: project`; `maxTurns: 80` |
| ФЕНИКС v3.0 | `.claude/agents/feniks.md`, `phoenix-eval/SKILL.md`, `references/calibration-anchors.md`, `references/red-team-probes.md`, хуки `feniks-write-scope.sh` + `feniks-bash-scope.sh` | классификация артефакта; пробы A/B/C/D; якоря 3.7…8.9 (черновик до решения Ивана); evidence ledger; `validate.py` с арифметикой весов; гейт записи в два эшелона (Write/Edit с realpath + Bash-эвристика), project-level по agent_type и agent-scoped; скрипт-посредник эшелоны не видят - это записано как остаточный риск |
| 11 бойцов v3.0 | `.claude/agents/{marco,data,viktor,boris,emma,maks,semyon,timur,krea,roman,trener}.md` | `Operating Contract v3` (lens, intents, выход, evidence, stop, handoff, Council, бюджет, память); frontmatter `skills / maxTurns / color`, у data `memory: project` |
| Cowork | `.claude/skills/council/references/roster-cards.md`, `.claude-plugin/plugin.json`, `marketplace.json`, `agents-v9/COWORK_AND_PLUGIN.md` | role-карты 13 ролей; плагин с agents / skills / workflows / hooks; честные ограничения |
| Skills вместо commands | `.claude/skills/{council,feniks,reality-audit,crisis,reflexion}/SKILL.md`; `.claude/commands/` удалён | каждая - native / workflow / cowork / hats пути |
| Protocol 14 | `.claude/hooks/subagent-trace.sh`, `schemas/agent-trace.json`, `settings.json`, `reflexion/scripts/trace-summary.py` | автоматические трейсы start/stop без содержимого сообщений (репозиторий публичный) |
| Protocol 15 | skill `/reflexion`, `knowledge/reflexion/README.md` | CC-19 по трейсам + эпизодам + памяти |
| Схемы | `schemas/validate.py` (fallback без jsonschema), `smoke-test.py` на 5 схем | executable enforcement P13 / Step 12.5 |
| Workflow | `.claude/workflows/council.js` | детерминированный Council, пороги enforced кодом; только по opt-in |
| Гейт push | `.claude/hooks/deliver-gate.sh` | напоминание о Step 12.5 при push критических артефактов без свежего аудита (не блок) |
| Память | `.claude/agent-memory/{feniks,spartak,data}/MEMORY.md` | seed: калибровка, карта источников, статистика Council |
| Конституция | `CLAUDE.md` v9.1 (§2, §3, §4, §14, новый §16), `agents-v9/README.md` | синхронизация |

## 3. Reality Audit решений (Protocol 9, самопроверка перед ФЕНИКСОМ)

- **Q1 ЦА:** Иван (CMO, 60 лет, не веб-специалист) запускает `/council`, `/feniks` в Claude Code и Cowork; Дмитрий Янчоглов ставит плагин; агенты читают протокол при каждом вызове.
- **Q2 Допущения:** А) вложенная делегация в Claude Code работает (docs 2026-09-06: да; эпизод 2026-06-09: нет, старая версия) - закрыто HATS-fallback; Б) Cowork грузит плагинные skills - [ДАННЫЕ: docs]; В) плагинные хуки в Cowork - [ГИПОТЕЗА], считаем, что их нет.
- **Q3 Данные есть / нет:** есть - docs, эпизоды, трейсы, работающие тесты хуков и валидатора; нет - живая установка плагина, живой Cowork-прогон, стоимость Council v3 в долларах.
- **Q4 Downside:** preload `roster-protocol` (~12.8 KB) в каждый вызов агента - рост input-токенов на вызов [ГИПОТЕЗА: +3-4K токенов]; при 20 вызовах в день это заметно, но prompt caching гасит повтор. Если сломается - убрать из `skills:` у Tier 3-4, оставить ссылку. Хук `deliver-gate` может надоедать при частых push дашбордов - он не блокирует, отключается одной строкой в settings.json.
- **Q5 Первый сигнал:** первый `/council` в native после мержа. Числовые критерии: (а) в `traces/<дата>/agents.jsonl` ≥ 4 строки `subagent_start` с `agent` из ростера и разбросом `ts` ≤ 10 секунд (реальный fan-out, не последовательность); (б) 0 строк с `agent: unknown` после сшивки по agent_id; (в) строка `event: audit` с `feniks_score` и `verdict`. Ответственный: Иван (запуск) + Claude (разбор трейса). Срок: 7 рабочих дней после мержа, буфер +50% (итого до 11 рабочих дней). Второй сигнал: `/reflexion 2026-09` до 10 октября 2026 (буфер до 15 октября).
- **Milestone 50%:** после первого `/council` и первого `/feniks` в native (не позже 5-го рабочего дня): критерий «идём дальше» - оба трейса валидны по `agent-trace.json` и гейт write-scope дал хотя бы одну строку `event: gate`; критерий «сворачиваем» - гейт молчит вживую второй раз подряд, тогда `tools` ФЕНИКСА урезаются до read-only до починки.
- **Rollback (полный, < 5 минут):** `git revert` коммитов PR #281 возвращает v2.0 агентов, `.claude/commands/` и settings.json без новых хуков; частичный - удалить строку хука из `settings.json` (deliver-gate, subagent-trace, feniks-*-scope независимы друг от друга) или убрать `skills:` из frontmatter конкретного бойца. Данные не затрагиваются: трейсы и эпизоды остаются.

## 4. Альтернативы, которые отброшены

- **Оставить commands/, добавить skills рядом** - двойные записи в `/`-меню и два источника правды. Отброшено.
- **Хранить role-карты как копии агентов** - дрейф гарантирован. Выбраны сжатые карты с явным правилом «побеждает файл агента».
- **Блокирующий deliver-gate** - MASTER_SYSTEM_v9 §6.4: блокировка только после 30 дней метрик. Оставлено напоминание.
- **Agent teams (TeamCreate)** - экспериментальная фича по env-переменной, недоступна в headless. Не используется; в roster-protocol не упоминается, чтобы не обещать.
- **Все 40 skills в плагин** - Claude Design Kit (сторонний, лицензия) и kostya-ai (внутренние данные) в плагин ростера не входят.

## 4a. Step 12.5 - итерация 1 (2026-09-06)

ФЕНИКС v3.0: **6.95/10, return** (accuracy 8.0 · actionability 5.0 · insight 8.0 · brand 8.0 · risk 6.0), anchor 7.6 timur-iter1.
Отчёт: `knowledge/episodes/2026-09/feniks-audit-roster-v3-20260906.md`. 23 пробы, 10 gaps с evidence, 16 пунктов rework.
Что нашёл (и что закрыто в итерации 2):
1. Agent-scoped хук write-scope вживую не сработал (Write ФЕНИКСА в `schemas/` прошёл) → project-level регистрация по `agent_type` + agent-scoped с абсолютным путём и `--force`; путь нормализуется realpath (обход через `..` закрыт).
2. Bash-вектор (ATTACK B) → новый `feniks-bash-scope.sh`; git-операции записи ФЕНИКСУ запрещены; ограничение эвристики записано честно.
3. deliver-gate мёртв в shallow clone → tree-diff против origin/main без merge-base; матчер покрывает кавычки, полный путь, `-C`, флаги.
4. Якорь 8.15 арифметически 9.35, claim «>9.0 не наблюдалось» ложен (sales-director 9.25/9.45/9.52) → исправлено в якорях и трёх дублях; набор якорей помечен как черновик до решения Ивана.
5. `validate.py` не проверял арифметику → post-check весов ±0.05 и суммы чекпоинтов; пример phoenix-eval и живой отчёт ФЕНИКСА 2026-07-01 стали фикстурами smoke-test; pattern чекпоинтов допускает цифры.
6. `council.js` пропускал отчёт без проб → `probes` обязательны, класс gate/dashboard/agent без проб получает risk ≤ 5.0, потолок 7.9, verdict ≤ return; ростер Ивана в DEBATE не переопределяется P9; правило «>$1 - предупредить» реализовано через budget (тариф [ГИПОТЕЗА]).
7. Трейс терял агента на SubagentStop → сшивка по agent_id, outcome без «success по умолчанию», feniks_score только ФЕНИКСУ; `trace-summary.py` находит корень через CLAUDE_PROJECT_DIR.
8. CLAUDE.md §9: порог stop сведён с порогом вето; память ДАТЫ - числа с путями; эта секция и Q5 - milestone, числовые критерии, буфер, rollback.

## 5. Открытые вопросы Ивану

1. Подтвердить, что `.claude/agent-memory/` коммитится в публичный репозиторий (сейчас там только калибровка и карта источников, числа с путями, без PII).
4. Утвердить набор калибровочных якорей `phoenix-eval/references/calibration-anchors.md` (черновик): пересчёт якоря 8.15 (арифметически 9.35) и статус серии sales-director 9.25-9.52.
2. Проверить установку плагина по чек-листу `agents-v9/COWORK_AND_PLUGIN.md` §4 и записать результат.
3. Решить, когда deliver-gate переводится в блокирующий режим (предложение: после 30 дней трейсов, на CC-19 за октябрь).
