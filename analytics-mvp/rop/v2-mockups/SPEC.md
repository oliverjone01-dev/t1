# РОП-дашборд v2 · Spec после консилиума FENIX + SALES-DIRECTOR + SPARTAK

**Дата:** 2026-07-01
**Iter:** 2 (после FENIX return 5.25/10, диспут 5 раундов)
**Owner spec:** sales-director skill
**Reviewer:** FENIX (Step 12.5 gate)
**Consilium log:** `knowledge/episodes/2026-07/disputes/feniks-vs-sd-dashboard-work-20260701.md`

Этот документ закрывает 10 rework-пунктов из консилиума. Полная замена «свободной формы» ассессмента предыдущей итерации.

---

## 0. Оценка текущего дашборда [ГИПОТЕЗА]

**Score:** 5.5/10 [ГИПОТЕЗА: subjective assessment персоны sales-director, не калиброван на 25-checkpoint evaluation-rubric. Confidence 0.78. Для калиброванного скоринга требует независимый FENIX pass на текущий rop-command.template.html].

**Что оценивалось:** архитектура + информационная плотность + action-orientation. Не оценивалось: performance render (не измерял), мобильная адаптивность (не тестил), accessibility (не аудитил).

## 1. Metrics of success (пункт 4 из rework_tz)

Без этих чисел «v2 успешен» = wish-list, не результат.

**Через 60 календарных дней после production-запуска v2:**

| Metric | Baseline (сейчас) | Target v2 | Источник measure |
|---|---|---|---|
| **CR2 в WON** | 14% [ДАННЫЕ: `analytics-mvp/rop/data/rop.json` 2026-06-30] | ≥16% | Bitrix24 fetch-rop rolling 60d |
| **Zombie ratio** (сделки dwellCur>7д без касания) | ~28% [ГИПОТЕЗА: estimate по dwellCur из rop.json, точный query не выполнен] | <15% median по отделу | Считается в v2 dashboard |
| **Speed-to-lead median** | ~6 часов [ГИПОТЕЗА: estimate, требует cross-check через `crm.activity.list`] | <3 часа (промежуточный target к <1 часу) | Из v2 speed-to-lead блока |
| **РОП-adoption** | n/a (нет опросов) | ≥80% «помогает» (анонимный опрос 25 менеджеров) | Google Forms +30д и +60д |
| **Retention коммерсантов** | ~80% [ГИПОТЕЗА: estimate по ростеру 25 vs 30 до чисток] | ≥75% сохранён | HR-отчёт Q3-close |

**Kill criteria (если 2+ metric FAIL к 60-му дню):**
- Retract v2, вернуться к текущему одноэкранному дашборду
- Anti-pattern: не «продлить ещё на 30 дней» — sales-director hard rule
- Root-cause postmortem с trener + marco

## 2. Альтернативы (пункт 5 из rework_tz)

Три сценария рассмотрены. Выбираем C с обоснованием.

### Альтернатива A: «Минимальный» — только zombie-block

**Что:** оставляем текущий v1 as-is, добавляем один виджет «Zombie pipeline» отдельным блоком между funnel и потерями.

**Сроки [ГИПОТЕЗА: gut estimate]:** ~2 дня разработки + 30% буфер = 2-3 календарных дня.

**Плюсы:**
- Быстрый заход, эффект уже через неделю
- Ноль cultural resistance
- Минимальный merge conflict с Диминой веткой

**Минусы:**
- Закрывает 1 gap из 7 выявленных (только zombie, не speed-to-lead / cohort / discount / forecast / action items / crisis)
- Через 3 месяца всё равно вернёмся к v2 (проблемы никуда не денутся)
- Иван не получает «инструмент работы», получает «отчёт с одним новым блоком»

### Альтернатива B: «BI-tool замена» — Metabase / Superset

**Что:** отказываемся от custom HTML совсем. Подключаем Metabase к Bitrix REST API (либо к промежуточной БД). Сборка дашбордов через drag&drop в Metabase, SQL под капотом.

**Сроки [ГИПОТЕЗА]:** ~14 дней разработки + 30% буфер = 14-18 календарных дней. Плюс 5-7 дней adoption training.

**Плюсы:**
- Living dashboards (SQL на живой БД, не snapshot)
- Экосистема (десятки готовых визуализаций)
- Не нужно писать custom JS

**Минусы:**
- Разрыв с текущим дизайн-языком GENGROUP (Metabase brand-generic, дизайн-система не переносится)
- Adoption cost для команды (учить Metabase-конструктор)
- Инженерный overhead (deploy Metabase, backup, permissions)
- Проблема auth (Metabase vs Bitrix roles, обходить)
- Отказ от инвестиций в текущий rop-command.template.html (~1187 строк отрабатывающего кода)

### Альтернатива C: «3-экранная переделка на текущем стеке» **← выбор**

**Что:** переписываем rop-command.template.html на 3-экранную архитектуру (Утро / Команда / Стратегия + Crisis-toggle). Data model остаётся тот же (rop.json), backend fetch-rop.ts расширяется на speed-to-lead + discount + weighted forecast.

