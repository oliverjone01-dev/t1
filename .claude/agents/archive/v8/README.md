# v8 Agent Archive - Inactive Roster

> Этот каталог хранит **профили 24 неактивных агентов** из ростера v8.0. Активный ростер v9.0 - 12 агентов в `.claude/agents/*.md`. Остальные 24 - здесь, для возможной реактивации.

## Status: physical migration deferred

Полные DOCX-профили v8 находятся в корне репозитория:
`GENGROUP_AI_MASTER_SYSTEM_v7_0.docx` (контент v7+v8, агенты #1–#36).

Перенос индивидуальных профилей в эту папку запланирован в **MIGRATION Sprint 2 (неделя 2)**, owner: Иван Раюшкин. До тех пор source-of-truth - общий DOCX в корне.

## Reactivation procedure

Чтобы перенести агента из inactive в active:

1. **Reality Audit обязателен:** `/reality-audit "Активировать агент <name>: что он делает, чего не делают активные 12, какой incremental value"`
2. **FENIX review:** scores ≥7.5 для actionability и insight required
3. **Иван approval** (HITL gate)
4. Skopiровать профиль из `GENGROUP_AI_MASTER_SYSTEM_v7_0.docx` в `.claude/agents/<name>.md`, обновить под формат v9 (YAML frontmatter, Tools, model)
5. Обновить `CLAUDE.md` Active Roster table
6. Episode log: `knowledge/episodes/YYYY-MM/activation-<name>.md`

## Inactive agents (24)

Краткий мапинг из v8 Master System. Полные профили - в `GENGROUP_AI_MASTER_SYSTEM_v7_0.docx`.

| # | Имя | Tier (v8) | Зона |
|---|---|---|---|
| 2 | АЛЕКС | 1 | Tech architecture / agentic workflow |
| 4 | ЗАРА | 1 | SMM |
| 5 | ИГОРЬ | 2 | Customer service |
| 6 | ФЁДОР | 2 | CustDev |
| 8 | ЛЕНА | 2 | E-commerce |
| 10 | (reserved) | - | - |
| 12 | ДИАНА | 2 | Customer analytics |
| 14 | ПАВЕЛ | 2 | Sales support |
| 15 | НАТАША | 2 | Marketplace ops |
| 16 | НОРА | 2 | After-sales |
| 18 | КОСТЯ | 3 | Sales analytics / RLAIF feedback |
| 20 | ВИЗУАЛ | 3 | Visual production |
| 22 | АРХИТЕКТ | 4 | Tech architecture |
| 23 | (Tech-23) | 4 | Frontend |
| 24 | (Tech-24) | 4 | Backend |
| 25 | (Tech-25) | 4 | DevOps |
| 26 | (Tech-26) | 4 | QA |
| 27 | (Tech-27) | 4 | Data engineering |
| 28 | (Tech-28) | 4 | Security |
| 31 | ЛЕВ | 4 | Strategy advisor |
| 32 | ОЛЬГА | 4 | Operations / cash management |
| 33 | ИЛЬЯ | 4 | DevOps / infra |
| 34 | ДЭВИД | 1 | Internal ops / analytics |

## Why these are inactive in v9

См. **MASTER_SYSTEM_v9.md §3.1**. Cull rationale: coordination tax O(n²); peak agent-team performance research показывает оптимум 5-12; reactivation требует доказательства incremental value через P9.

Активный ростер v9 был выбран по принципу:
- **Tier 0** (ФЕНИКС) - независимый аудит, незаменим
- **Chairman** (СПАРТАК) - orchestrator, единственная точка входа
- **5 операционных лиц с прямым ROI:** МАРКО (CMO), РОМАН (CFO), ВИКТОР (sales), БОРИС (CRM), СЕМЁН (SEO)
- **5 production-агентов:** МАКС (copy), КРЕА (creative), ЭММА (packaging), ДАТА (numbers), ТРЕНЕР (L&D)

Tech Block (#22-28) - растворён: для tech-задач Claude Code сам использует Read/Write/Bash/Edit + general-purpose, отдельные tech-агенты не нужны при наличии IDE-интеграции.

## Reference

- v9 cull rationale: `agents-v9/MASTER_SYSTEM_v9.md` §3.1
- Active roster: `.claude/agents/*.md` (12 файлов)
- Migration plan: `agents-v9/MIGRATION_v8_to_v9.md` Sprint 2
- v8 source DOCX: корень репо
