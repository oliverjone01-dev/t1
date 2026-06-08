# GENGROUP AI MASTER SYSTEM v9.0 — OPERATIONAL EDGE

**Status:** Release candidate · **Date:** Июнь 2026 · **Owner:** Иван Раюшкин (CMO) · **Audit:** ФЕНИКС pre-release

> v9.0 — это не накопительное обновление. Это переход системы из режима «документ-как-конституция» в режим **исполняемой инфраструктуры**. Половина того, что в v7–v8 жило как принцип, теперь живёт как hook, JSON-схема или subagent. Принципы не блокируют ошибки. Хуки — блокируют.

---

## 1. Что не работало в v8.0 (брутальный разбор)

| Проблема | Симптом | Корень |
|---|---|---|
| **36 агентов** | Иван не помнит половину имён. СПАРТАК тратит токены на ритуал «assemble roster max 4». | Coordination tax растёт O(n²). Mid-size teams (5–12) превосходят большие команды в скорости и качестве решений (research: AutoGen, MetaGPT, ChatDev). |
| **Protocol 9 как принцип** | Кейс с прорабами — Иван остановил руками, не система | Принцип в DOCX не имеет executor. Без hook нет блокировки. |
| **ФЕНИКС без эмпирики** | Оценка 9.99/10 без объяснимых метрик | Adversarial audit, который не открывает URL и не считает токены — это театр самопроверки |
| **«15 skills max»** | Искусственное ограничение | Тащится из контекстного лимита Claude.ai. В Claude Code skills auto-invoke по description — нет ceiling, есть бюджет внимания |
| **Opus везде** | Стоимость работы 1 Council = 200K токенов × $15/M = $3 за совещание | Routing отсутствует. Haiku/Sonnet недозагружены |
| **Markdown как I/O контракт** | Council voting не агрегируется автоматически. БОРИС не передаёт А2А через JSON. | Текстовые контракты не валидируются. Roadmap entries разъезжаются с CRM |
| **Memory = «RAG»** | Агент путает прошлую сессию с общим знанием | В v8 нет различения working / episodic / semantic / procedural |
| **«9.99/10»** | Невозможно проверить, насколько система реально работает | Telemetry отсутствует. Нет traces, нет cost per agent, нет outcome-attribution |
| **Reflexion** | Protocol 4 (RLAIF) описан, не реализован | Нет процедуры monthly self-review past outputs |
| **HITL implicit** | «Иван одобрит» — без формата, времени, эскалации | Permission gates не стандартизированы |

## 2. Что было сильно — оставляем

- **Tier 0 (ФЕНИКС не подчиняется СПАРТАКУ).** Independent audit layer = главное оружие против self-deception. Сохраняем, усиливаем computer-use и метриками.
- **Step 12.5 Adversarial Review.** Gate перед DELIVER. Сохраняем, формализуем как JSON-контракт.
- **Anti-Slop standard.** Прав. Сохраняем, усиливаем list блокированных конструкций v8.0 (em dash ban, etc.).
- **Protocol 9 Reality Audit.** Концепция железная. Превращаем в hook + skill + slash-команду.
- **Council Configurations.** Multi-agent patterns правильные. Стандартизируем JSON-output и tournament aggregation.

## 3. Архитектурные сдвиги v9.0

### 3.1. Из 36 → в 12 (Activated Roster)

**Tier 0 (Independent Audit):**
- **ФЕНИКС #35** — adversarial audit, computer-use enabled

**Tier Chairman (Orchestration):**
- **СПАРТАК #21** — оркестратор, единственная точка входа

**Tier 1 (Strategy & Brand):**
- **МАРКО #1** — CMO, контент-стратегия, lookбук
- **ДАТА #29** — продакт-аналитик, источники цифр, выгрузки

**Tier 2 (Customer Experience):**
- **ВИКТОР #13** — скрипты продаж, речевые модули, NLP
- **БОРИС #11** — CRM/1С, A2A-формат, миграции данных
- **ЭММА #7** — packaging, voice & tone, объяснение «зачем»

**Tier 3 (Production & Content):**
- **МАКС #3** — copy, длинные форматы, humanizer-ru
- **СЕМЁН #17** — SEO/AEO, AI Citation Rate, browser-use audits
- **КРЕА #19** — creative direction, бренд-эстетика, anti-median test

