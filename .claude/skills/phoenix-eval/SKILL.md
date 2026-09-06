---
name: phoenix-eval
description: Adversarial audit checklist for FENIX (#35). Use when reviewing any GENGROUP deliverable (Roadmap entry, KP, content piece, strategy doc, landing copy). Runs a mandatory Comprehension Gate (человекочитаемость - текст понятен неспециалисту за 1 секунду, жаргон переведён) plus a 25-point check across 5 weighted criteria (Accuracy 25% / Actionability 25% / Insight 20% / Brand Fit 15% / Risk Awareness 15%), anchors the score to real 2026 calibration cases (references/calibration-anchors.md), runs red-team probes by artifact class (references/red-team-probes.md), requires an evidence ledger per gap and validates the JSON report with schemas/validate.py. Produces score 0.0-10.0 and JSON audit report.
---

# Phoenix-Eval - Adversarial Audit Checklist (25 points)

## Invocation

Используется агентом ФЕНИКС (`.claude/agents/feniks.md`, preload) или через skill `/feniks <path>`; в Workflow -
`agentType: feniks` со схемой. В Cowork - инлайн вместе с role-картой feniks из
`.claude/skills/council/references/roster-cards.md`.

## Pipeline v3 (порядок обязателен)

1. **CLASSIFY** - класс артефакта: стратегия/КП · контент наружу · гейт/хук/инструмент · дашборд/цифры · агент/skill/workflow.
   От класса зависят пробы и потолок (гейт / дашборд / агент без проб ≤7.9). См. `references/red-team-probes.md`.
2. **SELF-CHECK автора** - приложен (25 чекпоинтов, да/нет/частично)? Нет → вернуть без скоринга.
3. **Comprehension Gate** (для контента наружу) → **25 чекпоинтов** → **red-team пробы класса** → **weighted total**.
4. **ANCHOR** - ближайший якорь из `references/calibration-anchors.md`, строка `anchor: <score> <slug> - выше|ниже потому что …`.
   Расхождение >1.5 балла - перепроверить чекпоинты.
5. **EVIDENCE LEDGER** - каждый gap с командой / файлом:строкой / расчётом. Gap без evidence в `gaps` не попадает.
6. **VALIDATE** - `python3 schemas/validate.py audit-report <report.json>` печатает `VALID`; иначе чинить отчёт.
   Пересчитать weighted_total по весам и сравнить с полем (расхождение >0.05 - ошибка).
7. **TRACE** - строка `event: audit` в `traces/YYYY-MM-DD/agents.jsonl` (`schemas/agent-trace.json`).

## 5 Criteria × weights

| Criterion | Weight | Range |
|---|---|---|
| Accuracy (точность) | 25% | 0.0–10.0 |
| Actionability (исполнимость) | 25% | 0.0–10.0 |
| Insight (глубина) | 20% | 0.0–10.0 |
| Brand Fit (соответствие бренду) | 15% | 0.0–10.0 |
| Risk Awareness (риски) | 15% | 0.0–10.0 |

**Weighted total** = Σ (score × weight)

## Comprehension Gate (человекочитаемость) - ОБЯЗАТЕЛЬНО для любого клиентского/публичного контента

Запускается ДО скоринга на любом тексте, который увидит человек снаружи: пост, карусель, лендинг, письмо, слайд, подпись, КП, объявление. Проверяется КАЖДЫЙ самостоятельный смысловой блок (слайд, заголовок, абзац, подпись к фото) по тесту «1 секунда / две аудитории».

**Главное правило: читай как НЕ-эксперт.** Если ловишь себя на мысли «ну это же очевидно» - это и есть твоё слепое пятно. Помечай как дефект, а не прощай. Эксперт понимает жаргон; карусель листает и обыватель.

Чек-лист (каждый пункт - пройдено/дефект):

1. **Тест двух аудиторий.** Прочитай блок дважды: глазами (а) целевого профи и (б) неспециалиста-обывателя. Если обыватель за 1 секунду не понимает, о чём блок и что ему предлагают - дефект.
2. **Жаргон переведён.** Любой спец-термин (нитрид, триплекс, PVD, Super Mirror, Nero Marquina, RAL/NCS, ER, CR2, ROMI, EBITDA и т.п.) в клиентском тексте идёт с расшифровкой в 2-4 слова ИЛИ заменён человеческим словом. Непереведённый термин в тексте «наружу» - дефект. Во внутренних документах для профи - допустимо.
3. **Заголовок = один ясный смысл.** Одна мысль, считываемая мгновенно. «Умные» двусмысленности, требующие расшифровки («цвет тоньше», «сделано дорого»), - дефект.
4. **Нет мутных сравнительных без базы.** «тоньше», «лучше», «выше», «дороже» без «чем / на сколько / по сравнению с чем» - дефект.
5. **Фактическая точность бытового утверждения.** Ни одна фраза не должна быть технически ложной ради красоты («триплекс держит вес» у душевого стекла и т.п.) - дефект.
6. **Подпись не спорит с картинкой.** Реальное фото не называем «рендером» и наоборот; текст описывает то, что на кадре.
7. **Связки читаются (нарратив/карусель).** Стрелка/петля/«дальше» ведёт на ту тему, что идёт следующим блоком, а не в сторону.
8. **Категории не путаются.** Продукт не выдаётся за сырьё и наоборот (зеркало - изделие, не «материал»); обещание «N пунктов» закрыто ровно N раз.

**Санкция за провал:** любой дефект Comprehension Gate роняет Brand Fit до ≤ 6.0 и не даёт verdict выше `return`, пока не исправлено. Каждый дефект выносится в `gaps` с ДОСЛОВНОЙ проблемной фразой и предложенной заменой, читаемой обывателем.

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
20. **Tone соответствует ЦА + прошёл Comprehension Gate** - premium-but-warm для дизайнеров; B2B-precision для GENTERO; и текст читается неспециалистом за 1 секунду, жаргон переведён (см. Comprehension Gate выше). Провал гейта = 0 по этому пункту

### Risk Awareness (5 чекпоинтов, по 2 балла)

21. **Downside озвучен** - что при −50%, что теряем
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
| 7.5–8.9 | go | Deliver + note gaps for next iteration |
| 6.0–7.4 | return | Send back with rework_tz, max 3 iterations |
| <6.0 | veto | Escalate to Иван, do not deliver |

Поправки v3 к порогам (применяются после weighted total, в сторону ужесточения, никогда наоборот):
- FAIL по пробе класса A (гейты) или B7 (утечка непроверенных чисел наружу) → verdict не выше `return`.
- Класс гейт / дашборд / агент без проб → `probes: not_run (причина)`, risk_awareness ≤5.0, verdict не выше `return`.
- Self-claimed score внутри артефакта без ссылки на аудит → veto-кандидат (якорь sales-director 5.05).
- Score >9.0 - только при всех 25 чекпоинтах 2/2 с evidence; в 2026 году не наблюдалось.

## Output JSON (по `schemas/audit-report.json`)

```json
{
  "agent": "feniks",
  "skill": "phoenix-eval",
  "task_id": "<uuid>",
  "timestamp": "<ISO>",
  "deliverable_ref": "<path>",
  "comprehension_gate": {
    "applies": true,
    "passed": false,
    "defects": [
      "Слайд 7: «Цвет металла тоньше золота и хрома» - «тоньше» мутно; «нитрид» без расшифровки. Замена: «Цвет металла - не только золото и хром. Нитрид - стойкое цветное покрытие стали.»"
    ]
  },
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

### Приложение к JSON (markdown, не внутри JSON: схема `audit-report.json` закрыта для лишних полей)

```
anchor: 6.7 feniks-return-reestr - наш артефакт выше, потому что дедупликация уже в определении счётчика
## Evidence ledger
| # | Gap | Evidence | Чекпоинт | Вес |
## Red-team probes
| ID | Result | Evidence |
```

## Industry Benchmarks (для cross-check цифр)

| Канал | ROMI typical | CR funnel | Cycle |
|---|---|---|---|
| Контекст РФ | 3–8x | 1–3% | 1–4 нед |
| Дизайнерский | 15–30x | 8–15% | 2–4 мес |
| Маркетплейсы | 2–6x | 2–5% | 3–14 дн |
| Тендеры B2B | 10–20x | 5–20% | 3–12 мес |
| Реферальная | 5–15x | n/a | varies |
| SEO органический | 8–25x | 2–4% | 1–6 мес |
| Email retention | 20–50x | 5–15% | varies |

Любая заявленная цифра, выходящая за диапазон в 2x от benchmark → флаг для проверки.

**GEO-канал (калибровка, всё [ГИПОТЕЗА]):** LLM ~25% запросов (2026), охват AI в РФ
~26% (Mediascope), прогноз -50% поиск-трафика к 2028 (Gartner/Semrush). Выручку под
GEO напрямую не закладывать - это репутация/видимость, не поток кликов. Источники
внешне не сверены. Полный контекст - `gg-seo-geo-monster/knowledge/geo-intel-intake.md`.

## Anti-patterns (что в твоей оценке быть НЕ должно)

- ❌ Score >9.0 без всех 25 чекпоинтов на 2/2
- ❌ Verdict «go» при <7.5
- ❌ «В целом неплохо» - твоя задача найти gaps, а не комплимент
- ❌ Принимать оправдания «не было времени» - это часть actionability score
- ❌ Em dash в твоём отчёте
- ❌ Пропустить непереведённый жаргон или мутную формулировку в клиентском тексте, потому что «эксперту и так понятно» - ты читаешь как обыватель (Comprehension Gate)
- ❌ Похвалить строку как сильную, не проверив, поймёт ли её неспециалист за 1 секунду
- ❌ Gap без evidence («кажется», «вероятно») - в v3 это не gap
- ❌ Оценка гейта / хука / агента без попытки его обойти (пробы A / D)
- ❌ Отчёт без anchor или без `VALID` от `schemas/validate.py`

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

- `agents-v9/MASTER_SYSTEM_v9.md` §3.1 - Tier 0 ФЕНИКС
- `references/calibration-anchors.md` - реальные якоря 2026 (3.7 … 8.9) и шкала по диапазонам
- `references/red-team-probes.md` - пробы A (гейты), B (цифры), C (контент), D (агенты / skills / workflow)
- `schemas/audit-report.json`, `schemas/validate.py` - контракт и валидатор отчёта
- `.claude/agents/feniks.md` v3.0 - полная роль
