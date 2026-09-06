# GENGROUP AI System v9.0 - Operational Edge

> Эта папка - релиз v9.0 агентной системы GENGROUP. Если ты впервые здесь - начни с [MASTER_SYSTEM_v9.md](./MASTER_SYSTEM_v9.md).

## Что такое v9.0 в одной фразе

Половина того, что в v7-v8 жило как принцип, теперь живёт как hook, JSON-схема или subagent. Принципы не блокируют ошибки. Хуки - блокируют.

## Структура

```
/
├── CLAUDE.md                          # Operating constitution - auto-loaded в каждой сессии
├── agents-v9/
│   ├── MASTER_SYSTEM_v9.md            # Манифест: что добавлено, что вырезано, success criteria
│   ├── MIGRATION_v8_to_v9.md          # Пошаговый план перехода с v8.0
│   └── README.md                      # этот файл
├── .claude/
│   ├── settings.json                  # Permissions allowlist + hooks
│   ├── agents/                        # 12 active subagents
│   │   ├── feniks.md                  #  Tier 0 - independent audit (veto rights)
│   │   ├── spartak.md                 #  Chairman - orchestrator
│   │   ├── marco.md                   #  CMO - brand voice + CA mechanics
│   │   ├── data.md                    #  Numbers tagger - [ДАННЫЕ]/[ГИПОТЕЗА]
│   │   ├── roman.md                   #  CFO + crisis response
│   │   ├── viktor.md                  #  Sales scripts + objection handling
│   │   ├── boris.md                   #  CRM/1С/Bitrix24 + A2A wire format
│   │   ├── emma.md                    #  Packaging + JTBD per brand
│   │   ├── maks.md                    #  Long-form copy + Anti-Slop discipline
│   │   ├── semyon.md                  #  SEO/AEO/GEO + browser-use audits
│   │   ├── krea.md                    #  Creative direction + Anti-Median test
│   │   └── trener.md                  #  L&D + ADDIE + Kirkpatrick
│   ├── skills/                        # Reusable procedures
│   │   ├── protocol-9-runner/         #  Reality Audit executable
│   │   ├── phoenix-eval/              #  25-checkpoint FENIX checklist
│   │   └── humanizer-ru/              #  30 RU AI-patterns removal
│   ├── skills/ (user-invocable)       # /council /feniks /reality-audit /crisis /reflexion (v3: вместо commands/)
│   ├── workflows/council.js           # Детерминированный Council (opt-in)
│   ├── agent-memory/                  # Память feniks / spartak / data (Protocol 12)
│   └── hooks/                         # Shell scripts triggered by events
│       ├── p9-trigger-detector.sh     #  UserPromptSubmit - inject P9 reminder
│       └── anti-slop-checker.sh       #  PreToolUse(Write/Edit) - warn on forbidden patterns
├── schemas/
│   ├── a2a-message.json               # Protocol 13 - agent-to-agent envelope
│   └── audit-report.json              # FENIX output contract
└── knowledge/                          # Memory tiering (created on first use)
    ├── semantic/                       #  Snapshot truth (glossary, prices, regulations)
    ├── episodic/                       #  Past decisions, councils, disputes
    └── reflexion/                      #  Monthly retros (Protocol 15)
```

## Ростер v3 (сентябрь 2026) - что изменилось

- Все 13 агентов: `Operating Contract v3` + preload skill `roster-protocol` (жизненный цикл, A2A, evidence, stop conditions, self-check).
- СПАРТАК v3.0: Agent tool, 6 режимов (SOLO / COUNCIL / DEBATE / RED_TEAM / WORKFLOW / HATS), self-check перед ФЕНИКСОМ, пересчёт порогов, память.
- ФЕНИКС v3.0: классификация артефакта, red-team пробы, калибровочные якоря из реальных аудитов 2026, evidence ledger, валидация JSON, хук write-scope.
- Slash-команды заменены skills: `/council`, `/feniks`, `/reality-audit`, `/crisis` (+ новый `/reflexion`, Protocol 15).
- Protocol 14 executable: хуки `SubagentStart/Stop` → `traces/YYYY-MM-DD/agents.jsonl`, схема `agent-trace.json`, `trace-summary.py`.
- `schemas/validate.py` - валидатор без зависимостей; `.claude/workflows/council.js` - детерминированный Council по opt-in.
- Cowork и плагин: `.claude-plugin/`, инструкция и ограничения - `COWORK_AND_PLUGIN.md`.
- Дизайн-решения и P9-разметка: `knowledge/episodes/2026-09/roster-v3-upgrade-20260906.md`.

