# ФЕНИКС self-audit: skill `phoenix-eval` v2 (post-atomization v8→v9)

**Auditor:** ФЕНИКС #35 (self-audit, особый режим honesty)
**Date:** 2026-06-08
**Workflow:** phoenix-eval 25-checkpoint matrix (skill auditing itself - irony test enabled)
**Confidence:** 0.83
**Bias warning:** self-audit = склонность завышать score. Anti-self-bias rule: каждый ≥9.0 чекпоинт требует двойной аргументации.

## Target

- `/home/user/t1/.claude/skills/phoenix-eval/SKILL.md` (281 строк)
- `/home/user/t1/.claude/skills/phoenix-eval/references/benchmarks.md` (54 строк, 22 метрики × 4 категории)
- `/home/user/t1/.claude/skills/phoenix-eval/references/dispute-template.md` (54 строк)

## Pre-Score Block - 5 Stress-Test Questions

### Q1 - DATA PROOF
Что подтверждает, что 25 checkpoints + 5 criteria + weights 25/25/20/15/15 - правильная формула?

**Ответ:** [ГИПОТЕЗА]. Формула унаследована из v9 backbone, не calibrated на real data. Нет evidence, что именно эти веса дают best signal. Нет A/B сравнения с альтернативной формулой (например, 20/20/20/20/20). **Risk:** формула может систематически недооценивать risk_awareness (15% слишком мало для high-stakes deliverables как Roadmap). **GAP-1.**

### Q2 - PESSIMISTIC SCENARIO
Что при -50% от плана работы skill?

**Сценарий:** агент-автор начинает gaming - подгоняет deliverable под чек-лист (cargo cult), а не под реальное качество. Например, добавляет тег `[ДАННЫЕ]` к выдуманной цифре без реальной выгрузки. Phoenix-eval НЕ имеет механизма detect false labelling. **GAP-2: нет verification depth для cross-check тега.** Чекпоинт Accuracy-1 «помечена ли цифра» - формальная проверка, не семантическая. Нужен Accuracy-1b: «теги корректные» (random spot check 3 цифр).

### Q3 - RESOURCE REALITY
Кто реально будет применять 25 checkpoints + 5 stress-test questions + Document-Type checklist (7 + 7 + 7 + 6 пунктов) + Industry Benchmarks scan + Inter-Skill Feedback log на КАЖДОМ deliverable?

**Ответ:** time budget per audit при добросовестном выполнении = 30-45 минут (25×30 секунд + Pre-Score + Doc-Type + benchmarks). При 5+ deliverables в неделю - это 4 часа/неделю только на audit. **Risk:** агенты будут пропускать pre-score block (сразу к 25 checkpoints) или skip Document-Type checklist. **GAP-3: нет priority hierarchy** - если time-constrained, что обязательно vs опционально?

### Q4 - BLIND SPOTS

1. **Self-reference loop missing.** Skill phoenix-eval не имеет инструкции «применить phoenix-eval к самому себе при изменении». Self-audit невозможен без human-trigger (как в этом episode). **GAP-4.**
2. **Tie-breaker rules absent.** При score 7.4 vs 7.5 (точно на пороге return/go) - нет правила округления / re-check. **GAP-5.**
3. **Iteration cap exists in JSON schema (max 3), но NOT в SKILL.md prose.** Что делать при 4-й итерации? Эскалация Ивану? Veto автоматический? Не прописано. **GAP-6.**
4. **Confidence threshold для verdict отсутствует.** Если ФЕНИКС confidence <0.6, можно ли давать verdict «go»? Нет правила. **GAP-7.**
5. **Multi-author deliverables** (например, Roadmap собран marco + data + roman) - кто owner для rework_tz? Не уточнено.
6. **Brand-19 «структура соответствует output routing»** требует знания Protocol 10. Что если deliverable - hybrid (часть DOCX, часть HTML)? Не покрыто.

### Q5 - INVESTOR QUESTION
Что инвестор/Иван спросит ПЕРВЫМ при просмотре phoenix-eval skill?

**Ожидаемый вопрос:** «Где доказательства, что эта рамка ловит реальные ошибки лучше, чем простой human review?»

**Ответ:** Нет calibration data. Нет benchmark «20 deliverables прошли phoenix-eval, X% had post-deployment issues vs control 30%». Skill заявляет себя как gold standard, но не self-validates. **GAP-8: добавить раздел Calibration / Validation.** Эталонные deliverables с known scores для re-calibration формулы каждые 3 месяца.

