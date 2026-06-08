# GENGROUP AI MASTER SYSTEM v9.0 - OPERATIONAL EDGE

**Status:** Release candidate (iteration 2 - post ФЕНИКС self-audit) · **Date:** Июнь 2026 · **Owner:** Иван Раюшкин (CMO) · **Audit:** ФЕНИКС iteration 1 verdict=veto, iteration 2 in progress

> v9.0 - это не накопительное обновление. Это переход системы из режима «документ-как-конституция» в режим **исполняемой инфраструктуры**. Половина того, что в v7-v8 жило как принцип, теперь живёт как hook, JSON-схема или subagent. Принципы не блокируют ошибки. Хуки - блокируют.

---

## 0. Notation & calibration

**Метки цифр** (Protocol 9 enforced):

- `[ДАННЫЕ: <source>, c=<confidence 0.0-1.0>]` - проверяемый источник
- `[ГИПОТЕЗА: <author>, допущения: А=…, Б=…]` - оценка без источника
- `[РЕТРО-ОЦЕНКА: <basis>]` - оценка постфактум на основе общеотраслевой логики (промежуточный класс, ниже `[ДАННЫЕ]`, выше `[ГИПОТЕЗА]`)

Все цифры в этом документе размечены. Не размеченные - баг репорта (заводить issue).

## 1. Что не работало в v8.0 (брутальный разбор)

| Проблема | Симптом | Корень |
|---|---|---|
| **36 агентов** | Иван не помнит половину имён `[ГИПОТЕЗА: автор, допущение А=Иван слышал имя X но забыл должность]`. СПАРТАК тратит токены на ритуал «assemble roster max 4» | Coordination tax растёт `[РЕТРО-ОЦЕНКА: O(n²) на парные координации; общая логика теории команд, не measure-out by metric]`. Multi-agent research (AutoGen [Microsoft 2023, arxiv 2308.08155], MetaGPT [DeepWisdom 2023, arxiv 2308.00352], ChatDev [Tsinghua 2023, arxiv 2307.07924]) сходится: peak в **5-12 агентах**. Применимость к маркетингу мебели: research-domain abstract, но coordination tax не зависит от ниши - зависит от размера команды |
| **Protocol 9 как принцип** | Кейс с прорабами - Иван остановил руками, не система `[ДАННЫЕ: GENGROUP_Protocol_9_Reality_Audit.docx Глава 1 Кейс 0, c=1.0]` | Принцип в DOCX не имеет executor. Без hook нет блокировки |
| **ФЕНИКС без эмпирики** | Оценка `9.99/10` без объяснимых метрик `[ДАННЫЕ: GENGROUP_AI_MASTER_SYSTEM_v7_0.docx стр.1 «ФЕНИКС #35 (adversarial audit, оценка 9.99/10)», c=1.0]` | Adversarial audit без открытия URL и без cost-метрик - это самоотчёт без cross-check |
| **Skill ceiling 15** | Искусственное ограничение `[ДАННЫЕ: GENGROUP_v8_PRO_CHANGELOG.md строка 47, c=1.0]` | Тащится из контекстного лимита Claude.ai (15 описаний x 100 токенов = 1 500 токенов metadata `[ДАННЫЕ: changelog v8 п.15, c=1.0]`). В Claude Code skills auto-invoke - ограничения нет |
| **Opus везде** | `[ГИПОТЕЗА: рынок Anthropic API tariff 2026, допущение А=opus tariff $15/M input, $75/M output]`. При полностью opus Council session 200K input tokens = $3 нижняя граница | Routing отсутствует. Haiku/Sonnet недозагружены |
| **Markdown как I/O контракт** | Council voting не агрегируется. БОРИС не передаёт A2A через JSON `[ДАННЫЕ: GENGROUP_AI_MASTER_SYSTEM_v7_0.docx «БОРИС #11 - A2A protocol», c=1.0]` | Текстовые контракты не валидируются. Roadmap entries разъезжаются с CRM |
| **Memory = «RAG»** | Агент путает прошлую сессию с общим знанием `[РЕТРО-ОЦЕНКА: тип ошибки общеизвестен в LLM-проектах, конкретных incidents GENGROUP не задокументировано]` | В v8 нет различения working / episodic / semantic / procedural |
| **«9.99/10» без traces** | Невозможно verify | Telemetry отсутствует (P14 - новый протокол) |
| **Reflexion** | Protocol 4 (RLAIF) описан, не реализован `[ДАННЫЕ: v7 master system Module 1 Protocol 4 описание есть, executor отсутствует, c=1.0]` | Нет процедуры monthly self-review past outputs |
| **HITL implicit** | «Иван одобрит» без формата | Permission gates не стандартизированы |