## Быстрый старт

### Первая сессия

1. **Открой Claude Code в этом репо** - `CLAUDE.md` автоматически загружается
2. **Прочитай active roster** - кто 12 агентов, когда вызывать
3. **Прогон smoke test:**
   ```
   /feniks agents-v9/MASTER_SYSTEM_v9.md
   ```
   ФЕНИКС проведёт self-audit манифеста. Score 7.5-8.5 = система калибрована.

### Типовые сценарии

| Хочу… | Команда |
|---|---|
| Audit-проверить Roadmap или КП | `/feniks <path>` |
| Запустить план перед commit'ом в Roadmap | `/reality-audit <task description>` |
| Решить cross-functional задачу (3+ департамента) | `/council <task>` |
| Активировать кризис-режим | `/crisis <trigger description>` |
| Просто работать с одним агентом | Agent tool: `subagent_type: feniks` (или любой другой из ростера) |
| Месячное ретро системы (Protocol 15) | `/reflexion 2026-09` |

### Скиллы (auto-invoke по описанию)

- Пишу длинную статью → `humanizer-ru` срабатывает на финальном проходе
- Считаю эффект инициативы → `protocol-9-runner` запускается
- ФЕНИКС аудит → `phoenix-eval` загружается автоматически

## Hooks

Уже активированы через `.claude/settings.json` (v3 добавил `deliver-gate.sh` на git push, `subagent-trace.sh` на SubagentStart/Stop, agent-scoped `feniks-write-scope.sh`):

- **UserPromptSubmit:** P9 trigger detector - нудит про Reality Audit при словах «эффект», «удвоит», «уникальный актив» и т.п.
- **PreToolUse(Write/Edit):** Anti-Slop checker - флажит запрещённые конструкции при правке `.md`/`.html`/`.txt`

Оба hook'а **только предупреждают**, не блокируют (по умолчанию). Можно ужесточить, если v9 покажет, что warning игнорируется.

## Что ещё нужно сделать (см. MIGRATION_v8_to_v9.md)

- [ ] Перенести 7 оставшихся skills из v8 (`brand`, `content-factory`, `encyclopedia`, `cross-sell`, `competitor-intel`, `geo-aeo`, `crisis-response`)
- [ ] Скопировать v8 Project Knowledge в `knowledge/semantic/`
- [ ] Архивировать неактивные 24 агента в `.claude/agents/archive/v8/`
- [ ] Bitrix24 MCP connector (Q3-2026)
- [x] Telemetry: хуки SubagentStart/Stop → `traces/YYYY-MM-DD/agents.jsonl` (ростер v3, 2026-09-06)
- [ ] Browser/Computer use для ФЕНИКСА и СЕМЁНА (Sprint 4)
- [ ] Reflexion loop первый месяц: skill `/reflexion` готов, первый прогон - октябрь 2026 за сентябрь

## Success Criteria (через 60 дней)

| Метрика | Baseline (v8) | Target (v9) |
|---|---|---|
| Cost per Council | $3.00 | $0.40 |
| Задач halted by P9/неделю | 0 | ≥2 |
| ФЕНИКС avg score | 9.99 (не верю) | 7.5-8.5 (честно) |
| Cycle time idea → roadmap | 2 дня | 30 мин |
| Roadmap с P9-меткой | ~30% | 100% |
| Reflexion-driven updates/мес | 0 | ≥1 |

## Owners

- **Архитектура v9:** Claude (Opus 4.7) + Иван Раюшкин (CMO)
- **Approval:** Иван Раюшкин
- **Audit gate:** ФЕНИКС (self-audit not allowed; calibration done by reviewing FENIX outputs vs Иван judgement)

## License & Confidentiality

Internal GENGROUP holding documentation. Не для внешнего распространения без согласия Ивана Раюшкина.