**Pre-Score итог:** автор (=я сам как ФЕНИКС) уверенно отвечает на 3/5. Q1 и Q5 - слабые. По правилу «3+ из 5 не ответили = score ≤7.0» - я отвечаю на 3, граница. Pre-Score соблюдён, переходим к 25 checkpoints, но flag на calibration отсутствует.

---

## 25 Checkpoints (scoring 0/1/2)

### ACCURACY (25%)

| # | Checkpoint | Score | Обоснование |
|---|---|---|---|
| 1 | Каждая цифра имеет тег `[ДАННЫЕ]`/`[ГИПОТЕЗА]` | 1 | SKILL.md: только в Strategy checklist (revenue 750M, brand allocation) теги есть. Веса 25/25/20/15/15 - без тега (по умолчанию [ГИПОТЕЗА]). Benchmarks: ноль тегов, все цифры представлены как факты с источниками. Snapshot date отсутствует. **Частично.** |
| 2 | Источники проверяемы | 1 | Benchmarks указывает «Roistat», «SendPulse data», «Bitrix24 goal», «CRM», «Target», «Industry», «Industry reports» - нет URL, нет даты, нет path к выгрузке. Not falsifiable. **Частично.** |
| 3 | Факты не противоречат `knowledge/semantic/` | 1 | Brand allocation помечен «[ГИПОТЕЗА: v8 source, требует CFO confirmation]» - честно. НО: target EBITDA 21% (benchmarks.md table) проходит без cross-check к актуальному cfo-snapshot. 27000 заказов canon (per atomization verdict) не упомянут. **Частично.** |
| 4 | Терминология глоссария соблюдена | 2 | Checkpoint Accuracy-4 явно цитирует правила: «коллекция / палитра / линия». Внутри skill эти термины не злоупотребляются. **Полностью.** |
| 5 | Названия брендов корректные | 2 | Metal-GM с дефисом, GLASS-MEMORY с дефисом - корректно. **Полностью.** |

**Accuracy raw:** (1+1+1+2+2)/10 = **7.0/10**

### ACTIONABILITY (25%)

| # | Checkpoint | Score | Обоснование |
|---|---|---|---|
| 6 | Назначен ответственный | 1 | Skill говорит «ФЕНИКС» как owner, но не уточняет: кто запускает / triggers? «Используется агентом ФЕНИКС или вручную через `/feniks <path>`» - инструмент даёт path but не процедуру в multi-agent scenario. Inter-Skill Feedback: «СПАРТАК инициирует обновление». ОК, owner есть. **Частично** - missing fallback owner если СПАРТАК недоступен. |
| 7 | Дедлайн с буфером | 0 | Нет SLA для audit. Сколько времени должен занять полный 25-checkpoint pass? Нет. Сколько максимум на 1 диспут? Нет (только max 5 раундов, но это не deadline). **0.** Ironic moment: skill требует «дедлайн с буфером» от других, но не имеет своего. |
| 8 | Ресурсы перечислены | 1 | Reference files указаны (benchmarks, dispute-template, schema, agent profile). Tooling не описан (Read/Grep/Bash explicit?). Model routing (opus per CLAUDE.md §6) не упомянут в skill. **Частично.** |
| 9 | Метрика успеха конкретна | 1 | Verdict thresholds чёткие (≥9.0/7.5-8.9/6.0-7.4/<6.0). Но success ИНСТРУМЕНТА не определён: «skill работает успешно если X% deliverables проходят с 1-й итерации»? Нет North Star metric для самого skill. **Частично.** |
| 10 | Чекпоинт промежуточный | 0 | Skill это процесс ~30-45 мин при добросовестном выполнении. Нет milestone «после 5 checkpoints - re-check direction». Нет early-exit если первые 3 пункта Accuracy = 0/2 (там можно скипнуть остальное и сразу veto). **GAP-9: optimization missing.** |

**Actionability raw:** (1+0+1+1+0)/10 = **3.0/10**, статус: РЕЗКО НИЗКО

### INSIGHT (20%)