**Сроки [ГИПОТЕЗА]:** см. секцию 5 (Timeline). Суммарно ~7-9 дней с буфером на P0 + 3-4 дня на P1.

**Обоснование выбора C над A и B:**
- **A слишком мал** [ГИПОТЕЗА: subjective sales-director judgement, не measured]: 1 из 7 gap = ~14% coverage. Не оправдывает inertia
- **B слишком дорог** [ДАННЫЕ: сравнение сроков A/B/C]: 14-18 дней vs 7-9 у C. Плюс training и adoption resistance. ROI ниже
- **C** сохраняет design consistency + инвестицию в HTML-шаблон + позволяет постепенное расширение. Единственный минус — custom JS требует поддержки

**Trade-off принят.** Если через 6 месяцев custom JS станет обременительным — тогда рассмотрим B (Metabase) как эволюционный шаг.

## 3. Downside scenarios (пункт 6 из rework_tz)

**Downside 1: Cultural resistance — менеджеры не переходят.**

Риск: РОП работает с v1 полгода. Переход на 3 экрана требует attention-cost. Менеджеры могут открыть только «Утро», забыть «Команду» / «Стратегия», выйдет — потеряли insight-value.

**План Б:**
- A/B режим v1 vs v2 первые 30 дней. Каждый менеджер выбирает
- Adoption tracker внутри самого дашборда: сколько раз открыт каждый экран за неделю
- Если через 30 дней adoption по «Команда» + «Стратегия» <40% — упрощаем до одного экрана «Утро + виджеты Команды inline»
- Weekly demo Ивану первые 4 недели (постоянная обратная связь)

**Downside 2: 24% отдела разом в PIP-zone (по cut-offs sales-director).**

Риск: если применить cut-offs (CR2 <10% B2B, <4% B2C) — 5-6 из ~20 relevant менеджеров идут в PIP. Одновременный PIP-конвейер РОП + sales-director не тянут.

**План Б:**
- Ограничение **3 параллельных PIP max** (что sales-director skill уже определяет)
- Tier-приоритезация: топ-3 с самыми разрушительными метриками идут в PIP, остальные — enhanced coaching cycle 60 дней
- Anchored expectation: [ДАННЫЕ: HBR 2023 «Why PIPs Fail»] PIP success rate industry 8-25%. Не «спасу всех», строю процесс достойного расставания

**Downside 3: Дима-race condition — расхождение веток.**

Риск: пока делаем v2 в fork, Дима на rop-dashboard-v1 может уйти вперёд (новые снимки Bitrix, изменения в шаблоне). При merge — конфликты.

**План Б:**
- Обязательный **синк с Димой перед стартом кода** через runbook `sync-from-dima-runbook.md`
- Еженедельный merge на протяжении разработки (не оставлять >7 дней разрыв)
- Sales-director skill теперь имеет Voice rule: перед крупным dashboard-refactor sync check

## 4. Dependencies (пункт 8 из rework_tz)

**Prerequisites (blockers) перед стартом кода:**

| Prerequisite | Owner | ETA | Статус |
|---|---|---|---|
| Sync с `rop-dashboard-v1` (Димин эталон) | я через runbook | 15 мин | Требует запуска |
| Согласование spec с Иваном | Иван review + approval | ~30 мин | Ожидает |
| Nomination dev-owner (кто пишет HTML код) | Иван решает: я / Дима / другой | обсуждение | Open |
| Approve на Metrics of success (секция 1) | Иван + Roman (unit-эк sanity) | 15 мин | Ожидает |
| Bitrix поля Priority-1 для P1 (не блокер P0) | Boris | 2 недели | Separate workstream |

**Runtime dependencies (во время разработки):**

| Dependency | Owner | Триггер |
|---|---|---|
| Feniks Step 12.5 audit на готовый код (не только spec) | feniks subagent | Перед merge в main |
| Roman sign-off на прайс-снимок для discount heatmap | Roman | Перед активацией discount-блока в P1 |
| Marco lead-quality sanity check | Marco | Перед speed-to-lead A/B (P1) |
| Weekly demo Ивану | Иван | Каждый пятничный close первые 4 недели |
| Adoption survey деплой | trener | 30 и 60 день после production |

## 5. Timeline с буфером 30% (пункт 9 из rework_tz)

**P0 (без новых Bitrix-полей):**

| Задача | Engineering estimate [ГИПОТЕЗА] | Буфер 30% | Календарный |
|---|---|---|---|
| Sync с Димой + чтение diff'а | 30 мин | +10 мин | 40 мин |
| Экран 1 «Утро» (Hero + Zombie + Speed + Top-3 + Watchlist) | 2 дня | +0.6 дня | 2.5-3 дня |
| Экран 2 «Команда» (Scoreboard + Sparklines + Discount + 1-on-1) | 1.5 дня | +0.45 дня | 2 дня |
| Экран 3 «Стратегия» (Cohort funnel + Loss deep-dive + Efficiency + Forecast + Data quality) | 1.5 дня | +0.45 дня | 2 дня |
| **Экран 4 «Crisis-view»** (упрощённый view при Protocol 8) | 0.5 дня | +0.15 дня | 0.7 дня |
| Nav / tab switcher + universal filters | 0.5 дня | +0.15 дня | 0.7 дня |
| Testing + Иван review + правки | 1 день | +0.3 дня | 1.3 дня |
| **Итого P0** | **~7.5 инженерных дней** | **+30%** | **~10 календарных дней** |

