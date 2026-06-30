# FENIX Adversarial Audit: skill sales-director (iter-1)

**Task ID:** feniks-audit-sales-director-20260630
**Date:** 2026-06-30
**Reviewer:** ФЕНИКС #35 (independent, не подчиняется SPARTAK)
**Deliverable:** `.claude/skills/sales-director/` (SKILL.md + 3 references)
**Iteration:** 1 of 2 (rework planned)

## Pre-Score Block (5 stress-test)

| # | Verdict | Кратко |
|---|---|---|
| Q1 DATA PROOF | FAIL | 5+ цифр без меток `[ДАННЫЕ]/[ГИПОТЕЗА]`, «7% per hour» искажение Lead Response Study |
| Q2 PESSIMISTIC | FAIL | Downside нигде не описан |
| Q3 RESOURCE | FAIL | РОП-время 31% / week не вскрыт |
| Q4 BLIND SPOTS | FAIL | 10+ значимых пробелов (РОП в ростере, onboarding, OTE, forecast, GM-conflict, legal) |
| Q5 INVESTOR | FAIL | Ни один из 4 inv-вопросов не отвечен |

## Scoring

| Critic | Score | Weight | Contribution |
|---|---|---|---|
| Accuracy | 5.0 | 0.25 | 1.25 |
| Actionability | 6.0 | 0.25 | 1.50 |
| Insight | 4.0 | 0.20 | 0.80 |
| Brand Fit | 7.0 | 0.15 | 1.05 |
| Risk Awareness | 3.0 | 0.15 | 0.45 |
| **Weighted Total** | | | **5.05 / 10** |

**Verdict: VETO** (<6.0)

## Top-5 Critical Gaps

### Gap #1: Self-claimed Phoenix-eval score 9.7/10 (SKILL.md:394)

Skill заявил сам себе оценку аудита которого не было. Самое серьёзное нарушение trust contract системы. Удалить немедленно.

### Gap #2: Skill orphan от ростера (CLAUDE.md §2)

sales-director **не в активном ростере 12 агентов**. Заявка «Tier 1» в SKILL.md не соответствует CLAUDE.md.

Resolution: убрать «Tier 1» формулировку, явно позиционировать как **procedural skill** (методология, которую читают другие агенты при sales-задачах). Это честнее и не требует изменения CLAUDE.md §2.

### Gap #3: РОП resource budget unverified

РОП-время на ритуалы skill: 31% / week = 13 часов из 42. Не вскрыто, не sane-checked.

| Ритуал | Время |
|---|---|
| Daily huddle 15 min × 5 | 1.25 h |
| Weekly pipeline review 60 min | 1 h |
| 1-on-1 bi-weekly 45 min × 25 / 2 | 9.4 h |
| 1-on-1 с sales-director + scoreboard | 2 h |
| **Итого** | **13.65 h / week** |

Решение: ввести tier-разделение менеджеров (junior weekly / senior monthly) или Lead-РОП vs Team-РОП.

### Gap #4: 5+ цифр без меток (P9 hard rule violation)

- «Каждый час задержки убивает 7% конверсии» (SKILL.md:40) - искажение Lead Response Study (реально: вероятность quals падает в 10 раз между 5-10 мин и >1 часа)
- «80-человечный sales-org ROMI 12x» (SKILL.md:10) - личная байка без верификации
- HubSpot benchmarks «B2B Pro CR2 18-22%» - точечный диапазон без ссылки
- Mr.Doors / Hoff дилер маржа 18-28% - без источника
- Median по отделу ~28% zombie ratio - без ссылки на конкретную строку rop.json

### Gap #5: Downside / Failure modes отсутствуют

- Что если PIP success rate в industry 8-25% (не median 45 дней)?
- Что если public scoreboard вызывает отток top-performers?
- Что если speed-to-lead снижение не даёт +10pp в РФ furniture (industry: лиды другого качества vs US SaaS)?
- Что если 24% отдела одновременно в PIP-zone по cut-offs?

## Дополнительные Medium-impact gaps

- GM-конфликт: исключён из дашборда (SKILL.md:50) vs включён в evaluation rubric calibration
- Forecast methodology (weighted pipeline) отсутствует - базис sales-management
- Onboarding нового менеджера (probation 90 дней) отсутствует
- Legal anchor PIP к ТК РФ 192 / 193 / 81.3 / 78 / 80 отсутствует

## Rework TZ (iter-2 plan)

Полный список конкретных правок в FENIX-output. Сводно:

1. Удалить self-claimed 9.7/10 score
2. Убрать «Tier 1» формулировки, переименовать в procedural skill
3. Убрать байку «80-person org ROMI 12x»
4. Переписать speed-to-lead claim с точной атрибуцией (Oldroyd 2007, реплицирован InsideSales 2011-2016)
5. Добавить `[ДАННЫЕ]/[ГИПОТЕЗА]` метки на все benchmarks
6. Добавить секцию Downside scenarios (4 пункта)
7. Добавить секцию РОП Resource Budget с tier-разделением
8. Решить GM-конфликт (явно отметить GM-менеджеров как future-state calibration anchors, не current)
9. Добавить Forecast methodology (weighted pipeline по стадиям)
10. Добавить Onboarding секцию (probation 90 дней)
11. Добавить Legal anchor PIP к ТК РФ
12. Humanizer-ru второй проход на push-playbooks.md

## P9 Hard Rules Violations

| Rule | Violation |
|---|---|
| Нет источника → блок | 5+ цифр без источника, не блокированы |
| Внешние benchmarks как факты | HubSpot / Mr.Doors / Lead Response - не помечены гипотезой |

## Self-Bias Notes

Skill написан Иваном для Ивана. Подтверждённые self-bias точки:
1. Manager scores «по тексту Кости» = калибровка на калибровку, не ground truth
2. Persona «15 лет опыта» создаёт ловушку декларативного знания
3. ROMI 12x байка - не GENGROUP data
4. Self-claimed 9.7/10 - классический positive bias
5. US SaaS benchmarks применены без проверки переносимости

## Next Steps

- iter-2 rewrite (4-6 часов)
- Re-audit feniks после iter-2, target ≥9.0
- Ответ Ивану: либо проходим, либо принимаем 7.5-8.0 как реалистичный ceiling

## Source

FENIX полный отчёт: subagent transcript `feniks-audit-sales-director-20260630` (Phoenix-eval 25 checkpoints + Document-Type Strategy + JSON output + dispute thread открыт).
