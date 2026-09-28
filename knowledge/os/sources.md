# Источники правды

> Где лежат данные, определения агентов, схемы, хуки, плагин. Перенесено из CLAUDE.md §14 дословно, кроме ссылок на удалённые скиллы. Нумерация разделов сохранена как в CLAUDE.md v9.1.

## 14. Sources of Truth

- **Аналитика OZON (живые данные):** `analytics-mvp/` - n8n-вебхуки (`gengroup-ozon-ads|skus|pnl|pnl-sku`) → `fetch:live` → `data/` → дашборды. `fixtures/` - только референс, в отчёты не подавать. Мультиплатформа (WB/ЯМ) - новыми n8n-workflow в едином контракте данных, см. `knowledge/episodes/2026-06/feniks-veto-uploaded-docs-20260610.md`
- **Глоссарий брендов:** `glossary.md` + лендинг `index.html`
- **Master System v9 manifesto:** `agents-v9/MASTER_SYSTEM_v9.md`
- **Agent definitions:** `.claude/agents/*.md`
- **Skills:** `.claude/skills/*/SKILL.md`
- **Schemas (A2A, audit, vote):** `schemas/*.json`
- **Permissions/hooks:** `.claude/settings.json` (проектная регистрация) и `.claude/hooks/hooks.json` (та же регистрация для плагина)
- **Migration v8→v9:** `agents-v9/MIGRATION_v8_to_v9.md`
- **Workflows (детерминированная оркестрация):** `.claude/workflows/council.js` - только по явному opt-in Ивана («use a workflow» / «ultracode»)
- **Агентная память (Protocol 12, `memory: project`):** `.claude/agent-memory/{feniks,spartak,data}/MEMORY.md` - калибровка и карта источников, не факты бизнеса
- **Cowork / plugin:** `.claude-plugin/plugin.json` + `marketplace.json`; установка и ограничения - `agents-v9/COWORK_AND_PLUGIN.md`
