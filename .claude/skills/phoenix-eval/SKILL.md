---
name: phoenix-eval
description: Adversarial audit checklist for FENIX (#35). Use when reviewing any GENGROUP deliverable (Roadmap entry, KP, content piece, strategy doc, landing copy). Runs 25-point check across 5 weighted criteria (Accuracy 25% / Actionability 25% / Insight 20% / Brand Fit 15% / Risk Awareness 15%), produces score 0.0-10.0 and JSON audit report.
---

# Phoenix-Eval - Adversarial Audit Checklist (25 points) · v2.1

## Invocation

Используется агентом ФЕНИКС или вручную через `/feniks <path>`.

## Stage 0: Mechanical gate (ПЕРЕД LLM-аудитом, обязательно)

Машина проверяет форму, LLM проверяет смысл. Запуск скрипта - первое действие любого аудита:

```bash
python3 .claude/skills/phoenix-eval/scripts/mechanical-gate.py <files>
```

Ловит за секунду: em/en dash + minus, латиницу в кириллических словах (класс ошибки: латинские буквы внутри русской фамилии), anti-slop blocklist CLAUDE.md §7, деньги/проценты без меток [ДАННЫЕ]/[ГИПОТЕЗА].

- **GATE FAIL** (hard findings) -> deliverable возвращается автору БЕЗ полного скоринга. Экономия: 30-45 минут LLM-аудита не тратятся на то, что чинится за 2 минуты.
- **GATE PASS** -> LLM-аудит стартует; чекпоинты 1 (метки) и 18 (dash) считаются машинно-подтверждёнными, LLM их только spot-checks.

Урок 2026-07-02: hook поймал 3 реальных em dash, которые два LLM-скана пропустили. А этот скрипт при первом же запуске нашёл 15 en dash в самом phoenix-eval. Форму проверяет машина.

## SLA & Time-budget

| Режим | Состав | Лимит |
|---|---|---|
| Full pass (default) | Stage 0 + Pre-Score + 25 чекпоинтов + doc-type checklist | 30-45 мин |
| Delta-audit (iter-2+) | Stage 0 + полный аудит ИЗМЕНЁННЫХ секций + spot-check 3 случайных неизменённых | 15-20 мин |
| Crisis-mode (Protocol 8 active) | Stage 0 + чекпоинты 1, 2, 3, 6, 9, 21, 22, 25 (8 критичных) | 10 мин |
| Dispute round | один раунд аргументации | 60 мин max |

**Delta-audit правило:** повторные итерации НЕ перечитывают всё (урок 4-iter цикла sales-director: перечитывали corpus 4 раза). Аудитим diff + spot-check. Исключение: финальный iter перед production - всегда full pass. **Изменённые скрипты: always execute + adversarial input, не read-diff** (урок первого delta-прогона 2026-07-02: чтение диффа показало «фикс на месте», и только исполнение с адверсариальным тестом поймало context-window дефект).

## Early-exit rules

- Чекпоинты 1+2+3 (Accuracy core) в сумме 0/6 -> immediate VETO, остальное не скорим
- Pre-Score Block: автор не отвечает на 5/5 вопросов -> immediate VETO
- Stage 0 GATE FAIL -> return без скоринга (не VETO - это форма, не содержание)

## 5 Criteria × weights

| Criterion | Weight | Range |
|---|---|---|
| Accuracy (точность) | 25% | 0.0-10.0 |
| Actionability (исполнимость) | 25% | 0.0-10.0 |
| Insight (глубина) | 20% | 0.0-10.0 |
| Brand Fit (соответствие бренду) | 15% | 0.0-10.0 |
| Risk Awareness (риски) | 15% | 0.0-10.0 |

**Weighted total** = Σ (score × weight)

## Design rationale (почему такая формула)

**Веса 25/25/20/15/15** [ГИПОТЕЗА: унаследованы из v9 backbone, эмпирически не валидированы]. Логика выбора: Accuracy и Actionability по 25% потому что ложь в цифрах и неисполнимость - два способа потерять деньги напрямую; Insight 20% - отличает deliverable от того, что сгенерит default LLM; Brand Fit и Risk по 15% - важны, но чинятся дешевле остальных. Альтернативы, рассмотренные и отклонённые: равные веса 20×5 (теряют сигнал «правда важнее красоты»), 40/30/30 без Brand/Risk (пропустили бы Виктория-класс инциденты и anti-slop). Валидация весов: см. процедуру в Calibration anchors + пункт «Иван cross-check» ниже.

**Почему 5 критериев, не 6:** шестым кандидатом был «Coherence/Связность» из v8 (кросс-документная согласованность). Частично покрыт чекпоинтом 3 (не противоречит knowledge/semantic/). Полное возвращение = 30 чекпоинтов и рост времени аудита на ~20% [ГИПОТЕЗА: пропорция 5 доп. чекпоинтов из 25] - отклонено до появления доказательств, что Accuracy-3 систематически пропускает несогласованность.

**Почему thresholds 6.0/7.5/9.0** [ГИПОТЕЗА: v9 backbone, до валидации]: 6.0 - ниже половины чекпоинтов на «полностью» = доверять нельзя; 7.5 - все критичные оси минимум «частично» = рабочий документ с известными gaps; 9.0 - почти всё «полностью» = publish-ready. Подтверждение практикой пока анекдотическое: 4.50-кейс был реально сломан, 9.125-кейс реально рабочий (см. anchors). Строгая валидация: Иван cross-check.

## 25 Checkpoints

### Accuracy (5 чекпоинтов, по 2 балла)

1. **Каждая цифра имеет тег `[ДАННЫЕ]` или `[ГИПОТЕЗА]`** (без тегов = автоматически 0 по этому пункту)
2. **Источники проверяемы** - путь к выгрузке указан, дата snapshot не старше 90 дней для динамичных данных
3. **Факты не противоречат `knowledge/semantic/`** - глоссарий v2.1, прайс, регламенты
4. **Терминология глоссария соблюдена** - «коллекция» только для авторской концепции; «палитра» для цвета; «линия» для семейства
5. **Названия брендов корректные** - Metal-GM (не GM-METAL); GLASS-MEMORY (через дефис)

### Actionability (5 чекпоинтов, по 2 балла)

6. **Назначен ответственный** - конкретное имя/роль, не «отдел маркетинга»
7. **Дедлайн с буфером** - для задач с разработкой минимум 30% буфер от инженерной оценки
8. **Ресурсы перечислены** - бюджет, команда, технологии, зависимости
9. **Метрика успеха конкретна** - цифра + единица + срок измерения
10. **Чекпоинт промежуточный** - для задач >30 дней есть milestone на 50% срока

### Insight (5 чекпоинтов, по 2 балла)

11. **Нетривиальное наблюдение** - то, что не следует из обзора рынка за 1 час
12. **Второй порядок последствий** - что будет, если получится? Какие новые риски?
13. **Анализ alt альтернатив** - рассмотрены минимум 2 другие опции и почему не они
14. **Подтверждение Anti-Median test** - default LLM/агентство такое не предложит
15. **Cross-domain reference** - есть отсылка к смежной нише/практике с обоснованием переносимости

### Brand Fit (5 чекпоинтов, по 2 балла)

16. **Voice бренда** - соответствует Marco's brand DNA (GENGLASS/VALONTI/GENTERO/Metal-GM/GLASS-MEMORY)
17. **Anti-Slop clean** - ни одного запрещённого выражения из CLAUDE.md §7
18. **Em dash отсутствует** - `-` нигде
19. **Структура соответствует output routing** - формат deliverable по Protocol 10
20. **Tone соответствует ЦА** - premium-but-warm для дизайнеров; B2B-precision для GENTERO

### Risk Awareness (5 чекпоинтов, по 2 балла)

21. **Downside озвучен** - что при -50%, что теряем
22. **P9 hard rules не нарушены** - H1-H10 из protocol-9-runner
23. **Crisis scenarios учтены** - что если триггер Protocol 8?
24. **Зависимости от других задач/команд** - явно перечислены
25. **Reversibility** - можно ли откатить решение? как? за сколько?

## Scoring rules

- Каждый чекпоинт: 0 / 1 / 2 балла
  - 0 = нет
  - 1 = частично
  - 2 = полностью
- Сумма по криту = из 10 (5 чекпоинтов × 2)
- Weighted total = взвешенная сумма

## Verdict thresholds

| Score | Verdict | Action |
|---|---|---|
| ≥9.0 | go | Deliver as-is, log to traces |
| 7.5-8.9 | go | Deliver + note gaps for next iteration |
| 6.0-7.4 | return | Send back with rework_tz, max 3 iterations |
| <6.0 | veto | Escalate to Иван, do not deliver |

**Tie-breaker (score в пределах ±0.15 от порога):** пересчитать 3 самых спорных чекпоинта с явной аргументацией за оба балла. Если score остаётся в зоне - вердикт в пользу более строгого (ниже порога). Прецедент: iter-3 sales-director 9.45 при цели 9.5 - не округлили вверх, отправили на micro-rework. Это правило, не вкус.

**Confidence threshold:** verdict «go» требует confidence ≥0.7. При 0.5-0.7 - downgrade к «return» с пометкой «low-confidence». При <0.5 - эскалация Ивану без вердикта.

**Iteration cap:** максимум 3 итерации return. 4-я итерация не запускается - автоматическая эскалация Ивану с историей всех раундов. Альтернатива до эскалации: dispute round (см. Dispute Template), который может скорректировать score без нового rework (прецедент: консилиум 2026-07-01, 4.50 -> 5.25 за 5 раундов).

## Retract (отзыв ошибочного вердикта)

Если post-deployment факты показывают, что «go» был ошибкой (deliverable провалился в проде):

1. Лог в `knowledge/reflexion/YYYY-MM.md` с тегом RETRACT + разбор какие чекпоинты недооценили риск
2. Notify Иван + автор (без поиска виноватых: инструмент откалиброван неидеально, чиним инструмент)
3. Если один и тот же класс ошибки прошёл через «go» дважды - обязательное обновление соответствующего чекпоинта (Inter-Skill Feedback, Protocol 15)

Симметрично: ошибочный VETO (deliverable был годным) - тот же процесс. Прецедент dispute-механики: VETO 4.50 скорректирован до RETURN 5.25 аргументами, не отменой правил.

## Calibration anchors (реальные проскоренные кейсы)

Вместо абстрактной шкалы - реальные документы этой системы с известными score. Новый аудит сверяется: «этот deliverable ближе к какому anchor?»

| Anchor | Score | Что характерно | Где лежит |
|---|---|---|---|
| sales-director dashboard-работа iter-1 | 4.50 VETO | Цифры без источников, нет метрики успеха, одно-сценарное мышление, self-claimed audit | dispute-log 2026-07-01 |
| та же работа после диспута | 5.25 RETURN | Аргументы закрыли часть gaps без изменения артефакта | тот же лог |
| та же работа iter-2 (rework 10 пунктов) | 9.125 GO | Метки на всех цифрах, 3 альтернативы, downside-планы, crisis-mode, rollback path | SPEC.md v2-mockups |
| sales-director SKILL iter-4 | 9.52 GO | Полный corpus чист, safety-rules, честный ceiling note | .claude/skills/sales-director/ |

Re-calibration: при накоплении 3+ новых кейсов с расхождением «anchor-прогноз vs фактический score» >1.0 балла - пересмотр весов через Иван.

## Требование к автору (симметрия)

Автор обязан прогнать свой Pre-delivery checklist ДО подачи на аудит (пример: sales-director SKILL.md, секция «Pre-delivery checklist», 10 пунктов). Deliverable, поданный без самопроверки и заваливший Stage 0, возвращается с пометкой «checklist не пройден» - это Actionability-сигнал в следующем скоринге автора.

Цель распределения ролей: автор + машина ловят известные классы ошибок, ФЕНИКС ищет только новые.

## Perspective-diverse verify (для критических deliverables)

Для решений >500K ₽, изменений CLAUDE.md, PIP/hire/fire: не один аудит, а 2-3 независимых прохода разными линзами (correctness / risk / business-механика), вердикт по majority. Разные линзы ловят разные классы ошибок лучше, чем два одинаковых прохода. Для рутинных deliverables - обычный один pass, диверсификация не бесплатна.

## Output JSON (по `schemas/audit-report.json`)

```json
{
  "agent": "feniks",
  "skill": "phoenix-eval",
  "task_id": "<uuid>",
  "timestamp": "<ISO>",
  "deliverable_ref": "<path>",
  "checkpoints": {
    "accuracy_1_figures_tagged": 2,
    "accuracy_2_sources_verifiable": 2,
    "accuracy_3_no_conflict_with_rag": 1,
    "accuracy_4_glossary_terminology": 2,
    "accuracy_5_brand_names_correct": 2,
    "actionability_6_owner_assigned": 2,
    "actionability_7_deadline_buffer": 1,
    "actionability_8_resources_listed": 2,
    "actionability_9_metric_concrete": 2,
    "actionability_10_milestone": 1,
    "insight_11_nontrivial": 1,
    "insight_12_second_order": 0,
    "insight_13_alternatives_analyzed": 1,
    "insight_14_anti_median": 1,
    "insight_15_cross_domain": 0,
    "brand_16_voice": 2,
    "brand_17_anti_slop": 2,
    "brand_18_no_em_dash": 2,
    "brand_19_output_routing": 1,
    "brand_20_tone_audience": 2,
    "risk_21_downside": 1,
    "risk_22_p9_hard_rules": 2,
    "risk_23_crisis_scenarios": 0,
    "risk_24_dependencies": 1,
    "risk_25_reversibility": 1
  },
  "scores": {
    "accuracy": 9.0,
    "actionability": 8.0,
    "insight": 3.0,
    "brand_fit": 9.0,
    "risk_awareness": 5.0
  },
  "weighted_total": 7.05,
  "verdict": "return",
  "gaps": [
    "Insight: рассмотрены ли альтернативные стратегии запуска?",
    "Risk: что при -50% от плана?",
    "Insight: есть ли cross-domain reference (вне мебельной ниши)?"
  ],
  "rework_tz": "Добавить 2 альтернативных сценария запуска в раздел 'Альтернативы'. Описать downside scenario в 2 параграфах. Включить 1 пример из смежной premium-ниши (например, audio Bose/Bang & Olufsen) с обоснованием почему применимо.",
  "iteration": 1,
  "confidence": 0.85
}
```

## Industry Benchmarks (для cross-check цифр)

[ГИПОТЕЗА: вся таблица - industry-heuristics из v8-источников без верифицируемых выгрузок. Годится как «флаг для проверки», НЕ годится как основание блокировать/одобрять. Last review: 2026-07-02. Next review: 2026-10-01 (квартально, owner: data). При споре о конкретной цифре - data subagent тянет свежую выгрузку, таблица не аргумент.]

| Канал | ROMI typical | CR funnel | Cycle |
|---|---|---|---|
| Контекст РФ | 3-8x | 1-3% | 1-4 нед |
| Дизайнерский | 15-30x | 8-15% | 2-4 мес |
| Маркетплейсы | 2-6x | 2-5% | 3-14 дн |
| Тендеры B2B | 10-20x | 5-20% | 3-12 мес |
| Реферальная | 5-15x | n/a | varies |
| SEO органический | 8-25x | 2-4% | 1-6 мес |
| Email retention | 20-50x | 5-15% | varies |

Любая заявленная цифра, выходящая за диапазон в 2x от benchmark → флаг для проверки (флаг, не вердикт).

## Checkpoint 2b: tag-truthfulness spot-check (Stage 1)

Чекпоинт 1 проверяет наличие меток, но `[ДАННЫЕ]` на выдуманной цифре проходит и машину, и формальный чек. Поэтому после Stage 0, до полного скоринга:

1. Выбрать 3 случайные метки `[ДАННЫЕ: источник]` из документа
2. Открыть указанный источник (файл/путь/выгрузку) и сверить цифру
3. Любая из трёх не подтвердилась -> Accuracy-1 = 0 автоматически + флаг «false labelling» в отчёте (это хуже отсутствия метки: отсутствие - небрежность, ложная метка - обман инструмента)

Меток меньше трёх - проверяются все. Источник недоступен из окружения (внешняя ссылка) - метка обязана содержать дату и автора выгрузки, иначе считается неподтверждённой.

## Формат отчёта (паттерны из audit/critique skills)

1. **Verdict first.** Первая строка отчёта: score + verdict + одно предложение почему. Иван читает вердикт за 5 секунд, детали по желанию.
2. **Каждый gap с fix-owner.** Не «нет метрики успеха», а «нет метрики успеха -> автор добавляет секцию Metrics of success, шаблон в sales-director SKILL.md». Gap без владельца и следующего шага - это жалоба, не находка.
3. **Positive findings обязательны.** 2-3 пункта что сделано сильно, с конкретикой. Это не комплимент - это калибровка: автор должен знать что сохранять в rework, иначе выкинет вместе с плохим.
4. **Gaps ранжированы по impact на score.** Топ-gap первым, с оценкой «+X балла если закрыть».

## Anti-patterns (что в твоей оценке быть НЕ должно)

- ❌ Score >9.0 без всех 25 чекпоинтов на 2/2
- ❌ Verdict «go» при <7.5
- ❌ «В целом неплохо» - твоя задача найти gaps, а не комплимент
- ❌ Принимать оправдания «не было времени» - это часть actionability score
- ❌ Em dash в твоём отчёте (и прогони свой отчёт через mechanical-gate.py перед отправкой - прецедент: 15 en dash жили в самом phoenix-eval)
- ❌ Полный re-read на iter-2+ вместо delta-audit
- ❌ LLM-скан формы вместо запуска Stage 0 скрипта

## Dispute Template (если автор не согласен)

```markdown
## Dispute - <task name>

### Round 1
**FENIX position:** <тезис>
**Author position:** <ответ>
**FENIX rebuttal:** <данные/логика>
**Author counter:** …

### Round N (max 5)
…

### Final
- **Resolved:** <с кем согласились и почему>
- **OR Escalated to Иван:** <если не сошлись>
```

## Reference

См. `agents-v9/MASTER_SYSTEM_v9.md` Раздел 3.1 - Tier 0 ФЕНИКС.
