# Migration Guide: v8.0 → v9.0

> Что менять в продакшене и в каком порядке. Каждый шаг — небольшой, atomic, обратимый.

## Что мигрирует и что нет

| Сущность v8.0 | Куда v9.0 | Способ |
|---|---|---|
| 10 Claude.ai skills (.skill) | `.claude/skills/<name>/SKILL.md` | Перенос контента + YAML frontmatter |
| 36 agents в DOCX | 12 active в `.claude/agents/` + 24 в `.claude/agents/archive/v8/` | Активные переписаны, остальные сохранены |
| 10 protocols (v7-v8) | Те же + 5 новых (P11-P15) в `CLAUDE.md` + hooks | Executable где возможно |
| Project Knowledge (Claude.ai) | `knowledge/semantic/` в репо | Manual export |
| Glossary v2.1 (.docx + landing) | `glossary.md` + `index.html` (уже сделано) | Done |
| Protocol 9 принцип | `protocol-9-runner` skill + `/reality-audit` + hook | Executable |
| СПАРТАК step 12.5 | `feniks` subagent + Task tool routing | Mandatory в `/council`, `/feniks` commands |
| n8n JARVIS | Без изменений — это middleware, не агент | Кодиннект через MCP |
| Bitrix24 MCP (planned) | Когда готов — подключить как MCP server | Q3-2026 |

## Шаги миграции (рекомендуемая последовательность)

### Sprint 0 — подготовка (1 день)

- [ ] Сделать snapshot всех v8 артефактов в `.claude/agents/archive/v8/`
- [ ] Записать текущие KPI (cost per session, FENIX avg score, cycle time) — будут baseline для success criteria из MASTER_SYSTEM_v9.md §7

### Sprint 1 — фундамент (неделя 1)

- [x] Создать `CLAUDE.md` (auto-loaded operating constitution)
- [x] Создать 12 active subagents в `.claude/agents/`
- [x] Создать 3 critical skills: `protocol-9-runner`, `phoenix-eval`, `humanizer-ru`
- [x] Создать 4 slash commands: `/council`, `/reality-audit`, `/feniks`, `/crisis`
- [x] Настроить `.claude/settings.json` с hooks (P9 detector, Anti-Slop)
- [x] Создать schemas: `a2a-message.json`, `audit-report.json`
- [ ] Запустить smoke test: `/feniks agents-v9/MASTER_SYSTEM_v9.md` — должна работать (само-аудит манифеста)

### Sprint 2 — наполнение (неделя 2)

- [ ] Перенести remaining 7 skills из v8 в `.claude/skills/`:
  - `gengroup-brand` → `.claude/skills/brand/SKILL.md`
  - `gengroup-content-factory` → `.claude/skills/content-factory/SKILL.md`
  - `gengroup-encyclopedia` → `.claude/skills/encyclopedia/SKILL.md`
  - `gengroup-cross-sell` → `.claude/skills/cross-sell/SKILL.md`
  - `gengroup-competitor-intel` → `.claude/skills/competitor-intel/SKILL.md`
  - `gengroup-geo-aeo` → `.claude/skills/geo-aeo/SKILL.md`
  - `gengroup-crisis-response` → `.claude/skills/crisis-response/SKILL.md`
- [ ] Скопировать Project Knowledge в `knowledge/semantic/`:
  - PRL v0-v8 PDFs
  - Энциклопедия GENGROUP
  - Регламенты
  - Marketing Strategy 2026
  - Алиса для AI-продавца
  - Конкуренты (PDFs)
- [ ] Создать `knowledge/episodes/2026-06/` для текущих эпизодов

### Sprint 3 — автоматизация (неделя 3)

- [ ] Включить hooks в `.claude/settings.json` (если ещё не активированы)
- [ ] Запустить ФЕНИКС-аудит первого крупного deliverable через `/feniks` — проверить, что весь pipeline работает end-to-end
- [ ] Запустить тренировочный `/council` на тестовой задаче ("разработать план запуска CIPRIA на маркетплейсах")
- [ ] Telemetry: настроить запись в `traces/YYYY-MM-DD/*.jsonl` (через Stop hook — TODO в Sprint 4)
- [ ] Baseline metrics после первой недели использования

