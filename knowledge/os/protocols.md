# Протоколы системы

> Таблица 15 протоколов, Model Routing (P11), Output Routing (P10), Memory Tiering (P12). Перенесено из CLAUDE.md §3, §6, §8, §10 дословно. Нумерация разделов сохранена как в CLAUDE.md v9.1.

## 3. Protocols (v9.0 - executable)

| # | Имя | Где живёт | Как срабатывает |
|---|---|---|---|
| 1 | Long-Term Memory (RAG) | `knowledge/semantic/`, MCP | Перед генерацией - fetch контекста |
| 2 | Agentic Tools | MCP servers + Bash + Read/Edit | По необходимости задачи |
| 3 | Shadow Council | skill `/council` (native fan-out · workflow `council` по opt-in · cowork · hats) | Триггеры: финансы >5M, 3+ департамента, KPI <70% |
| 4 | RLAIF Feedback | Protocol 15 (Reflexion) | Monthly |
| 5 | Agentic Foundation | Все subagents | Reasoning + Planning + Tool Use + Delegated Authority |
| 6 | Governance "Trust by Design" | `.claude/settings.json` permissions | HITL gates на финансах >500K, публикациях |
| 7 | Knowledge Versioning | `knowledge/` + git tags | RAG > Project Knowledge > Prompt > Memory |
| 8 | Crisis Response | skill `/crisis` (+ доктрина `crisis-response`) | 6 триггеров - кассовый разрыв, KPI drop, блок канала, потеря РОПа, рекламации >3%, выручка <80% × 2 недели |
| 9 | **Reality Audit** | Hook `UserPromptSubmit` + разметка цифр агентом data: [ДАННЫЕ] или [ГИПОТЕЗА] с источником (триада data → feniks + marco) | См. §5 |
| 10 | Output Routing | `.claude/skills/output-router` | Запрос → формат → платформа |
| 11 | **Model Routing** | См. §6 | По классу задачи |
| 12 | **Memory Tiering** | `knowledge/working|episodic|semantic|procedural` | Приоритет: Semantic > Procedural > Episodic > Working |
| 13 | **A2A Wire Format** | `schemas/a2a-message.json` + `python3 schemas/validate.py <schema> <file|->` | Все межагентные передачи и отчёты валидируются (без внешних зависимостей) |
| 14 | **Observability** | `traces/YYYY-MM-DD/agents.jsonl` по `schemas/agent-trace.json` | Хуки `SubagentStart/SubagentStop` → `subagent-trace.sh` (автоматически); агенты дописывают `deliver / audit / council / escalation`; агрегация `trace-summary.py` |
| 15 | **Reflexion** | skill `/reflexion` → `knowledge/reflexion/YYYY-MM.md` | CC-19, ежемесячно: трейсы + эпизоды + агентная память → систематические ошибки → правки skills/agents (после решения Ивана) |

## 6. Protocol 11 - Model Routing

| Класс | Модель | Правило |
|---|---|---|
| Утилитарные (grep, ls, status, rename, простой fetch) | `claude-haiku-4-5` | Default для tech рутины |
| Контент/анализ/код (большинство задач) | `claude-sonnet-4-6` | Default для содержательных задач |
| ФЕНИКС audit, Reality Audit, Council aggregation, Crisis, P15 Reflexion | `claude-opus-4-8` | Reasoning depth обязателен |
| Mass content batch (>10 артикулов) | `claude-sonnet-4-6` + prompt caching | 90% input cost saving |

Если не уверен - sonnet. Эскалируй до opus при первом признаке сложности (multiple constraints, adversarial, financial).

## 8. Output Routing (Protocol 10)

| Запрос | Формат | Skill |
|---|---|---|
| КП дилеру | DOCX | `output-router` → `docx-template` |
| Лендинг | HTML | static site generator |
| Дашборд | React | tech-block |
| Презентация | PPTX | `gengroup-content-factory` |
| Карточка МП | text | `gengroup-content-factory` + humanizer-ru |
| Email | HTML inline | `gengroup-content-factory` |
| Карточка товара genglass.ru | WooCommerce JSON | site MCP |

## 10. Memory Tiering (Protocol 12)

| Слой | Папка | Что класть |
|---|---|---|
| Working | (context) | Текущая задача - НЕ записывать |
| Episodic | `knowledge/episodes/YYYY-MM/` | Решения, диспуты, кейсы, прошлые Council |
| Semantic | `knowledge/semantic/` | Глоссарий v2.1, регламенты, PRL v0-v8, прайс snapshot |
| Procedural | `.claude/skills/` | Skills (как делать) |

Конфликт между слоями → приоритет **Semantic > Procedural > Episodic > Working**.
