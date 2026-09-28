# Ростер агентов

> Полная таблица ростера, неактивные агенты, устройство ростера v3. Перенесено из CLAUDE.md §2 дословно, кроме ссылок на удалённые скиллы. Нумерация разделов сохранена как в CLAUDE.md v9.1.

## 2. Активный ростер (13 агентов)

Используй subagent через Agent tool, имя в `subagent_type`. Полные роли - `.claude/agents/*.md`.

| Tier | Агент | Когда вызывать |
|---|---|---|
| 0 | **feniks** | ПЕРЕД любым DELIVER >500K₽, перед публикацией, при оценке Roadmap. Право вето <6/10 |
| Chairman | **spartak** | Multi-agent оркестрация (Council). Один task → много агентов |
| 1 | **marco** | Контент-стратегия, лендинги, питчи, бренд-tone |
| 1 | **data** | Цифры, источники, выгрузки. Spamит вопросом «откуда цифра» |
| 2 | **viktor** | Скрипты продаж, речевые модули, отработка возражений |
| 2 | **boris** | CRM/1С/Bitrix24, миграции, A2A-формат |
| 2 | **emma** | Packaging, объяснение «зачем», voice & tone адаптация |
| 3 | **maks** | Copy long-form, статьи, humanizer-ru |
| 3 | **semyon** | SEO/AEO/GEO, AI Citation, аудит сайта (browser-use) |
| 3 | **timur** | Performance/PPC: Яндекс.Директ (owner скилла `direct`), отчёты и сверка Директ vs Метрика vs CRM, аудит кабинета. Мутации кабинета - технический HITL-гейт (approval + P0-флаг). Активирован Иваном 2026-07-08 (ФЕНИКС go 8.5) |
| 3 | **krea** | Creative direction, эстетика, anti-median |
| 4 | **roman** | CFO, unit-эк, crisis response, ROMI sanity check |
| 4 | **trener** | L&D, ADDIE, тренинги менеджеров |

**Inactive** (в `.claude/agents/archive/v8/`): остальные 24 из v8. Активация - через `/agent activate <name>` с обоснованием через Protocol 9.

**Ростер v3 (сентябрь 2026).** Каждый агент несёт `Operating Contract v3` (lens, A2A intents входа/выхода, evidence, stop conditions, handoff, бюджет, память) и preload'ит skill `roster-protocol` (жизненный цикл вызова, структура ответа VERDICT / EVIDENCE / BLOCKING_ISSUES / HANDOFF, self-check из 7 пунктов, деградированные режимы). Portable role-карты всех 13 ролей для Cowork и HATS-режима: `.claude/skills/council/references/roster-cards.md` (обновлять вместе с агентом). СПАРТАК имеет Agent tool и 6 режимов оркестрации (SOLO / COUNCIL / DEBATE / RED_TEAM / WORKFLOW / HATS); ФЕНИКС - классификацию артефакта, red-team пробы, калибровочные якоря, evidence ledger и хук, запрещающий ему писать продукт. Дизайн-решения: `knowledge/episodes/2026-09/roster-v3-upgrade-20260906.md`.
