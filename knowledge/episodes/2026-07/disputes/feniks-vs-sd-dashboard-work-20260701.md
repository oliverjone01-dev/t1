# Dispute: FENIX vs SALES-DIRECTOR по РОП-дашборд работе

**Date:** 2026-07-01
**Chairman:** SPARTAK (модератор, не принимает сторону)
**Rounds:** 5 (max по dispute template)
**Verdict:** RESOLVED без эскалации Ивану

## Контекст

FENIX iter-1 audit sales-director работы (assessment дашборда 5.5/10 + 3 экрана mockups + рекомендации) выдал VETO 4.50/10. Ключевые gaps:
- Accuracy 5.0/10: цифры без источников, повтор ошибки «7% per hour»
- Actionability 2.0/10: метрика успеха отсутствует, дедлайны без буфера
- Insight 4.0/10: альтернативы не рассмотрены
- Risk 4.0/10: crisis-mode не покрыт, зависимости не названы, P9 violations

## Score progression

| Iter | Weighted | Verdict | Изменение |
|---|---|---|---|
| 1 (baseline) | 4.50 | VETO | Топ-6 gaps выявлены |
| 5-раундовый диспут | 5.25 | RETURN | +0.75 после отработки аргументов |
| Целевой iter-2 | 7.5-8.0 | GO с note | После полного rework |

## Раунды диспута

### Round 1: Accuracy 5.0/10 подтверждена
- SD concede: A1=0 (правило безусловное). Safety-rule на «7% per hour» превентивно
- FENIX rebuttal: «Cassina 60/20» без источника — не Pareto-канон, а конкретная привязка. Rebuttal accepted
- Result: score не меняется

### Round 2: Actionability 2.0 → 3.0
- SD concede: A7 (буфер) и A9 (метрика успеха). Определяет: CR2 target 16%, zombie <15%, adoption 80%+
- FENIX concede: A9 частично (0 → 1)
- SD accept: A10=0 остается
- Result: +0.25 weighted

### Round 3: Insight 4.0 → 5.0
- SD concede: I13. Даёт 3 альтернативы (A minimum / B Metabase / C 3-экрана) с обоснованием выбора C
- FENIX concede: I13 (0 → 1) с note что «proven ROI» без числа
- I15: Roche Bobois «Personal advisor» reference. Не полный балл из-за transferability gap
- Result: +0.20 weighted

### Round 4: Risk 4.0 → 6.0 (самое большое движение)
- SD concede: R22=0 (P9 rules безусловно)
- SD proposes: Crisis-toggle в top-bar, при Protocol 8 сжатие в 1 экран
- SD proposes: 3 downside scenarios (PIP-конвейер, cultural resistance, Дима-race)
- FENIX concede: R23 (0 → 1) crisis-mode plan есть но не implemented в коде mockups
- FENIX concede: R21 (1 → 2) полный downside plan
- Result: +0.30 weighted

### Round 5: Синтез Chairman SPARTAK
- Финальный score: 5.25/10 (VETO 4.50 → RETURN 5.25)
- Verdict change: VETO → RETURN. Не эскалация, прямой rework
- Rework TZ: 10 обязательных пунктов, deadline 24 часа

## Rework TZ финализированный

1. SKILL.md: safety-rule на Lead Response Study attribution
2. Assessment: 5.5/10 → «5.5/10 [ГИПОТЕЗА: subjective]»
3. Assessment: estimate работ помечены [ГИПОТЕЗА]
4. Spec v2: секция «Metrics of success» с 4 числами
5. Spec v2: секция «Альтернативы» A/B/C
6. Spec v2: секция «Downside scenarios» с 3 планами Б
7. Mockups: 4-й экран «Crisis-view» + toggle
8. Dependencies: Дима-sync через runbook как prerequisite
9. Дедлайны: буфер 30% на всех оценках
10. Feniks Step 12.5 на готовый код перед merge

## Inter-Skill Feedback Loop status

**Lead Response Study incident tracking:**
- 2026-06-30 iter-1 audit sales-director skill: найдено, исправлено в iter-2
- 2026-07-01 sales-director dashboard work: найдено снова, safety-rule превентивно
- Total: 2/3 инцидента. При третьем — Protocol 15 автоматически инициирует полный пересмотр sales-director методологии

**Safety-rule text (добавлен в SKILL.md → Voice rules):**
> НИКОГДА не цитирую Lead Response Management Study без явной атрибуции. Формулировка обязательная: [ДАННЫЕ: Oldroyd 2007, InsideSales.com replication 2011-2016] вероятность qualified-контакта падает на порядок между 5-10 минутами и >1 часа. НЕ «7% per hour».

## Sign-off

**SALES-DIRECTOR:** Принято. Три пункта конкретно моей ответственности зафиксированы (safety-rule, metrics of success, 3-опции подход). Reject VETO, принимаю RETURN.

**FENIX:** Concede RETURN 5.25. Не подсиживаю iter-1 VETO — это был правильный вердикт на первую итерацию без диспута. После диспута данные обновились, вердикт обновился. Дисциплина, не капитуляция. Следующий audit только после iter-2 rework.

**SPARTAK:** Consilium resolved за 5 раундов, без эскалации Ивану. Owner rework_tz: sales-director. Reviewer iter-2: FENIX через полный phoenix-eval. Log: этот файл. Impact: safety-rule превентивно активирована.

## Next steps

- Iter-2 rework (10 пунктов, deadline 24 часа) — стартует сразу после Иван approval на dispute-resolution
- FENIX iter-2 audit после rework
- Target score: 7.5-8.0 (GO с note gaps)
- Если 7.5 не достигнут — новый диспут либо эскалация Ивану

## Meta-learning

**Что мы узнали для будущих циклов:**
1. FENIX iter-1 audit sales-director работы (в отличие от skill'а) должен применять контекстное разграничение: pre-planning estimate ≠ commitment. Skill-audit жёстче чем work-audit
2. Dispute template формально работает: 5 раундов дают +0.75 score без потери качества критики
3. Safety-rules превентивные эффективнее post-factum правок: 2 инцидента одной ошибки за 2 дня достаточно чтобы поставить hard rule
4. Metric of success — базис любого sales-management deliverable. Пропуск = автомат RETURN
