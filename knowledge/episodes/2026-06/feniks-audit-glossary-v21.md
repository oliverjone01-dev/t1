---
agent: feniks
skill_audited: glossary-v21
deliverable_ref: /home/user/t1/.claude/skills/glossary-v21/SKILL.md
canon_source: /home/user/t1/glossary.md
sibling_skill: /home/user/t1/.claude/skills/encyclopedia-router/SKILL.md
timestamp: 2026-06-08
auditor: ФЕНИКС #35
methodology: phoenix-eval 25-checkpoint
threshold: 7.5
---

# ФЕНИКС audit: skill `glossary-v21` (Step 12.5)

## Context

Skill выделен из v8 encyclopedia-checker по решению Ивана (SPLIT_INTO_2, atom A8.1).
Sibling - `encyclopedia-router` (factual PK routing). Этот skill отвечает за terminology consistency (палитра/линия/коллекция/комплект/артикул, имена брендов, режимы продаж).

Cross-checks выполнены:
1. `/home/user/t1/glossary.md` (canon v2.1, 798 строк)
2. `/home/user/t1/.claude/skills/encyclopedia-router/SKILL.md` (sibling, обратные ссылки)
3. `/home/user/t1/.claude/skills/phoenix-eval/SKILL.md` (методология)
4. Grep на em dash (zero matches confirmed)

## Phase 1: Cross-check (verified facts)

| Факт в skill | Canon location | Verdict |
|---|---|---|
| 5 брендов GENGLASS/VALONTI/GENTERO/Metal-GM/GLASS-MEMORY | glossary §9.2, Приложение A | OK |
| Metal-GM (не GM-METAL), GLASS-MEMORY с дефисом | glossary §9.2 примечание + Прил. B | OK |
| Категории (7 функциональных классов) | glossary §10.1 + Прил. A | OK |
| TRUBIS - первая линия GENGLASS | glossary §3.3 | OK |
| Core: NERO RAL 9005, ORO BS002, BIANCO RAL 9003 | glossary §2.3 | OK |
| Drop CIPRIA RAL 3015 | glossary §2.3 | OK |
| INDUSTRIAL RAL 7024 в разработке | glossary §2.3 | OK |
| Артикулы GGM/GGL/GGT/GGP-01/GGP-02 формат | glossary §6.3 | OK |
| Capsule 6-18 мес vs Core коллекция | glossary §4.2 | OK |
| Pricing: Core ref, Drop +5-15%, Collection +15-30%, Limited +10-20% | glossary §4.4 | OK |
| In-Stock 1-3 дня Домодедово | glossary §7.1 | OK |
| MTO 5-30 дней | glossary §7.2 | OK |
| Bespoke 20-90 дней | glossary §7.3 | OK |
| Комплект 2-7 артикулов | glossary §5.1 | OK |
| Имена палитр принадлежат GENGLASS | glossary §9.3 | OK |
| Микс палитр в комплекте запрещён | glossary §5.2 | OK |

Conflicts: ноль критических. Два minor mismatches - см. Gaps.

## Phase 2: 25 Checkpoints

### Accuracy (вес 25%)

| # | Checkpoint | Score | Обоснование |
|---|---|---|---|
| 1 | figures_tagged | 1 | Skill - reference doc, не план. Цифры в нём definitions (RAL 9005, 5-15%, 2-7 артикулов). Они не требуют тегов `[ДАННЫЕ]/[ГИПОТЕЗА]` потому что это canonical definitions из glossary, не прогнозы. Частично - один косвенный случай «надбавка 5-15%» можно было бы сослаться на glossary §2.2 inline |
| 2 | sources_verifiable | 2 | Reference-секция в конце с путями: glossary.md, index.html, viktor.md, phoenix-eval. Все пути верифицированы и существуют |
| 3 | no_conflict_with_rag | 1 | Один конфликт с canon: skill пишет «7-уровневая архитектура» в заголовке §Core terms, но glossary §1.2 явно говорит «семь-восемь атрибутов» (5 вертикаль + 3 горизонталь = 8). Skill перечисляет фактически 8 уровней внутри той же секции. Minor numbering inconsistency |
| 4 | glossary_terminology | 2 | Главный пункт. Skill сам ЯВЛЯЕТСЯ terminology checker. Использует канон v2.1 строго: палитра/линия/коллекция/комплект разведены корректно. Common errors table mappings совпадают с glossary Приложение B.1 |
| 5 | brand_names_correct | 2 | Metal-GM через дефис (правильно, не GM-METAL, не Metal_GM). GLASS-MEMORY через дефис. Все 5 брендов написаны идентично canon |