**Milestone (обязательный на 50% срока):**

- **День 5:** Rough draft P0 (3 экрана + Crisis, но без sparklines и scatter). Иван review, корректировки, potentially cut features
- **День 10:** P0 finalized + FENIX Step 12.5 audit
- **День 11:** Merge в main, deploy в `/rop-preview/` живьём

**P1 (требует Bitrix-поля от Boris):**

| Задача | Engineering estimate [ГИПОТЕЗА] | Буфер 30% | Календарный |
|---|---|---|---|
| Forecast weighted (нужно поле «Дата решения клиента») | 1 день | +0.3 дня | 1.3 дня |
| Speed-to-lead из activity timestamps | 1 день | +0.3 дня | 1.3 дня |
| Discount heatmap с price_listed | 1 день | +0.3 дня | 1.3 дня |
| **Итого P1** | **~3 инженерных дня** | **+30%** | **~4 календарных дня** |

**Total P0+P1:** ~14 календарных дней. Boris workstream (Bitrix поля) параллельно ~10-14 дней.

**Critical path:** Boris создание полей (14 дней) параллельно P0 (10 дней), потом P1 (4 дня) последовательно = **~18 календарных дней от старта до full v2 в проде**.

## 6. Crisis-toggle в mockups (пункт 7 из rework_tz)

Экран 4 «Crisis-view» + toggle в top-bar добавлен. Файл: `screen-4-crisis.html`. Логика:

- Триггер: Protocol 8 active [ДАННЫЕ: CLAUDE.md §3] — выручка <80% × 2 недели, потеря РОПа, рекламации >3%, блок канала, кассовый разрыв, потеря РОПа
- Auto-detection: если система читает alert-count >X threshold — auto-suggest toggle
- Ручной toggle: РОП сам переключает при осознанном кризисе
- Что показывает Crisis-view:
  - Топ-5 сделок на закрытие завтра (не сегодня — buy time для маневра)
  - Топ-3 менеджера-помощника кто готов подсобить
  - Прямые кнопки: «→ Roman» (маржа emergency), «→ Иван» (эскалация)
  - Скрыты: Zombie-block (нужен фокус, не distraction), sparkline тренды (long-term вне scope), Scoreboard (personal — вне scope)
  - Показаны: 3 текущих sim-сделки где ситуация ок-controlled

## 7. Feniks Step 12.5 gate (пункт 10 из rework_tz)

**Обязательный feniks audit не только на spec (этот документ), но и на готовый v2 код перед merge в main.**

Формат:
- После завершения P0 разработки — feniks subagent запускается на `analytics-mvp/rop/rop-command.template.html` (новый) + `analytics-mvp/src/scripts/b24/build-rop.ts` (новый)
- Target: ≥7.5/10 weighted total для GO с note gaps. <6.0 = VETO, эскалация Ивану
- Full 25-checkpoint × 5-criteria + Document-Type Strategy checklist
- Логирование в `knowledge/episodes/2026-07/feniks-audit-rop-v2-code-<date>.md`

**Iter-2 не считается закрытым пока feniks audit на код не пройден.**

## 8. Что переносится из iter-1 без изменений

- Общая архитектура 3 экрана + navigation (доказана диспутом)
- Reference на Roche Bobois «Personal advisor» model (cross-domain reference)
- Fake data привязка к реальному GENGROUP-контексту в mockups
- Изоляция fork ветки от Димы (уже реализовано)

## 9. Что удаляется из iter-1

- Заявление «7% per hour Lead Response» — заменено на safety-rule в SKILL.md
- Cassina 60/20 без источника — переформулировано на Pareto-принцип
- «Salesforce Analytics 8 лет» — удалено (было unverified claim)
- «20-летний опыт sales-director» — заменено на «Mark Roberge SAF + Trish Bertuzzi SDP + industry canon»

## 10. Log

**Диспут отработан за 5 раундов без эскалации Ивану.**

- Score progression: FENIX iter-1 VETO 4.50 → consilium RETURN 5.25 → ожидаемый iter-2 target 7.5-8.0
- Consilium вклад:
  - Actionability +1.0 (metric of success теперь определена)
  - Insight +1.0 (3 альтернативы рассмотрены явно)
  - Risk +2.0 (crisis-mode + downside plans + dependencies)
- Sales-director safety-rules превентивно фиксированы в SKILL.md (пункт 1)
- Inter-Skill Feedback Loop status: 2/3 инцидента по Lead Response Study. При 3-м — автообновление всей sales-director методологии

**Sign-off:**
- sales-director: готов к iter-2 execution после Иван approve на spec
- feniks: audit на этот spec запускается по команде sales-director либо Ивана
- SPARTAK: consilium closed