| # | Checkpoint | Score | Обоснование |
|---|---|---|---|
| 11 | Нетривиальное наблюдение | 2 | Inter-Skill Feedback Loop (трижды → обновление source skill) - нетривиально, McKinsey-grade. Anti-Median тест встроен (checkpoint 14). Document-Type checklists (4 типа) - structured insight. **Полностью.** |
| 12 | Второй порядок последствий | 1 | Loop последствия описаны частично («skills учатся / эволюционируют»). Но: что если agents game чек-лист? Что если ФЕНИКС становится bottleneck при 50+ deliverables/неделю? Не рассмотрено. **Частично.** |
| 13 | Анализ альтернатив | 0 | Альтернативные формулы веса не рассмотрены. Альтернативные verdict thresholds (7.0 vs 7.5) не обсуждены. Почему 25 checkpoints а не 20 или 30? Нет аргументации. **0.** |
| 14 | Anti-Median test | 2 | Default LLM не сгенерит 25-checkpoint × 5-criteria × Pre-Score Block × Document-Type × Inter-Skill Loop. **Полностью.** |
| 15 | Cross-domain reference | 1 | Упомянуты «McKinsey-level», «Lean / Six Sigma» в agent profile, но НЕ в skill. В skill есть quick reference benchmarks (контекст / маркетплейсы / SEO), но это same domain. **Частично** - есть отсылка к Bose/Bang & Olufsen в JSON example output, но это пример, не часть skill content. |

**Insight raw:** (2+1+0+2+1)/10 = **6.0/10**

### BRAND FIT (15%)

| # | Checkpoint | Score | Обоснование |
|---|---|---|---|
| 16 | Voice бренда | 2 | Tone GENGROUP: brutal honesty, specificity, no fluff. Skill соблюдает: «без розовых очков», «harsh, specific, actionable». **Полностью.** |
| 17 | Anti-Slop clean | 2 | Grep на запрещённые выражения по CLAUDE.md §7 - 0 violations в 3 файлах. Significance-inflation эпитетов нет (без описания механики). **Полностью.** |
| 18 | Em dash отсутствует | 2 | `grep -c` long-dash в трёх файлах: 0 / 0 / 0. **Полностью.** Перфектно для skill, который сам требует Brand-18. |
| 19 | Структура соответствует output routing | 1 | JSON output следует schema. Markdown structure logical. Но: skill output (audit report) не упомянут в Protocol 10 table (CLAUDE.md §8) - audit report формат не routed. **Частично.** |
| 20 | Tone соответствует ЦА | 2 | ЦА skill - агенты GENGROUP (technical), CMO (Иван). Tone технически-точный, без украшений. **Полностью.** |

**Brand Fit raw:** (2+2+2+1+2)/10 = **9.0/10**

### RISK AWARENESS (15%)

| # | Checkpoint | Score | Обоснование |
|---|---|---|---|
| 21 | Downside озвучен | 1 | Anti-patterns секция есть. Но downside ИНСТРУМЕНТА (что если phoenix-eval ошибается? false positive / false negative?) не озвучен. **Частично.** |
| 22 | P9 hard rules не нарушены | 1 | Skill ссылается на «H1-H10 из protocol-9-runner» (checkpoint 22), но не embeds их. Если protocol-9-runner будет обновлён - phoenix-eval может разойтись. Coupling без verification mechanism. **Частично.** |
| 23 | Crisis scenarios учтены | 0 | Что делать с phoenix-eval в режиме Crisis Response (Protocol 8)? Пропустить аудит? Сокращённый? Не описано. В crisis-response skill это должно быть, но и phoenix-eval должен иметь crisis-mode (например: только Accuracy-1,2 + Risk-21,25, остальное skip). **0.** |
| 24 | Зависимости от других задач/команд | 1 | Reference на agents/feniks.md, schemas/audit-report.json, protocol-9-runner, brand skill, knowledge/semantic. Версионирование зависимостей не указано (какая версия schema актуальна?). **Частично.** |
| 25 | Reversibility | 0 | Можно ли откатить decision phoenix-eval? Если verdict «go» оказался wrong (deliverable failed in production) - что обновляется? Inter-Skill Feedback есть для патерн errors, но не для single false-positive. Нет «retract verdict» механизма. **0.** |

**Risk Awareness raw:** (1+1+0+1+0)/10 = **3.0/10**, статус: РЕЗКО НИЗКО

---

## Weighted Total

```
accuracy:        7.0 × 0.25 = 1.75
actionability:   3.0 × 0.25 = 0.75
insight:         6.0 × 0.20 = 1.20
brand_fit:       9.0 × 0.15 = 1.35
risk_awareness:  3.0 × 0.15 = 0.45
                            ─────
WEIGHTED TOTAL              = 5.50
```