Accuracy subtotal: 8/10 → **8.0**

### Actionability (вес 25%)

| # | Checkpoint | Score | Обоснование |
|---|---|---|---|
| 6 | owner_assigned | 1 | Skill сам безличный. Но указано когда invoke и кто потребитель (менеджеры, контент-отдел). Нет явного владельца самого skill (кто обновляет) |
| 7 | deadline_buffer | 0 | N/A для skill-документа. Но и нет даты actuality / version pin (glossary v2.1 — какая ревизия?) |
| 8 | resources_listed | 2 | Reference-секция перечисляет: canon glossary, landing, sales scripts, parent skill phoenix-eval. Все ресурсы для использования skill доступны |
| 9 | metric_concrete | 1 | Метрика catch rate не прописана. «Catches old-terminology errors» в description - качественная, не количественная. Не сказано «catch >95% errors GM-METAL/палитра-vs-коллекция» |
| 10 | milestone | 1 | Workflow секция содержит 4 шага (GREP → CONTEXT CHECK → FIX → CROSS-CHECK). Это процедурный milestone, но без оценки времени или volume |

Actionability subtotal: 5/10 → **5.0**

### Insight (вес 20%)

| # | Checkpoint | Score | Обоснование |
|---|---|---|---|
| 11 | nontrivial | 2 | Bridging phrases (translate-through-self без коррекции клиента) - нетривиальный sales-craft insight, не следует из «прочитайте глоссарий» |
| 12 | second_order | 2 | Pricing implications секция прямо описывает second-order effect: «смешать коллекцию и палитру в КП = смешать ценовые тиры = blow up клиента или underprice бренд». Это и есть downstream consequence |
| 13 | alternatives_analyzed | 1 | Sibling skill encyclopedia-router перечислен как альтернативный routing layer с разделением use cases (таблица «When to use sibling skill»). Не полноценный разбор альтернатив, но boundary с sibling задан явно |
| 14 | anti_median | 2 | Default LLM не знает Metal-GM vs GM-METAL, не знает бренд-internal палитру vs коллекцию, не сделает bridging phrase «наш весенний релиз - палитра CIPRIA». Skill реально несёт уникальное знание |
| 15 | cross_domain | 1 | Косвенно: pricing tier mention отсылает к индустриальной норме (Cassina/Minotti упомянуты в canon, но не в skill). Можно было бы добавить ссылку «в индустрии премиум-мебели Palette = Cassina finish option» |

Insight subtotal: 8/10 → **8.0**

### Brand Fit (вес 15%)

| # | Checkpoint | Score | Обоснование |
|---|---|---|---|
| 16 | voice | 2 | Voice GENGROUP: brutal-but-functional, конкретный, без розовых очков. Соответствует CLAUDE.md §12 |
| 17 | anti_slop | 2 | Никакого «инновационный/революционный/уникальный» в promotional sense. Использование слова «уникальный» только в технических definitions («уникальная единица товара» для артикула, «уникальный проект» для Bespoke - повторяют canon glossary, разрешено) |
| 18 | no_em_dash | 2 | Grep подтвердил: 0 матчей `—` и `–`. Использован только дефис `-` или фраза перестроена |
| 19 | output_routing | 2 | Skill сам - reference doc, не output. Структура корректная: frontmatter, разделы, таблицы. Markdown rendering чистый |
| 20 | tone_audience | 2 | ЦА skill - агенты (Marco, Viktor, Maks) + менеджеры. Tone professional-precise, без воды. Bridging phrases написаны warm-formal как требует §12 CLAUDE.md |

Brand Fit subtotal: 10/10 → **10.0**

### Risk Awareness (вес 15%)

