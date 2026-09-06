# Ростер v3 в Claude Code и в Cowork: установка и ограничения

Дата: 2026-09-06. Источник фактов о платформе: официальные docs Claude Code (sub-agents, skills, hooks, plugins,
plugin-marketplaces, desktop, workflows), проверены 2026-09-06 через claude-code-guide. Всё, что помечено
[ГИПОТЕЗА], на живой установке не проверялось.

## 1. Claude Code (CLI, Desktop → вкладка Code, claude.ai/code)

Ничего устанавливать не нужно: репозиторий сам является проектной конфигурацией.
- Агенты: `.claude/agents/*.md` (13 ростера + 2 технических). [ДАННЫЕ: ls .claude/agents]
- Skills: `.claude/skills/*/SKILL.md`; user-invocable: `/council`, `/feniks`, `/reality-audit`, `/crisis`, `/reflexion`.
- Хуки: `.claude/settings.json` (P6 approvals-guard / direct-write-gate, P9 detector, Anti-Slop, P14 subagent-trace, deliver-gate).
- Workflow: `.claude/workflows/council.js` - запуск по имени `council` только при явном opt-in Ивана.
- Проверка: `python3 schemas/smoke-test.py` (5 схем + 2 живые фикстуры), `bash .claude/hooks/tests/run-hook-tests.sh` (гейты, 112 кейсов), `bash -n .claude/hooks/*.sh`.

## 2. Как плагин (другой репозиторий, другой человек, тот же ростер)

```
/plugin marketplace add oliverjone01-dev/t1
/plugin install gengroup-roster@gengroup
```
Манифесты: `.claude-plugin/plugin.json` (agents, skills, workflows, hooks), `.claude-plugin/marketplace.json`
(репозиторий = маркетплейс с одним плагином, `source: "./"`). Skills в плагине именуются `gengroup-roster:<skill>`.
[ГИПОТЕЗА] Каталог `.claude/agents/archive/` внутри `agents` может дать предупреждение загрузчика (README без
frontmatter); если так - вынести archive из каталога агентов. Проверить на первой установке.

## 3. Cowork (Desktop → вкладка Cowork)

Cowork берёт skills и plugins из настроек аккаунта claude.ai (Customize), а НЕ из `.claude/` проекта.
[ДАННЫЕ: docs desktop.md, skills.md §Skills in Cowork, снимок 2026-09-06]

Что это значит для ростера:

| Компонент | В Cowork | Как компенсировано |
|---|---|---|
| `.claude/agents/*.md` | не загружаются | role-карты 13 ролей в `.claude/skills/council/references/roster-cards.md`; skills `/council`, `/feniks`, `/reality-audit`, `/crisis` имеют раздел «Cowork path» (general-purpose subagents с инлайн-картой, иначе HATS) |
| Проектные хуки `.claude/settings.json` | не применяются (только `~/.claude/settings.json`) | roster-protocol §7 и §10: em dash / Anti-Slop / валидация JSON вручную командами; deliver-gate отсутствует - Step 12.5 держится дисциплиной skill |
| Approval-файлы Protocol 6 | недоступны | любая мутация внешних систем = `HITL: Иван`, только подготовка |
| `memory: project` агентов | недоступна | калибровка ФЕНИКСА читается из `phoenix-eval/references/calibration-anchors.md` (в плагине) |
| Workflow `council.js` | [ГИПОТЕЗА] недоступен | native path / HATS |

Установка в Cowork: плагин из маркетплейса `gengroup` через Customize → Plugins (или загрузка отдельных skills).
[ГИПОТЕЗА] Плагинные хуки (`hooks.json`) в Cowork могут не исполняться; считать, что хуков нет, пока не проверено.

Честная оценка: в Cowork ростер работает как «skills + карты», без независимого субагента-ФЕНИКСА и без
технических гейтов. Поэтому аудит ФЕНИКСА, полученный в Cowork без Bash, для гейтов, дашбордов и агентов считается
аудитом без проб (risk_awareness ≤ 5.0, verdict не выше return; phoenix-eval, поправки v3), а критические артефакты (CLAUDE.md §4) проходят повторный
`/feniks` в Claude Code до deliver.

## 4. Что проверить на первой установке (чек-лист Ивана / Дмитрия)

1. `/plugin install gengroup-roster@gengroup` в чистом репозитории → `/agents` показывает spartak, feniks и бойцов.
2. `/council тест: план на 2 абзаца` в Claude Code → в `traces/<дата>/agents.jsonl` появились строки subagent_start/stop.
3. В Cowork: `/council` → первая строка эпизода `MODE: cowork`, роли из карт.
4. Попытка записать файл в `.claude/agents/` от имени ФЕНИКСА → блок хука `feniks-write-scope.sh`.
5. `python3 .claude/skills/reflexion/scripts/trace-summary.py <YYYY-MM>` даёт сводку без ошибок.
6. `bash .claude/hooks/tests/run-hook-tests.sh` - регрессионный тест гейтов ФЕНИКСА и deliver-gate: все кейсы passed (обязателен после любой правки `.claude/hooks/`).
Результаты - в `knowledge/episodes/<YYYY-MM>/roster-v3-install-check.md`.