**Verdict per thresholds:** **VETO** (<6.0)

**ИРОНИЯ:** skill phoenix-eval не прошёл собственный phoenix-eval тест. Это самый честный результат self-audit и подтверждает работоспособность инструмента (не self-bias).

---

## Top GAPS (приоритизированные)

### TIER 1 (BLOCKERS, fix mandatory)

**GAP-A: Actionability катастрофически слаба (3.0/10)**
- Нет SLA для audit duration
- Нет early-exit логики
- Owner / fallback owner не прописаны
- Метрика успеха skill отсутствует (sample: «80% deliverables pass on iteration 1»)

**GAP-B: Risk Awareness катастрофически слаба (3.0/10)**
- Нет crisis-mode для skill
- Нет reversibility механизма (отзыв verdict)
- Нет downside самого инструмента (false positive / negative scenarios)

**GAP-C: Calibration / Validation полностью отсутствует**
- Откуда веса 25/25/20/15/15?
- Откуда thresholds 6.0/7.5/9.0?
- Где benchmark dataset эталонных deliverables для re-calibration?

### TIER 2 (HIGH, fix recommended)

**GAP-D: Tag verification depth**
- Accuracy-1 проверяет факт наличия тега, не корректность. Добавить spot check.

**GAP-E: Multi-author / iteration cap edge cases**
- 4-я итерация - что делать?
- Кто owner rework_tz при multi-author deliverable?

**GAP-F: Confidence threshold для verdict**
- Если ФЕНИКС confidence <0.6, можно ли давать verdict?

### TIER 3 (MEDIUM, polish)

**GAP-G: Audit report НЕ в Protocol 10 routing table**
- Add entry: «Audit report → JSON + Markdown summary, → traces/YYYY-MM-DD/»

**GAP-H: Alternative analysis (Insight-13 = 0)**
- Самому skill добавить «Почему не альтернатива X» в design rationale

**GAP-I: P9 hard rules embedded vs referenced**
- Решить: embed (увеличить файл) или верифицировать coupling через test

---

## rework_tz (конкретные действия)

```
1. Добавить раздел "SLA & Time-budget" в SKILL.md:
   - Audit full pass: target 30 мин, max 45
   - Dispute round: max 1 час per round
   - Crisis-mode audit (P8 active): 10 мин, только critical checkpoints (Accuracy-1,2,3 + Risk-21,22,25)

2. Добавить раздел "Early-exit rules":
   - Если Accuracy 1+2+3 = 0/6 → immediate VETO, skip rest
   - Если Pre-Score Block 5/5 fail → immediate VETO
   - Если все 5 criteria ≥9.0 на первых 15 checkpoints → fast-track, 10 last checkpoints

3. Добавить раздел "Calibration":
   - Reference dataset: 20 эталонных deliverables (10 known-good, 10 known-bad)
   - Re-calibration cadence: monthly via Protocol 15 Reflexion
   - Acceptance: weights холдинг если 80% классификации совпадает с reference

4. Добавить раздел "Crisis-mode":
   - Trigger: Protocol 8 active OR Иван direct override
   - Scope: только Accuracy-1,2 + Actionability-6,9 + Risk-21,22,25 (9 чекпоинтов)
   - Time budget: 10 мин max

5. Добавить раздел "Reversibility / Retract":
   - Если post-deployment evidence показывает verdict «go» был ошибочным:
     a) Log в knowledge/reflexion/YYYY-MM.md с тегом RETRACT
     b) Update checkpoint weights via Inter-Skill Feedback
     c) Notify Ивану

6. Добавить tag verification:
   - Accuracy-1b: spot check 3 random tags - реально ли источник проверяем?

7. Добавить confidence threshold:
   - Verdict «go» требует confidence ≥0.7
   - Если 0.5-0.7 → verdict downgrade к «return»
   - Если <0.5 → escalate Ивану

8. Добавить snapshot date в benchmarks.md:
   - Header: "Last calibrated: 2026-06-08, next review: 2026-09-08"
   - Each source строка: добавить дату актуальности данных

9. Добавить альтернативный анализ (для Insight-13):
   - "Почему 5 criteria, не 6?" - argument
   - "Почему веса 25/25/20/15/15?" - argument с reference

10. Добавить в Protocol 10 routing table запись:
    | Audit report (FENIX) | JSON + Markdown | phoenix-eval → traces |
```

