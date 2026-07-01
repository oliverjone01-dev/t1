# Handoff Диме · РОП-дашборд v2 P0

**Дата:** 2026-07-01
**От:** Иван (goal set) + sales-director skill (spec-owner)
**Кому:** Дима (dev-owner P0+P1 РОП-дашборда v2)
**Consulting:** sales-director skill (по вопросам методологии)
**Timeline:** ~10 календарных дней P0 + 4 календарных P1 = ~14 дней total

## Что делаем

Переписываем `analytics-mvp/rop/rop-command.template.html` (боевой у тебя, эталон) в новую версию v2. Три экрана + Crisis-toggle. Ветка для работы: `ozon-dashboard-dima-fork` (fork от твоего `rop-dashboard-v1`, отрезан на коммите 861f5ca, deploy в `/rop-preview/`).

**Твой `/rop/` остаётся боевым все 14 дней. Новый v2 живёт параллельно в `/rop-preview/`.** При зелёном FENIX-audit финального кода — merge / cherry-pick на выбор.

## Что уже готово (не переделывать)

### Макет (visual reference)

Открыть в браузере через htmlpreview:

- **Обзор:** https://htmlpreview.github.io/?https://raw.githubusercontent.com/oliverjone01-dev/t1/ozon-dashboard-dima-fork/analytics-mvp/rop/v2-mockups/index.html
- **Экран 1 «Утро»:** screen-1-morning.html
- **Экран 2 «Команда»:** screen-2-team.html
- **Экран 3 «Стратегия»:** screen-3-strategy.html
- **Экран 4 «Crisis»:** screen-4-crisis.html
- **CSS:** common.css (наследует дизайн-язык твоего боевого шаблона)

Все mockups в папке `analytics-mvp/rop/v2-mockups/`. Fake data привязана к реальному GENGROUP-контексту.

### SPEC (что делать, чем меряется)

Полный TZ: `analytics-mvp/rop/v2-mockups/SPEC.md`. Обязательно прочитай прежде чем брать в работу. Ключевые секции:

- §1 Metrics of success (что считаем «победой»)
- §2 Альтернативы A/B/C (мы выбрали C — 3 экрана на твоём стеке)
- §3 Downside scenarios (что если пойдёт не так)
- §5 Timeline с буфером 30% (10 дней P0 + milestone на день 5)
- §7 Rollback path (feature flag `DASHBOARD_V2_ENABLED`)

### FENIX audit iter-2 SPEC

Score 9.125/10 GO. Отчёт: `knowledge/episodes/2026-07/disputes/feniks-vs-sd-dashboard-work-20260701.md`. Читай для контекста, куда мы двигаемся.

## Что нужно от тебя перед стартом (30 минут суммарно)

1. **Sync с моей fork-веткой** через runbook `knowledge/episodes/2026-06/sync-from-dima-runbook.md`. Правила разрешения конфликтов: наши файлы (`.claude/skills/sales-director/**`, `Kostya-analitycs-2026/**`, `knowledge/episodes/**`, `analytics-mvp/rop/v2-mockups/**`) = наши. Твои файлы (`analytics-mvp/rop/data/**`, `analytics-mvp/rop/rop-command.template.html`, `analytics-mvp/src/scripts/b24/**`) = твои. Пересечений быть не должно, но проверь.

2. **Прочитай SPEC.md полностью.** 45 минут макс, но обязательно. Не начинай код без этого.

3. **Согласуй Timeline** — если 10 дней нереально или нужен другой milestone-план, скажи Ивану **до старта**. Не в день 7.

## P0 план работы (7.5 инженерных дней, ~10 календарных)

Порядок из SPEC.md §5:

| День | Задача |
|---|---|
| 0.5 | Sync с fork + прочтение SPEC |
| 1-3 | Экран 1 «Утро»: Hero + Zombie block + Speed-to-lead + Top-3 + Watchlist + 3 gauges с drill-down |
| 4-5 | Экран 2 «Команда»: Manager scoreboard ранжированный + sparklines 12 недель + discount heatmap + 1-on-1 due + tier-budget |
| **5** | **Milestone: rough draft (первые 2 экрана готовы, 3 и 4 болванками). Иван review.** |
| 6-7 | Экран 3 «Стратегия»: cohort funnel + loss reason deep-dive + efficiency scatter + forecast waterfall + data quality panel |
| 7.5 | Экран 4 «Crisis-view»: buy-time сделки + helpers + escalation |
| 8 | Nav + tab switcher + universal filters + feature-flag rollback (см. SPEC §7) |
| 9-10 | Testing + Иван review + правки + FENIX Step 12.5 audit готового кода |

## P1 план (4 календарных дня, после boris готовит новые Bitrix-поля)

Не блокирует P0 — параллельный workstream Boris'а. Когда поля готовы:

- Forecast weighted (нужно поле «Дата решения клиента»)
- Speed-to-lead из `crm.activity.list` (нужны batch + incremental для rate limits)
- Discount heatmap (нужен price_listed из snapshot прайса каждого бренда)

## Что НЕ надо делать (защита от scope creep)

- Не добавлять фичи которых нет в SPEC (mobile-view, gamification badges, mood-метрика — отложены до v3)
- Не менять data model rop.json (backend совместимость важна)
- Не делать FZ-152 согласия сам — это отдельный workstream trener + boris
- Не мёржить свой rop-dashboard-v1 в наш fork без sync-runbook

## Что делать при непонятках

- **По методологии** (что за метрика, почему такой cut-off, что показать РОПу): sales-director skill через ping в чат либо через Agent tool
- **По CRM полям** (какое UF_CRM_*, как fetch расширить): boris subagent либо смотри `.claude/skills/sales-director/references/bitrix24-field-map.md`
- **По финансам** (сколько это стоит, ROI): roman subagent
- **По кризисам / архитектуре** (Иван решение нужно): эскалация Ивану напрямую

## FENIX Step 12.5 на финале

**Обязательно перед merge в main.** Запускается на готовый КОД (rop-command.template.html + build-rop.ts), не только SPEC. Target ≥7.5 для GO. <6.0 = VETO, эскалация Ивану.

Логирование в `knowledge/episodes/2026-07/feniks-audit-rop-v2-code-<date>.md`.

## Rollback if things go south (см. SPEC §7)

Feature flag `DASHBOARD_V2_ENABLED` в CI env variable. Toggle через workflow_dispatch без изменения кода. Rollback <10 минут. Git-tag fallback: `rop-v1-frozen` создать перед merge v2 в main.

**Что запрещено:** rollback без Иван notification, rollback одним менеджером без РОП + sales-director sign-off.

## Открытые вопросы Ивану (не блокируют старт)

1. **FZ-152 workstream** — trener готовит consent-письмо, boris делает legal review. Параллельно, не блокирует P0. Финализация до раскатки P1
2. **Roman sanity** на preliminary ₽-эффект metrics (см. SPEC.md §1) — Ивану согласовать до окончания P0 либо на day-5 milestone
3. **Weekly demo Ивану** — расписание фиксировать (пятница 16:00?)

## Log

- 2026-07-01 · handoff создан, ветка `ozon-dashboard-dima-fork` актуализирована
- Waiting for: Диму confirmation что взял в работу + sync с fork