**Tier 4 (Finance & Crisis):**
- **РОМАН #30** — CFO, unit-экономика, crisis response
- **ТРЕНЕР #36** — L&D, ADDIE, обучение менеджеров

**Roster discipline:**
- Остальные 24 — в `archive/` как inactive. Можно ре-активировать одной командой `/agent activate <name>`.
- Любая новая активация требует Reality Audit (Protocol 9): что эта роль делает, чего не делают активные?
- Запрет «теневых» агентов. Если функция нужна — либо это новый skill (процесс), либо ре-активация (роль).

### 3.2. Skills больше не имеют ceiling

В Claude Code skills auto-invoke по `description`. Нет лимита 15. Есть **бюджет внимания**: каждый skill должен иметь триггер, который не пересекается с другими (тестируется ФЕНИКСОМ ежемесячно — Protocol 7).

### 3.3. Hooks — новый слой между намерением и действием

В Claude Code `settings.json` поддерживает hooks. v9.0 использует это так:

- **PreToolUse(Write|Edit):** проверка Anti-Slop blocklist
- **UserPromptSubmit:** детектор P9-триггеров (слова «эффект», «удвоит», «уникальный актив», диапазоны >2x) → запрос подтверждения
- **PreToolUse(Bash: git push):** запуск ФЕНИКС-аудита изменений
- **SessionStart:** инжект CLAUDE.md и активного roster
- **Stop:** Telemetry flush (Protocol 14)

Принципы → детерминированные блокаторы.

### 3.4. Model Routing (Protocol 11)

| Класс задачи | Модель | Обоснование |
|---|---|---|
| Утилитарные (grep, list, rename, status) | `haiku-4-5` | <1¢, latency <500ms |
| Контент/код/анализ default | `sonnet-4-6` | Best price/performance |
| Adversarial review, P9, Council aggregation, Crisis | `opus-4-8` | Reasoning depth обязателен |
| Mass content batch (>10 артикулов/сутки) | `sonnet-4-6` + prompt caching | 90% cost saving на system prompt |

**Правило:** ФЕНИКС всегда opus. СПАРТАК opus для Council, sonnet для routing. Tech agents — sonnet default.

### 3.5. Memory Tiering (Protocol 12)

Четыре уровня. Каждый агент знает, где что искать:

| Слой | Что хранится | Где | Срок жизни |
|---|---|---|---|
| **Working** | Текущая задача, файлы в контексте | Context window | 1 сессия |
| **Episodic** | Прошлые решения, диспуты, кейсы | `knowledge/episodes/YYYY-MM/*.md` | Бессрочно, версионировано |
| **Semantic** | Глоссарий, регламенты, PRL v0-v8, цены | `knowledge/semantic/` + RAG | Snapshot per version |
| **Procedural** | Как делать (skills, шаблоны, чек-листы) | `.claude/skills/` | Версионируется через Protocol 7 |

Конфликт между слоями → приоритет: **Semantic > Procedural > Episodic > Working**. (Свежие данные побеждают свежие воспоминания.)

### 3.6. A2A Wire Format (Protocol 13)

Все межагентные передачи — JSON по схеме:

```json
{
  "from": "marco",
  "to": "feniks",
  "intent": "review_request",
  "deliverable_ref": "knowledge/episodes/2026-06/roadmap-h2.md",
  "context": {
    "tier": "council_cc-12",
    "deadline": "2026-06-15T18:00:00+03:00",
    "p9_required": true
  },
  "expected_output": "feniks_audit_report_v1",
  "thread_id": "council-2026-06-08-42"
}
```

Каждое сообщение валидируется через `schemas/a2a-message.json`. Невалидные — отвергаются с ошибкой. Никаких больше «передачу понял».

### 3.7. Observability (Protocol 14)

Каждый agent invocation пишет trace в `traces/YYYY-MM-DD/`:

- `agent`, `tier`, `task_id`, `parent_task`
- `tokens_in`, `tokens_out`, `model`, `cost_usd`
- `outcome` (success/blocked/escalated)
- `confidence` (0–1, агент сам ставит)
- `feniks_score` (если был review)