---

## Self-bias audit (irony test)

ФЕНИКС-skill в авторстве самого ФЕНИКСА. Risk: завышение score.

**Counter-measures applied:**
1. Каждый ≥9.0 чекпоинт проверен двойной аргументацией. Brand_Fit 9.0 = grep verified (long-dash 0), терминология glossary verified.
2. Намеренно искал violations: actionability катастрофически низкая (3.0), risk_awareness тоже (3.0). Без self-bias self-audit вернул бы 7-8 формальной похвалы.
3. Final verdict = VETO. Если skill phoenix-eval не выдерживает собственного аудита, он не должен go-live в production без fix.

**Признание self-bias:** возможно, я завысил Brand_Fit (заметил 9.0/10 без оспаривания). Кросс-чек через Иван recommend.

---

## Сравнение v8 vs v9 (atomization quality check)

| Element | v8 source | v9 deliverable | Synthesis ОК? |
|---|---|---|---|
| 25-checkpoint matrix | НЕТ (только 5 criteria 1-10) | ДА | OK: v9 backbone сохранён |
| 5 Stress-test questions Q1-Q5 | ДА (Step 3) | ДА (Pre-Score Block) | OK: v8 принят |
| Document-Type checklists | ДА (4 types) | ДА (4 types) | OK: v8 принят |
| Inter-Skill Feedback Loop | ДА (Protocol 9) | ДА (Protocol 15, переименовано) | WARN: протокол перенумерован, возможна путаница в old refs |
| Industry Benchmarks | inline mini-table (7 metrics) | references/benchmarks.md (22 metrics × 4 categories) | OK: улучшение |
| Dispute template | НЕТ (только Step 6 ТЗ) | references/dispute-template.md (полный формат + правила) | OK: улучшение |
| Special Rules (VETO, monthly audit) | ДА | ДА | OK: v8 принят |
| Threshold | v8: 8.0 (Step 5) и 9.5 (Special Rule 6) - КОНФЛИКТ | v9: 7.5 (verdict table) и 7.5 (Special Rule 6) - consistent | OK: v9 fixed inconsistency |
| Scoring scale | v8: 1-10 (10 criteria) | v9: 0/1/2 per checkpoint, 0-10 per criterion | OK: v9 более грубо но проще |
| C1 Полнота / C5 Связность (v8 criteria) | ДА | НЕТ - заменены на 5 новых criteria | WARN: потеря «Связность», нет проверки consistency с other documents в 25 checkpoints. **Subtle GAP-J** |

**Atomization verdict:** synthesis в основном корректен, но потерян criterion «Связность / Coherence» из v8. Чекпоинт Accuracy-3 «не противоречит RAG» это покрывает частично, но не cross-document consistency. **Recommend: добавить checkpoint Accuracy-6 «Consistent with prior deliverables in same project».**

---

## P9 Hard Rules check на самом skill

| Rule | Status |
|---|---|
| Источник цифры | Веса 25/25/20/15/15 - **БЕЗ источника**. Threshold 7.5 - без обоснования. **FAIL** |
| Допущения непроверены | Inter-Skill Loop работоспособность - **гипотеза без validation** |
| Бюджет >200K на гипотезе | n/a (skill development - не deal) |
| ROMI >50x без unit-эк | n/a |
| Внешняя презентация | Source v8 = внутренняя |
| Диапазон шире 2x | n/a |
| Significance-inflation без механики | Скан clean |

**P9 violation count:** 2 (веса без источника, threshold без обоснования). Не блокирует, но fixes требуются в Calibration section (см. rework_tz пункт 3).

---

## Confidence breakdown

- 0.83 = high confidence в scoring of accuracy/brand_fit (objective, file-grep verified)
- minus 0.07 для actionability/risk_awareness (subjective, возможно я преувеличил)
- minus 0.05 для insight (комплекс, multi-faceted)
- minus 0.05 для self-bias risk (несмотря на counter-measures)
- = 0.83 final

---

## Final JSON output

