# gengroup-roster: ветка plugin

Лёгкая выгрузка плагина `gengroup-roster` из ветки `main` репозитория `oliverjone01-dev/t1`
(только манифесты, `agents/`, `.claude/skills`, `.claude/hooks`, `.claude/workflows/council.js`, `schemas/`).
Нужна для серверной синхронизации маркетплейса в Claude Desktop → Customize → Plugins,
которая клонирует репозиторий целиком: `main` с историей аналитики весит сотни мегабайт, эта ветка меньше мегабайта.

Подключение: Add marketplace → `oliverjone01-dev/t1#plugin` → установить `gengroup-roster`.
В Claude Code CLI: `claude plugin marketplace add oliverjone01-dev/t1#plugin`.

Не редактировать вручную: источник правды `main`, обновление через `.claude-plugin/export-plugin.sh`.