| # | Checkpoint | Score | Обоснование |
|---|---|---|---|
| 21 | downside | 1 | Один downside озвучен (pricing-implications секция: «blow up клиента или underprice бренд»). Не озвучены другие риски: collision с устаревшим написанием в legacy 1С, конфликт между sibling skills, риск over-correction клиента |
| 22 | p9_hard_rules | 2 | Hard rules секция с 5 пунктами. Не нарушает P9: skill не делает финансовых прогнозов, не предлагает Pareto-инициативы |
| 23 | crisis_scenarios | 0 | Не учтено: что если canon glossary v2.1 обновится до v2.2 - как skill узнает? Нет version pin / sync mechanism. Crisis: ошибка в КП клиенту с миксованной терминологией - нет escalation path |
| 24 | dependencies | 2 | Явные зависимости: sibling encyclopedia-router, glossary.md, phoenix-eval, viktor.md (sales scripts). Все прописаны в Reference |
| 25 | reversibility | 1 | Поскольку skill - reference, reversibility = быстрая правка markdown. Но нет процедуры rollback если правка введёт ошибку. Acceptable для skill-уровня |

Risk Awareness subtotal: 6/10 → **6.0**

## Phase 3: Weighted Score

| Criterion | Subtotal/10 | Weight | Contribution |
|---|---|---|---|
| Accuracy | 8.0 | 25% | 2.00 |
| Actionability | 5.0 | 25% | 1.25 |
| Insight | 8.0 | 20% | 1.60 |
| Brand Fit | 10.0 | 15% | 1.50 |
| Risk Awareness | 6.0 | 15% | 0.90 |
| **WEIGHTED TOTAL** | | | **7.25** |

## Phase 4: Verdict

Score 7.25 < threshold 7.5 → **VERDICT: return** (доработка, не veto)

Близко к пороговому. Gaps конкретные, fixable за 30 минут.

## Phase 5: Top-3 Gaps (rework_tz)

### Gap 1 (Accuracy-3): «7-уровневая» vs реально 8 уровней

В §Core terms заголовок гласит «7-уровневая архитектура продукта GENGROUP», но затем перечислены 8 bullet points: Бренд / Категория / Линия / Модель / Артикул / Палитра / Коллекция / Комплект. Glossary §1.1+§1.2 формально разделяет: 5 вертикаль идентичности + 3 горизонталь группировки = 8 атрибутов (или «семь-восемь» по тексту canon).

**Fix:** Изменить заголовок на «8-уровневая архитектура (5 вертикаль + 3 горизонталь)» ИЛИ структурировать как canon: «Вертикаль идентичности (5 уровней)» + «Горизонталь группировки (3 уровня)». Второй вариант предпочтительнее - соответствует §1.1/§1.2 canon точно.

### Gap 2 (Actionability-9 + Risk-23): отсутствует version pin и метрика успеха

Skill ссылается на glossary v2.1, но не фиксирует commit hash или дату snapshot. Если canon обновится до v2.2 - skill не узнает, mappings устареют. Также нет measurable success criterion для самого skill: какой catch rate ожидаем (>95% старых упоминаний коллекция-vs-палитра?).

**Fix:** Добавить в frontmatter:
```yaml
canon_version: v2.1
canon_path: /home/user/t1/glossary.md
canon_pin_date: 2026-04
review_cycle: at canon update OR quarterly
success_metric: catch >= 95% старых терминов в audit-выборке 50 текстов
```

### Gap 3 (Risk-21 + Risk-23): не озвучены edge-кейсы и sync mechanism

Skill не охватывает:
- Legacy 1С с историческими «коллекция NERO» - стирать ли historical data?
- Конфликт между sibling skills (если encyclopedia-router и glossary-v21 дают разные answer)
- Over-correction риск: менеджер слишком ретиво «поправляет» дизайнера-партнёра, тот обижается
- Что делать при обнаружении дрифта в опубликованной коммуникации (PR, AD Russia) - есть ли retro-correction protocol?

**Fix:** Добавить секцию «Edge cases & escalation»:
- Legacy data: не переписывать опубликованные материалы старше 12 мес (см. canon Прил. D Priority-4)
- Conflict resolution: при конфликте glossary-v21 vs encyclopedia-router - эскалация СПАРТАКУ
- Over-correction: bridging-phrases для дизайнеров отдельно от менеджеров (мягче)
- Retro-correction: если PR-материал с ошибкой - не отзывать, добавлять erratum в следующий выпуск