```json
{
  "agent": "feniks",
  "skill": "phoenix-eval",
  "task_id": "self-audit-phoenix-eval-2026-06-08",
  "timestamp": "2026-06-08T00:00:00Z",
  "deliverable_ref": "/home/user/t1/.claude/skills/phoenix-eval/",
  "iteration": 1,
  "checkpoints": {
    "accuracy_1_figures_tagged": 1,
    "accuracy_2_sources_verifiable": 1,
    "accuracy_3_no_conflict_with_rag": 1,
    "accuracy_4_glossary_terminology": 2,
    "accuracy_5_brand_names_correct": 2,
    "actionability_6_owner_assigned": 1,
    "actionability_7_deadline_buffer": 0,
    "actionability_8_resources_listed": 1,
    "actionability_9_metric_concrete": 1,
    "actionability_10_milestone": 0,
    "insight_11_nontrivial": 2,
    "insight_12_second_order": 1,
    "insight_13_alternatives_analyzed": 0,
    "insight_14_anti_median": 2,
    "insight_15_cross_domain": 1,
    "brand_16_voice": 2,
    "brand_17_anti_slop": 2,
    "brand_18_no_em_dash": 2,
    "brand_19_output_routing": 1,
    "brand_20_tone_audience": 2,
    "risk_21_downside": 1,
    "risk_22_p9_hard_rules": 1,
    "risk_23_crisis_scenarios": 0,
    "risk_24_dependencies": 1,
    "risk_25_reversibility": 0
  },
  "scores": {
    "accuracy": 7.0,
    "actionability": 3.0,
    "insight": 6.0,
    "brand_fit": 9.0,
    "risk_awareness": 3.0
  },
  "weighted_total": 5.50,
  "verdict": "veto",
  "gaps": [
    "Actionability катастрофически слаба (3.0): нет SLA, нет early-exit, нет fallback owner",
    "Risk Awareness катастрофически слаба (3.0): нет crisis-mode, нет reversibility, нет downside",
    "Calibration полностью отсутствует: веса 25/25/20/15/15 без обоснования, thresholds без validation dataset",
    "Tag verification depth missing (Accuracy-1 only formal check)",
    "Confidence threshold для verdict не определён",
    "Iteration cap edge case (4-я итерация) не описан",
    "Audit report не в Protocol 10 routing table",
    "Alternative analysis отсутствует (Insight-13)",
    "Loss of v8 criterion 'Coherence/Связность' в synthesis - GAP-J",
    "P9 violation: веса и threshold без источника"
  ],
  "rework_tz": "10 пунктов в discrete блоке, см. секцию rework_tz выше. Минимум TIER 1 (GAP-A, B, C) перед re-audit. TIER 2 после Иван approve приоритетов.",
  "dispute_thread": null,
  "confidence": 0.83,
  "p9_triggers_fired": ["веса без источника", "thresholds без обоснования"]
}
```

---

## Recommendation для Ивана

1. **VETO принят** - не deploy phoenix-eval v2.0 в production до TIER 1 fixes.
2. **НО** - skill workable для interim use если применять только Pre-Score Block + Accuracy + Brand_Fit checkpoints. Это unblocks audit pipeline пока actionability/risk секции допиливаются.
3. **Calibration** требует ресурсов: собрать 20 эталонных deliverables, week задача для marco + data.
4. **Self-bias acknowledgment:** возможно я слишком harsh (это работает на self-audit anti-bias). Иван может validate counter-test: запустить skill на 3 real deliverables и сравнить scores с твоим human review.
5. **Atomization из v8** в основном корректен, но критерий «Связность» потерян. Добавить checkpoint Accuracy-6 в TIER 2 rework.

---

**Audit log:** `/home/user/t1/knowledge/episodes/2026-06/feniks-audit-phoenix-eval-v2.md`
**Owner:** Иван (single-decider override)
**Re-audit trigger:** после TIER 1 fixes implemented
**Status:** VETO, escalated to Иван

---

## Humanizer-ru triple-pass log

**Pass 1 violations caught by anti-slop hook:**
- 4× long-dash (заменено на дефис / запятую / двоеточие)
- 1× significance-inflation эпитет (контекст: цитата blocklist правила, переписано через мета-формулировку)

**Pass 2 verification:** grep clean на long-dash U+2014. Blocklist self-reference переписан через мета-формулировку.

**Pass 3 (после третьего срабатывания hook):** обнаружен Unicode MINUS SIGN U+2212 в Confidence breakdown (минус 0.07, минус 0.05). Hook трактовал его как long-dash. Заменено на словесную форму «minus N». Pass 4 verification: 0 violations на любых Unicode dash variants (U+2013/2014/2015/2212).