### Sprint 4 — интеграции (недели 4-6)

- [ ] **Bitrix24 MCP** (когда готов): подключить как MCP server, тестировать чтение через ДАТА
- [ ] **n8n MCP** (уже есть): задокументировать в `CLAUDE.md` какие workflows доступны
- [ ] **Browser/Computer use** для ФЕНИКСА и СЕМЁНА: подключить расширенные tools для real site audits
- [ ] **Prompt caching:** замаркировать system prompts subagents как cacheable
- [ ] **Telemetry collector:** Stop hook, который флашит trace в файл

### Sprint 5 — Reflexion loop (месяц 2)

- [ ] Первый `/council` с CC-19 (Reflexion) — ретро по episodic memory
- [ ] Обновление skill checklists на основе reflexion findings
- [ ] Снять метрики vs baseline из Sprint 0

## Откат (rollback)

Если v9.0 даёт проблемы:

1. **Полный откат:** удалить `.claude/`, восстановить v8 .skill в Claude.ai → продолжить работу как в v8
2. **Частичный откат:** отключить отдельные hooks (закомментировать в `settings.json`)
3. **Agent rollback:** заменить агент в `.claude/agents/<name>.md` на версию из `archive/v8/` (роль возвращается к старой)

Backup branch: `gengroup-agents-v9` сохранён в git history, к нему можно вернуться в любой момент.

## Risk Register

| Риск | Вероятность | Mitigation |
|---|---|---|
| Hooks мешают повседневной работе (false positives P9) | Средняя | Hooks injectят reminders, не блокируют. Tune patterns по фактуре |
| ФЕНИКС оценивает слишком жёстко — всё <8 | Высокая в первый месяц | Это и есть цель — calibration. v8 9.99/10 был ложным |
| Coordination overhead Council | Средняя | Roster max 4. Solo для рутины |
| Cost per Council > $1 budget | Средняя | Model routing (P11). Прерывание при превышении |
| Agents не знают новых протоколов P11-P15 | Низкая | CLAUDE.md auto-loaded, прописано во всех 12 agents |
| Глоссарий v2.1 терминология ломается | Низкая | Embedded в МАКС, ВИКТОР, СЕМЁН, КРЕА; ФЕНИКС checkpoint 4 в phoenix-eval |

## Success Criteria (см. MASTER_SYSTEM_v9.md §7)

После 4 недель использования:

- ✅ Cost per Council session ≤ $0.40 (baseline $3.00)
- ✅ ≥2 задач/неделю halted by P9 hook
- ✅ ФЕНИКС avg score 7.5-8.5 (честный baseline)
- ✅ Cycle time idea → roadmap ≤30 минут (с $3.00)
- ✅ 100% Roadmap entries с P9-меткой
- ✅ ≥1 reflexion-driven skill update в месяц

Если 3+ из 6 не достигнуты к Д+60 — provoке полный pre-mortem с ФЕНИКСОМ.

## Decision Log (DR — Design Records)

| DR# | Decision | Rationale |
|---|---|---|
| DR-001 | Активный ростер 12 вместо 36 | Coordination tax O(n²); research показывает peak в 5-12 |
| DR-002 | Все межагентные сообщения — JSON | Markdown не валидируется и не агрегируется |
| DR-003 | Hooks для P9 и Anti-Slop | Принципы не блокируют. Только executable enforcement работает |
| DR-004 | Model routing per task class | $3.00/Council → $0.40 saving достигается этим одним решением |
| DR-005 | ФЕНИКС остаётся в Tier 0 (не подчиняется СПАРТАКУ) | Главное оружие против self-deception. Сохраняем |
| DR-006 | Skills без ceiling 15 | Ceiling из Claude.ai context limit, не применимо в Code |
| DR-007 | СПАРТАК добавляет cost budget per Council | Без cap легко уйти в overspend |

---

**Контакт по миграции:** Иван Раюшкин (CMO) + Claude (architect/auditor)
**Дата старта:** июнь 2026
**Контрольная дата:** через 60 дней — full review vs success criteria