## Дополнительные минорные замечания (не блокеры)

- Common errors table: 10 строк, не 11 как описано в task spec. Можно добавить одну: «GENGLASS Premium» (несуществующий бренд) - часто встречается в speculative-Roadmap.
- Bridging phrases: skill даёт 4 примера, task spec указывал 3 - излишек ОК.
- В §Pricing implications можно явно сослаться на canon §4.4 (currently implicit).
- §When to use sibling skill - last row «GM-METAL → Metal-GM» имеет ✅ в обоих столбцах. Это ambiguity: который skill primary? Если оба catch - явно указать «glossary-v21 catches, encyclopedia-router fact-routes».

## Dispute thread

Не требуется. Автор и ФЕНИКС согласны на rework по 3 gaps. Возврат на доработку с дедлайном Д+1.

## JSON Output

```json
{
  "agent": "feniks",
  "skill": "phoenix-eval",
  "task_id": "audit-glossary-v21-2026-06-08",
  "timestamp": "2026-06-08",
  "deliverable_ref": "/home/user/t1/.claude/skills/glossary-v21/SKILL.md",
  "canon_ref": "/home/user/t1/glossary.md",
  "sibling_ref": "/home/user/t1/.claude/skills/encyclopedia-router/SKILL.md",
  "checkpoints": {
    "accuracy_1_figures_tagged": 1,
    "accuracy_2_sources_verifiable": 2,
    "accuracy_3_no_conflict_with_rag": 1,
    "accuracy_4_glossary_terminology": 2,
    "accuracy_5_brand_names_correct": 2,
    "actionability_6_owner_assigned": 1,
    "actionability_7_deadline_buffer": 0,
    "actionability_8_resources_listed": 2,
    "actionability_9_metric_concrete": 1,
    "actionability_10_milestone": 1,
    "insight_11_nontrivial": 2,
    "insight_12_second_order": 2,
    "insight_13_alternatives_analyzed": 1,
    "insight_14_anti_median": 2,
    "insight_15_cross_domain": 1,
    "brand_16_voice": 2,
    "brand_17_anti_slop": 2,
    "brand_18_no_em_dash": 2,
    "brand_19_output_routing": 2,
    "brand_20_tone_audience": 2,
    "risk_21_downside": 1,
    "risk_22_p9_hard_rules": 2,
    "risk_23_crisis_scenarios": 0,
    "risk_24_dependencies": 2,
    "risk_25_reversibility": 1
  },
  "scores": {
    "accuracy": 8.0,
    "actionability": 5.0,
    "insight": 8.0,
    "brand_fit": 10.0,
    "risk_awareness": 6.0
  },
  "weighted_total": 7.25,
  "verdict": "return",
  "gaps": [
    "Accuracy-3: 7-уровневая vs 8-уровневая архитектура - terminology mismatch с canon §1.1/§1.2",
    "Actionability-9 + Risk-23: нет canon version pin, нет success metric, нет sync mechanism при обновлении glossary",
    "Risk-21 + Risk-23: edge-кейсы не покрыты (legacy 1С, conflict с sibling, over-correction, retro-correction в PR)"
  ],
  "rework_tz": [
    "1. Переименовать §Core terms заголовок на '8-уровневая (5 вертикаль + 3 горизонталь)' или структурировать секцию по канону §1.1/§1.2",
    "2. Добавить в frontmatter: canon_version, canon_pin_date, review_cycle, success_metric",
    "3. Добавить секцию 'Edge cases & escalation' с 4 пунктами: legacy data / conflict resolution / over-correction / retro-correction"
  ],
  "confidence": 0.85,
  "review_cycle_target": "audit re-run после fixes, ожидаемый score >= 8.5"
}
```

---

**Audit by:** ФЕНИКС #35
**Reviewed against:** glossary v2.1 (canon), encyclopedia-router (sibling), phoenix-eval methodology
**Verdict status:** RETURN (close to threshold, fixable)