**Что значат метки:**
- `[ДАННЫЕ]` - указан путь к файлу в репо, можно прочитать
- `[ГИПОТЕЗА]` - моя оценка, требует validation Иваном или из реальных данных
- `[РЕТРО-ОЦЕНКА]` - применение известного research/общей логики к нашему случаю; не measure-out, но и не гипотеза с нуля

## 2. Что было сильно - оставляем

- **Tier 0 (ФЕНИКС не подчиняется СПАРТАКУ).** Independent audit layer = главное оружие против self-deception. Сохраняем, усиливаем computer-use и метриками.
- **Step 12.5 Adversarial Review.** Gate перед DELIVER. Сохраняем, формализуем как JSON-контракт.
- **Anti-Slop standard.** Прав. Сохраняем, усиливаем list блокированных конструкций v8.0 (em dash ban, etc.).
- **Protocol 9 Reality Audit.** Концепция железная. Превращаем в hook + skill + slash-команду.
- **Council Configurations.** Multi-agent patterns правильные. Стандартизируем JSON-output и tournament aggregation.

## 3. Архитектурные сдвиги v9.0

### 3.1. Из 36 -> в 12 (Activated Roster)

**Tier 0 (Independent Audit):**
- **ФЕНИКС #35** - adversarial audit, computer-use enabled

**Tier Chairman (Orchestration):**
- **СПАРТАК #21** - оркестратор, единственная точка входа

**Tier 1 (Strategy & Brand):**
- **МАРКО #1** - CMO, контент-стратегия, lookбук
- **ДАТА #29** - продакт-аналитик, источники цифр, выгрузки

**Tier 2 (Customer Experience):**
- **ВИКТОР #13** - скрипты продаж, речевые модули, NLP
- **БОРИС #11** - CRM/1С, A2A-формат, миграции данных
- **ЭММА #7** - packaging, voice & tone, объяснение «зачем»

**Tier 3 (Production & Content):**
- **МАКС #3** - copy, длинные форматы, humanizer-ru
- **СЕМЁН #17** - SEO/AEO, AI Citation Rate, browser-use audits
- **КРЕА #19** - creative direction, бренд-эстетика, anti-median test

**Tier 4 (Finance & Crisis):**
- **РОМАН #30** - CFO, unit-экономика, crisis response
- **ТРЕНЕР #36** - L&D, ADDIE, обучение менеджеров

**Roster discipline:**
- Остальные `[ДАННЫЕ: 24 inactive из 36, согласно v7 master system, c=1.0]` агентов - в `.claude/agents/archive/v8/` (см. README там же). Можно ре-активировать через `/agent activate <name>`.
- Любая новая активация требует Reality Audit (Protocol 9).
- Запрет «теневых» агентов: либо это новый skill (процесс), либо ре-активация (роль).

### 3.2. Skills больше не имеют ceiling

В Claude Code skills auto-invoke по `description`. Нет лимита `[ДАННЫЕ: см. v8 changelog п.15 c обоснованием, c=1.0]` 15. Есть **бюджет внимания**: каждый skill должен иметь триггер, который не пересекается с другими (тестируется ФЕНИКСОМ ежемесячно по Protocol 7).

### 3.3. Hooks - новый слой между намерением и действием

В Claude Code `settings.json` поддерживает hooks. v9.0 использует это так:

- **PreToolUse(Write|Edit):** проверка Anti-Slop blocklist
- **UserPromptSubmit:** детектор P9-триггеров (слова «эффект», «удвоит», «уникальный актив», диапазоны >2x) -> инжект reminder
- **PreToolUse(Bash: git push):** запуск ФЕНИКС-аудита изменений (планируется Sprint 3)
- **SessionStart:** инжект CLAUDE.md (Claude Code делает это нативно)
- **Stop:** Telemetry flush (Protocol 14) - планируется Sprint 4

Принципы -> детерминированные блокаторы.

### 3.4. Model Routing (Protocol 11)

Все идентификаторы моделей канонично пишутся в формате `claude-<family>-<version>` (соответствует CLAUDE.md §6 - семантический приоритет).

| Класс задачи | Модель | Обоснование |
|---|---|---|
| Утилитарные (grep, list, rename, status) | `claude-haiku-4-5` | `[ГИПОТЕЗА: haiku tariff 1/10 от opus, latency <500ms по бенчмаркам Anthropic 2026]`. Не measure-out на нашей нагрузке |
| Контент/код/анализ default | `claude-sonnet-4-6` | Best price/performance per `[ДАННЫЕ: claude-api skill reference, c=0.8]` |
| Adversarial review, P9, Council aggregation, Crisis | `claude-opus-4-8` | Reasoning depth обязателен. Cost-benefit оправдан критичностью |
| Mass content batch (>10 артикулов/сутки) | `claude-sonnet-4-6` + prompt caching | `[РЕТРО-ОЦЕНКА: Anthropic prompt caching docs обещают 90% input cost saving на cached prefix; применимо к одинаковому system prompt]` |

**Правило:** ФЕНИКС всегда opus. СПАРТАК opus для Council, sonnet для routing. Tech agents - sonnet default.

### 3.5. Memory Tiering (Protocol 12)

Четыре уровня. Каждый агент знает, где что искать:

| Слой | Что хранится | Где | Срок жизни |
|---|---|---|---|
| **Working** | Текущая задача, файлы в контексте | Context window | 1 сессия |
| **Episodic** | Прошлые решения, диспуты, кейсы | `knowledge/episodes/YYYY-MM/*.md` | Бессрочно, версионировано |
| **Semantic** | Глоссарий, регламенты, PRL v0-v8, цены | `knowledge/semantic/` + RAG | Snapshot per version |
| **Procedural** | Как делать (skills, шаблоны, чек-листы) | `.claude/skills/` | Версионируется через Protocol 7 |

Конфликт между слоями -> приоритет: **Semantic > Procedural > Episodic > Working**. (Свежие фактические данные побеждают свежие воспоминания.)

### 3.6. A2A Wire Format (Protocol 13)

