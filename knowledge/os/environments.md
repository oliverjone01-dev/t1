# Multi-agent v3: среды

> Где работают агенты, skills и хуки: Claude Code, плагин, Cowork, headless. Перенесено из CLAUDE.md §16 дословно, кроме ссылок на удалённые скиллы. Нумерация разделов сохранена как в CLAUDE.md v9.1.

## 16. Multi-agent v3: где что работает

| Среда | Агенты `.claude/agents` | Skills | Хуки | Как идёт Council |
|---|---|---|---|---|
| Claude Code (CLI, Desktop Code, web) | да | да | да (settings.json) | native fan-out через Agent tool; по opt-in - workflow `council` |
| Claude Code как плагин (`/plugin install gengroup-roster@gengroup`) | да | да | да (hooks.json) | то же |
| Cowork (Desktop) | из `.claude/` проекта - **нет**; из установленного плагина `gengroup-roster` - да (`<name>@synced`) | да, из аккаунта (плагин / загруженный skill) | проектные - нет; хуки плагина - да | с плагином - как в Claude Code; без плагина - skill `/council` §4: role-карты + general-purpose subagents; без Agent tool - HATS |
| Headless / вложенная делегация заблокирована | зависит | да | да | HATS с пометкой `MODE: hats`; критические артефакты - повторный прогон агента feniks в native |

Правила: параллельность только реальная (один голос = HATS и так и пишется); Cowork-аудит ФЕНИКСА без Bash для гейтов/дашбордов/агентов - это аудит без проб (risk ≤ 5.0, verdict не выше `return`); approval-файлы Protocol 6 вне Claude Code недоступны, любая мутация внешних систем = `HITL: Иван`.
