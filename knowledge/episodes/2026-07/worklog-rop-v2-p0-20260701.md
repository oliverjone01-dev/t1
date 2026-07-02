# Worklog: РОП-дашборд v2 P0 · Claude Code sam пишет код

**Дата старта:** 2026-07-01
**Решение Ивана:** дев-владелец = Иван (то есть Claude Code пишет код сам), Диму не подключаем к P0, работаем ТОЛЬКО в fork `ozon-dashboard-dima-fork`, Димин `rop-dashboard-v1` не трогать
**Deadline:** 10 календарных дней с day-5 milestone (rough draft на Иван review)
**Consulting:** sales-director skill (методология), boris (Bitrix поля P1), feniks (Step 12.5 на готовый код перед merge)

## Что делаю

Переписываю `analytics-mvp/rop/rop-command.template.html` в 3-экранную архитектуру + Crisis по SPEC.md. Data model (rop.json) остаётся тот же. Backend расширения (fetch-rop.ts) — только P1 (после Boris'а).

## Handoff Диме отменён

Прежний файл `handoff-dima-rop-v2-20260701.md` архивирован как reference. Дима подключается на P1 (когда Boris создаст новые Bitrix-поля) как SME по данным. Основной v2 код пишу я.

## P0 план работы (7.5 инженерных дней = ~10 календарных)

### День 1 (сегодня, ~2 часа): подготовка + Экран 1 Утро rough draft

- [ ] Прочитать боевой `rop-command.template.html` полностью, картировать все существующие блоки
- [ ] Сохранить копию боевого шаблона в `analytics-mvp/rop/rop-command.template.v1.html` (снимок baseline)
- [ ] Начать v2: новый файл + tab-nav архитектура + universal filters
- [ ] Экран 1 Утро: Hero + Zombie block + Speed-to-lead

### День 2: Экран 1 доделка + Экран 2 старт

- [ ] Экран 1 добавить: Top-3 closing today + Watchlist + 3 key stage gauges с drill-down
- [ ] Экран 2 Команда старт: Manager scoreboard ранжированный

### День 3: Экран 2 доделка

- [ ] Sparklines 12 недель (SVG static)
- [ ] Discount heatmap (bar chart)
- [ ] 1-on-1 due list + tier-budget block

### День 4: Экран 3 старт

- [ ] Cohort funnel (переключатель B2B/B2C/Дилер)
- [ ] Loss reason 3D разбивка

### День 5 · MILESTONE

- [ ] Rough draft всех 3 экранов + пустой контейнер Экрана 4
- [ ] Показать Ивану (weekly demo? or ad-hoc)
- [ ] Правки

### День 6: Экран 3 доделка

- [ ] Manager efficiency scatter
- [ ] Forecast waterfall
- [ ] Data quality panel

### День 7: Экран 4 Crisis + Feature flag

- [ ] Экран 4 полная реализация (по mockup)
- [ ] Auto-detect trigger в JS
- [ ] Feature flag `DASHBOARD_V2_ENABLED` в env

### День 8: Testing + polish

- [ ] Cross-browser test (Chrome, Firefox, Safari)
- [ ] Mobile-first responsive breakpoints
- [ ] Проверить что боевой `/rop/` не сломан
- [ ] FZ-152 gate: personal metrics по default скрыты, показываются только если consent=true (feature-flag)

### День 9: FENIX Step 12.5 audit готового кода

- [ ] Запуск feniks subagent на готовый v2 (не только spec, но и код)
- [ ] Target ≥7.5 для GO
- [ ] Rework по gaps (если есть)

### День 10: Финал + merge подготовка

- [ ] Финальный push в fork
- [ ] Cherry-branch от main для добавления в deploy-pages workflow (нужен PR в main как раньше)
- [ ] После deploy — проверка live `/rop-preview/`
- [ ] Merge в main когда всё зелёное

## Правила работы

**MUST:**
- Работать ТОЛЬКО на ветке `ozon-dashboard-dima-fork`
- Data model rop.json НЕ менять (совместимость)
- Личные метрики скрыты пока consent=true feature-flag не активен
- Feature flag rollback path работает от старта

**MUST NOT:**
- Не трогать Димин `rop-dashboard-v1`
- Не мёржить свой fork в main без FENIX Step 12.5 pass
- Не добавлять фичи вне SPEC (scope-creep)
- Не менять backend fetch-rop.ts до P1 (P0 работает на существующей data model)

## Открытые blockers (не блокируют P0 старт)

1. **Roman sanity** на ₽-эффект — Иван отложил на 14 дней. Не блокер для P0
2. **Boris Bitrix Priority-1 поля** — параллельный workstream. Не блокер для P0, блокер для P1
3. **Consent letter** approve — Иван approved, boris legal review pending. Не блокер для P0 (личные метрики скрыты за feature flag)

## Reminders (settings поставлены Иваном)

- **Через 7 дней (2026-07-08):** статус внедрения consent + P0 разработка progress
- **Через 14 дней (2026-07-15):** Roman sanity meeting
- **Через 20 дней (2026-07-21):** FENIX audit готового кода перед раскаткой
- **Через 60 дней (2026-08-30):** замер результата (CR2, zombie ratio, adoption)
- **Ежедневно 8:55 МСК:** утренний status без включения Иваном

## Log

- 2026-07-01 · Иван подтвердил: дев-владелец = Иван (Claude Code), Диму не подключать к P0, Дима владеет только data-model consulting. Начинаю прямо сейчас