Раз в неделю — агрегация. Раз в месяц ФЕНИКС-ретро по traces (Protocol 15).

### 3.8. Reflexion (Protocol 15)

Ежемесячно — Council CC-19 Roadmap Reflexion:
1. ФЕНИКС берёт episodic memory за период (`knowledge/episodes/`)
2. Сверяет: предсказанный эффект vs реальный (метрики из traces + 1С/Bitrix24)
3. Находит систематические ошибки → обновляет skill checklists
4. СПАРТАК публикует `knowledge/reflexion/YYYY-MM.md`

## 4. Что вырезается (cull list)

- ❌ Все CC за пределами CC-09…CC-19. Lower-CC растворены в новых через консолидацию.
- ❌ Reserved skill slots #11–12 (pricing-engine, rlaif-feedback) — это **не skills, это интеграции**. Переносятся в `integrations/`.
- ❌ JARVIS-как-отдельная-сущность — это **MCP server n8n + Python**, ничего больше. Не магия.
- ❌ «Tier 5» если есть — flatten в Tier 3.
- ❌ Любые упоминания «уникальный актив», «удвоит бизнес», «выстрелит», «никто в РФ» — добавлены в Anti-Slop blocklist v2.

## 5. Что добавляется (add list)

- ✅ **Subagents:** `.claude/agents/*.md` × 12 активных + archive/
- ✅ **Skills:** `.claude/skills/<name>/SKILL.md` (формат Claude Code)
- ✅ **Slash Commands:** `/council`, `/reality-audit`, `/feniks`, `/crisis`, `/skill-audit`, `/anti-slop`
- ✅ **Hooks:** `.claude/settings.json` с pre/post hooks
- ✅ **Schemas:** `schemas/*.json` для A2A, audit-report, council-vote, roadmap-entry
- ✅ **CLAUDE.md** — системный promption (Protocol 1-15, активный roster, anti-slop)
- ✅ **Browser/Computer Use** для ФЕНИКСА и СЕМЁНА — реальные проверки сайта
- ✅ **Prompt caching** для system prompts (Anthropic API feature, экономия 90%)

## 6. Backward compat

v8.0 skills (`.skill`) переименовываются в `.claude/skills/<name>/SKILL.md`. Контент сохраняется 1-в-1, добавляется YAML frontmatter (name, description, version).

v8.0 36-agent DOCX → переносится в `.claude/agents/archive/v8/` для истории. Активный ростер — 12 файлов в `.claude/agents/`.

Protocol 9 v1.0 → Protocol 9 v2.0 (executable). Семантика та же.

## 7. Success criteria (как мы поймём что v9 не маркетинг)

| Метрика | v8 baseline | v9 target | Как меряем |
|---|---|---|---|
| Cost per Council | $3.00 (opus всегда) | $0.40 (routing) | Telemetry traces |
| Halted by P9 hook | 0 (не существует) | ≥2/неделю | Hook log |
| ФЕНИКС audit avg score | 9.99 (не верю) | 7.5–8.5 (честно) | Audit logs |
| Cycle time idea → roadmap | 2 дня | 30 минут | Episodic timestamps |
| Roadmap entries с P9-меткой | ~30% | 100% | Schema validation |
| Reflexion-driven skill updates | 0 | ≥1/месяц | reflexion/*.md |

## 8. Roadmap v9 → v9.5

- **Sprint 1 (эта неделя):** CLAUDE.md, 6 flagship subagents, 3 skills, 4 commands, settings.json hooks
- **Sprint 2 (+1 неделя):** Остальные 6 субагентов, A2A schemas, telemetry collector
- **Sprint 3 (+2 недели):** Browser/Computer use для ФЕНИКСА и СЕМЁНА, Bitrix24 MCP интеграция (когда готов)
- **Sprint 4 (+3 недели):** Reflexion loop, prompt caching layer
- **v9.5 (Q3-2026):** RLAIF полный — petros loop closed

---

**Автор:** Claude (Opus 4.7) совместно с Иваном Раюшкиным
**Триггер релиза:** аудит v8 показал, что 60% протоколов — декоративные. Operational edge = hook вместо принципа.
**Утверждение:** требуется ФЕНИКС audit + Иван approval.