Все межагентные передачи - JSON по `schemas/a2a-message.json`. Validation на стороне получателя. Невалидные сообщения возвращаются с ошибкой.

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
  "expected_output": "audit-report",
  "thread_id": "council-2026-06-08-42"
}
```

Связанные схемы: `schemas/audit-report.json`, `schemas/council-vote.json`, `schemas/roadmap-entry.json`.

### 3.7. Observability (Protocol 14)

Каждый agent invocation пишет trace в `traces/YYYY-MM-DD/*.jsonl`:

- `agent`, `tier`, `task_id`, `parent_task`
- `tokens_in`, `tokens_out`, `model`, `cost_usd`
- `outcome` (success/blocked/escalated)
- `confidence` (0-1, агент сам ставит)
- `feniks_score` (если был review)

Раз в неделю - агрегация. Раз в месяц ФЕНИКС-ретро по traces (Protocol 15).

Implementation: Sprint 4 (Stop hook).

### 3.8. Reflexion (Protocol 15)

Ежемесячно - Council CC-19 Roadmap Reflexion:
1. ФЕНИКС берёт episodic memory за период (`knowledge/episodes/`)
2. Сверяет: предсказанный эффект vs реальный (метрики из traces + 1С/Bitrix24)
3. Находит систематические ошибки -> обновляет skill checklists
4. СПАРТАК публикует `knowledge/reflexion/YYYY-MM.md`

## 4. Что вырезается (cull list)

- ❌ Все CC за пределами CC-09…CC-19. Lower-CC растворены в новых через консолидацию.
- ❌ Reserved skill slots #11-12 (pricing-engine, rlaif-feedback) - это **не skills, это интеграции**. Переносятся в `integrations/`.
- ❌ JARVIS-как-отдельная-сущность - это **MCP server n8n + Python**, ничего больше. Не магия.
- ❌ «Tier 5» если есть - flatten в Tier 3.
- ❌ Любые упоминания «уникальный актив», «удвоит бизнес», «выстрелит», «никто в РФ» - добавлены в Anti-Slop blocklist v2.

## 5. Что добавляется (add list)

- ✅ **Subagents:** `.claude/agents/*.md` x 12 активных + `.claude/agents/archive/v8/README.md` для inactive
- ✅ **Skills:** `.claude/skills/<name>/SKILL.md` (формат Claude Code) - 10 файлов (3 core + 7 продуктовых)
- ✅ **Slash Commands:** `/council`, `/reality-audit`, `/feniks`, `/crisis` (плюс stretch goals в Sprint 3: `/skill-audit`, `/anti-slop`)
- ✅ **Hooks:** `.claude/settings.json` с pre/post hooks
- ✅ **Schemas:** `schemas/a2a-message.json`, `schemas/audit-report.json`, `schemas/council-vote.json`, `schemas/roadmap-entry.json`
- ✅ **CLAUDE.md** - системный prompt (Protocols 1-15, активный roster, anti-slop)
- ⏳ **Browser/Computer Use** для ФЕНИКСА и СЕМЁНА - реальные проверки сайта. Sprint 3.
- ⏳ **Prompt caching** для system prompts (Anthropic API feature). Sprint 4.

## 6. Alternatives Considered

ФЕНИКС iteration 1 выявил: «Альтернативы не разобраны». Закрываю.

### 6.1 Roster size

| Размер | Pro | Con | Решение |
|---|---|---|---|
| 8 | Меньше coordination, дешевле per-Council | Покрытие ролей не полное (нет L&D или нет Creative) | Reject. Скоп проектов GENGROUP требует ⩾10 покрытых функций |
| **12 (выбрано)** | Балансировка покрытия и координации; research peak 5-12 | Тяжелее onboarding нового пользователя | Accept. Покрытие критическое > onboarding cost |
| 16 | Полное покрытие включая tech-block | Coordination tax растёт; tech-задачи дублируются с Claude Code IDE-tools | Reject. Tech растворяется в IDE |
| 36 (status quo v8) | Полная глубина | O(n²) coordination, Иван не помнит ростер | Reject. Кейс прорабов показал: глубина не спасает от blind spots |

### 6.2 Model routing per task class

Альтернатива «opus на всё» (status quo v8) отброшена по cost-обоснованию (см. §3.4 ГИПОТЕЗА tariff). Альтернатива «sonnet на всё» отброшена по credibility-обоснованию: adversarial review требует reasoning depth, FENIX-on-sonnet проседает в стресс-тестах ([ГИПОТЕЗА: на основе общей логики Anthropic positioning opus как reasoning-heavy]).

### 6.3 Memory tiers count

| Кол-во | Что | Решение |
|---|---|---|
| 2 (RAG + context) | Простота | Reject. Не различает «прошлая сессия» vs «вечная истина» - источник bugs |
| 3 (working + ltm + procedural) | Промежуточное | Reject. Прошлые решения (episodic) сливаются с фактологией (semantic) - тоже путает |
| **4 (working/episodic/semantic/procedural) (выбрано)** | Cognitive science аналог Tulving 1985 + дисциплина skill versioning | Accept. Стоимость различения low (просто папки), benefit high (приоритет конфликтов) |
| 6+ | Полная taxonomy memory research | Reject. Over-engineering, бюджет внимания утечёт |

### 6.4 Hooks vs принципы (status quo v8)

Status quo: P9 как DOCX-документ, читается агентами. **Failure mode (доказан):** Кейс прорабов май 2026 - принцип не сработал, Иван остановил руками.

v9 decision: hooks как executable. **Risk (новый):** false positives могут блокировать утилитарные операции. **Mitigation:** hooks по умолчанию injectят reminders, не блокируют. Эскалация к blocking - только после 30 дней метрик.

## 7. Downside & Crisis Scenarios для v9 (FENIX risk-21/23)

### 7.1 Что если success criteria не достигнуты

| Метрика | Target | Downside (-50%) | Action |
|---|---|---|---|
| Cost per Council | $0.40 | $1.20 (sonnet + частичное кеширование) | Revisit P11 routing. Возможно opus только для FENIX, не для аггрегации |
| Halted by P9 hook | ≥2/нед | <1/нед | Tune patterns в `p9-trigger-detector.sh`. Возможно false negative rate высокий |
| FENIX avg score | 7.5-8.5 | 5.5-6.5 (постоянный return) | Calibrate checklist phoenix-eval. Возможно threshold слишком жёсткий для honest baseline |
| Cycle time | 30 мин | 2 часа | Hook latency analysis. Возможно последовательность P9 -> trifecta слишком долгая |
| P9-метки в Roadmap | 100% | 60% | Pre-commit hook на роадмап-файлы (Sprint 3) |
| Reflexion updates | ≥1/мес | 0 | CC-19 не запускается. Триггер на календарный 30-day из Stop hook |

### 7.2 Infrastructure crisis scenarios

| Сценарий | Impact | Mitigation |
|---|---|---|
| Hook chain сломан (false positive p9 на каждый prompt) | Workflow Иван остановлен | Hook временно disable в settings.json (комментарий блока hooks). Rollback к v8 в 5 минут |
| CLAUDE.md рассинхрон с agents/*.md | Agent следует устаревшим протоколам | Pre-merge check (Sprint 3): grep на ключевые секции; reflexion CC-19 catches это monthly |
| Bitrix24 MCP не готов к Sprint 3 | БОРИС зависит от него | Fallback: БОРИС использует CSV-выгрузки manually exported (Roadmap dependency указана) |
| ФЕНИКС возвращает veto на все артефакты подряд | Productivity drop | Calibration session: Иван + ФЕНИКС, корректировка thresholds, episode log |
| Schema breaking change | Все A2A сообщения отвергаются | Schema versions в `$id`; breaking change только через migration episode |
| Token budget overrun (Council >$1) | Cost surprise | СПАРТАК прерывает Council на budget ceiling, эскалирует Ивану |

### 7.3 Reversibility

Полный rollback за <30 минут:
1. `mv .claude .claude.v9.disabled` (deactivates hooks, agents, skills)
2. Восстановить работу через v8 .skill в Claude.ai (никуда не делись)
3. Workflow продолжается как в v8

Частичный rollback за <5 минут:
- Закомментировать конкретный hook в `.claude/settings.json`
- Заменить конкретный subagent на v8 версию из `archive/v8/`
- Удалить конкретный skill

Backup: branch `gengroup-agents-v9` в git history сохраняется бессрочно.

## 8. Success criteria (как поймём что v9 не маркетинг)

| Метрика | v8 baseline | v9 target | Источник baseline | Как меряем v9 |
|---|---|---|---|---|
| Cost per Council | `[РЕТРО-ОЦЕНКА: ~$3 при полностью opus]` | $0.40 | v8 didn't measure (Protocol 14 missing), оценка по tariff `[ГИПОТЕЗА: opus $15/M, Council ~200K tokens]` | Telemetry traces после Sprint 4 |
| Halted by P9 hook | `[ДАННЫЕ: 0, P9 не имел executor, c=1.0]` | ≥2/неделю | v8 master system | Hook log в `traces/` |
| FENIX audit avg score | `[ДАННЫЕ: 9.99/10 self-claim, c=1.0]` | 7.5-8.5 (честно) | v7 master system стр.1 | Audit logs |
| Cycle time idea -> roadmap | `[ГИПОТЕЗА: ~2 дня по Кейсу 0 - manifest -> stop Ивана, не measure-out]` | 30 минут | Кейс прорабов май 2026 | Episodic timestamps |
| Roadmap entries с P9-меткой | `[РЕТРО-ОЦЕНКА: ~30% частично имели обоснование, остальные без; не считалось формально]` | 100% | n/a | Schema validation на `schemas/roadmap-entry.json` |
| Reflexion-driven skill updates | `[ДАННЫЕ: 0, CC-19 не существовал, c=1.0]` | ≥1/месяц | n/a | `reflexion/*.md` |

**Если 3+ из 6 не достигнуты к Д+60** - pre-mortem с ФЕНИКСОМ, возможен откат частей v9.

## 9. Roadmap v9 -> v9.5

| Sprint | Срок | Содержание | Owner |
|---|---|---|---|
| **Sprint 1** | Неделя 1 | CLAUDE.md, 12 subagents, 3 core skills, 4 commands, settings.json hooks, 4 schemas, manifest | Claude (build) + Иван (review) |
| **Sprint 2** | Неделя 2 | 7 продуктовых skills (brand, content-factory, encyclopedia, cross-sell, competitor-intel, geo-aeo, crisis-response); knowledge/ структура; archive/v8/ README | Claude (build) + Иван (review) |
| **Sprint 3** | Недели 3-4 | Browser/Computer Use для FENIX+СЕМЁН; Bitrix24 MCP coupling (когда готов или CSV fallback); telemetry collector via Stop hook; pre-push FENIX hook | Иван (Bitrix MCP), Claude (build остального), Дмитрий Янчоглов (1C/Bitrix integration owner) |
| **Sprint 4** | Недели 4-6 | Prompt caching layer; reflexion loop первый запуск CC-19; calibration session FENIX threshold tuning | Claude + Иван |
| **v9.5** | Q3-2026 | RLAIF feedback loop closed (persistent self-correction по результатам Protocol 15 reflexion); Bitrix24 MCP production | Claude + Иван + Борис |

Каждый Sprint - буфер +30% от инженерной оценки (FENIX hard rule 8).

## 10. Open Items (v9 release backlog)

- [ ] Перенести физические профили 24 inactive agents в `.claude/agents/archive/v8/` (сейчас только README с маппингом; source-of-truth - DOCX в корне) - Owner: **Иван**, Sprint 2 end
- [ ] v8 baseline numbers retroactive estimate (cost/cycle/score) - Owner: **Claude** (build) + **Иван** (validate), Sprint 3
- [ ] Schema test fixtures - smoke validation для всех 4 schemas - Owner: **Claude**, Sprint 2 end
- [ ] Иван verifies golden examples (5 КП + 3 лендинга) для skill `content-factory` - Owner: **Иван**, Sprint 2-3
- [ ] Конкуренты re-verification price snapshot Q3-2026 - Owner: **Наташа Скриптун**, Q3 start
- [ ] Crisis-response thresholds approval - Owner: **Богдан + Роман**, Sprint 1 end

---

**Версия документа:** v9.0.0 RC2 (iteration 2 после FENIX VETO iteration 1)
**FENIX iteration 1:** score 5.05/10, verdict=veto. Полный отчёт: `knowledge/episodes/2026-06/feniks-audit-master-system-v9.md`
**Rework applied:** 10 пунктов из rework_tz (em dash -> dash, [ДАННЫЕ]/[ГИПОТЕЗА] tagging, 2 schemas созданы, naming моделей унифицирован, Alternatives Considered §6, Downside §7, archive README §3.1, опечатки, ответственные §9)
**Re-audit gate:** требуется второй проход FENIX. Threshold: ≥7.5 = go; 6.0-7.4 = return iteration 3; <6.0 = эскалация Богдану + pre-mortem.

**Подпись:** Claude (Opus 4.7) + Иван Раюшкин (CMO)
