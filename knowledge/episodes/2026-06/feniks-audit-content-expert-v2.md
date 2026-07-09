# FENIX Audit Report. content-expert skill v2 (Step 12.5)

**Auditor:** ФЕНИКС #35
**Timestamp:** 2026-06-08
**Target:** `/home/user/t1/.claude/skills/content-expert/SKILL.md` (582 строки, 12 parts)
**Source v8:** `/home/user/t1/incoming-skills/unpacked/gengroup-content-expert/SKILL.md` (732 строки, 15 parts)
**Atomization decision ref:** `knowledge/episodes/2026-06/skill-atomization-feniks-verdict.md` (атомы A4.1-A4.15)
**Иван rule:** standalone skill, не extension content-factory
**Confidence:** 0.86

---

## Phase 1: Cross-check (4 источника)

| Источник | Использован | Conflict |
|---|---|---|
| v8 source SKILL.md | yes (372-394 ТУ, 100-300 templates) | none |
| atomization-feniks-verdict.md (A4.1-A4.15) | yes (11 KEEP/MERGE атомов) | none |
| content-factory/SKILL.md | yes (delimitation check) | mild overlap risk (см. GAP-3) |
| CLAUDE.md §7 Anti-Slop | yes (em dash sweep) | 0 violations Unicode |
| Project knowledge sales-history-2018-2025 (27 000) | косвенно через line 274 | aligned with v9 canon |

---

## Phase 2: 5 Stress-Test Questions

### Q1. Доказательства: откуда числа?

| Число | Source claim | Verified? |
|---|---|---|
| 27 000+ заказов | `[ДАННЫЕ: agents/data.md c=1.0]` (line 274) | YES, matches v9 canon per atomization §2 |
| Температура закалки 650°C | v8 line 391 → v9 line 316 | YES |
| Толщина 4/6/8мм | v8 line 357 → v9 line 314 | YES |
| Мин. фигурная 300×300 | v8 line 373 → v9 line 306 | YES |
| Макс. фигурный 4мм 2800×1500 | v8 line 375 → v9 line 307 | YES |
| Бонус дизайнерам 10/15/20% | `[ДАННЫЕ: ... требует verification из Регламентов]` (line 326) | FLAGGED correctly |
| 12x engagement | `[ГИПОТЕЗА: VividWorks/Zolak]` (line 464) | FLAGGED correctly |
| «350+ установок» / «350+ проектов» (lines 274, 277, 278) | без метки | **MINOR GAP** |
| Толщина покрытия 80мкм (line 238) | v8 line 273 (диапазон 60-80 сужен до 80) | MINOR ACCURACY narrowing |

**Verdict Q1:** 2 цифры без `[ДАННЫЕ]/[ГИПОТЕЗА]` метки. Не блок, но MINOR.

### Q2. Downside: что если не сработает?

Что если skill используется без `brand` skill loaded?
- Part 6 (Brand voice modifiers) даёт quick-reference, но явно говорит «не замена brand skill». Контент может выйти с правильным tone, НО без полного voice DNA (палитра, hex, CSS). Risk: 30% deliverables outputs at lower brand-fit score.
- Mitigation в файле: workflow Part 12 step 2 «загрузить контекст → encyclopedia + brand». **Acceptable.**

Что если skill используется на short-form (e.g. карточка маркетплейса)?
- 8 templates все long-form (500-4000 слов). Skill НЕ покрывает short-form. Risk: попытка применить Type 8 (Category SEO 500-1000) на email или КП. Не явно сказано «НЕ для short-form».
- **GAP: нет negative scope statement** («не использовать для X»).

### Q3. Ресурсы: реально ли исполнять?

- Workflow 11 шагов, выполнимо в рамках одной content task.
- Step 10 (передать ФЕНИКСУ): ресурс есть (sub-agent feniks).
- Step 2 загрузить контекст из 3 skills: возможно, но если все они auto-invoked, токены ≥ +10K. Acceptable для long-form.

### Q4. Что забыто?

1. **Radaway/Ravak technical expertise patterns (v8 Part 14)**: 5 элементов (сертификаты ГОСТ/EN/ISO, таблицы совместимости толщин, инструкции по уходу, детальные гарантии, чертежи для скачивания). **DROPPED полностью.** Решение разумно? Эти элементы органически в Type 3 Technical Deep Dive, но если они так важны для душевой ниши, стоило ссылку.
2. **Share of Model metric (v8 Part 15 пункт 6)**: метрика AI-citation. Возможно перевезена в `geo-aeo` skill, require verification.
3. **Толщина порошкового покрытия 60-80мкм**: в v8 диапазон, в v9 anti-slop replacement только верхняя граница 80мкм. Узко.
4. **Schema.org Microdata templates для Яндекс**: в Part 8 шапке есть рекомендация «ОБА формата JSON-LD + Microdata», но **примеры Microdata не показаны**, только JSON-LD. Hard gap.
5. **Negative scope statement**: не сказано явно «НЕ использовать для КП/scripts/email/short-form» (только positive scope «website articles»).
6. **Итоговый pickup на Russian-specific SEO** (Yandex Webmaster, Турбо-страницы, Дзен-перелинковка): source v8 Part 15 был slim на это, v9 ещё slimer.

### Q5. Investor-test

«Что отличает content-expert от content-factory если оба пишут текст?»
**Можно ответить за 30 секунд:** «content-expert: long-form website (статьи 1500-4000 слов, 8 templates, SEO cluster, Schema). content-factory: короткие structured deliverables (КП 10 blocks, landing 10 sections, scripts 5 steps, posts).» PASS.

«Какой ROI от создания этих 12 типов контента?»
**НЕ ответить за 30 секунд:** skill не содержит ожидаемого SEO uplift / lead-gen modeling. Это допустимо для skill (это не business case), но при использовании content-expert на принятие решения «писать ли вообще», нужно дополнительно.

---

## Phase 3: 5-Criteria Score

### ACCURACY (вес 25%)

Numbers verified against source v8 line-by-line:
- ТУ ДомГласс размеры: 10/10 точны
- Технология (TIG, 650°C, AGC, RAL): 4/4 точны
- Партнёры (Mercury Hotel, AFY Development, SMINEX, SPACE 1, Aria Resort, Coffeeroom): correct
- Сроки (5-10 / 10-30 дней, КП 24ч): correct
- 27 000 заказов: aligned with v9 canon (vs v8 outdated 13 500)

Минусы:
- 350+ установок/проектов (lines 274, 277) без метки
- Толщина покрытия 80мкм узко (60-80 в v8)

**Score: 8.8/10**

### ACTIONABILITY (вес 25%)

- Workflow Part 12: 11 шагов, явно cделаваемый
- Pre-delivery checklist Part 11: 12 пунктов с binary check
- Numerical thresholds (≥3 чисел per H2, ≥5 ссылок, ≥2 CTA): measurable
- Шаг 12.5 включён как step 10
- Inline CTA каждые 600-800 слов: конкретный порог

Минусы:
- Нет negative scope («не использовать для X»)
- Microdata templates обещаны но не приведены (рендер-разработчик не сможет скопировать)

**Score: 8.5/10**

### INSIGHT (вес 20%)

- Rationale standalone vs extension content-factory: явный (line 12-16 + line 178 в content-factory cross-link). Convincing по типу артефакта.
- Pattern Dantone (Part 10): non-trivial mapping чужой архитектуры на GENGLASS
- Cluster architecture pillar+satellites: стандарт для SEO, но конкретные примеры (Стеклянные перегородки → 5 satellites) делают actionable
- Anti-patterns from Miralls audit (Part 1): useful negative knowledge

Минусы:
- Insight «когда long-form vs short-form» не объяснён через decision tree
- Нет рассуждения «когда заказчик скажет блог, а реально нужна КП», что обычно фейл точка
- Boundary case с content-factory не разобран

**Score: 7.5/10**

### BRAND FIT (вес 15%)

- Em dash count Unicode: 0 (target 0). PASS
- En dash count Unicode: 0 (target 0). PASS
- Anti-Slop blocklist v2 интегрирован Part 4
- Voice GENGROUP в самом skill: «измеримо превосходит», «без розовых очков», числа, конкретика. Без водянистого вступления. PASS
- Терминология v2.1: упомянута palette references не миксить, GGP-01/GGP-02 кодировка, brand codes RAL 9005/9003. PASS

Минусы:
- Quick reference brand modifiers Part 6 рискует контрабандой подменить полный brand skill, если агент проиньорирует «LOAD via brand skill»

**Score: 9.0/10**

### RISK AWARENESS (вес 15%)

- Hard rules Project Knowledge факты: Part 7 явно «Источники чисел: encyclopedia, product-facts.md, ТУ»
- Если числа нет: «запросить у Ивана или пометить [ДАННЫЕ: уточнить]», корректное P9 поведение
- Step 12.5 включён в workflow

Минусы:
- Risk-23 (overlap с content-factory): признан в шапке но НЕ имеет conflict-resolution rule. Что если выпадет задача «контентный блок для лендинга на 2500 слов»? content-expert или content-factory? GAP.
- Нет section «риски при overlap с geo-aeo» (Schema templates дублируются)
- Нет downside section для самого skill (если auto-invoke триггер ошибочный, блог-статья вместо КП)

**Score: 7.0/10**

---

## Weighted Total

| Критерий | Score | Вес | Contribution |
|---|---|---|---|
| Accuracy | 8.8 | 25% | 2.20 |
| Actionability | 8.5 | 25% | 2.13 |
| Insight | 7.5 | 20% | 1.50 |
| Brand fit | 9.0 | 15% | 1.35 |
| Risk awareness | 7.0 | 15% | 1.05 |
| **TOTAL** | | | **8.23 / 10** |

**Threshold: ≥7.5 = passed.**

---

## Top-5 Gaps (приоритизированы)

### GAP-1: Microdata templates для Яндекс не приведены (BLOCKER quality)

**Severity:** Medium-high
**Location:** Part 8 (Schema.org)
**Issue:** Шапка Part 8 рекомендует «ОБА формата JSON-LD + Microdata», но в файле только 6 JSON-LD examples. Microdata НЕТ. Если разработчик читает skill, он не сможет скопировать готовый шаблон под Яндекс.
**Fix:** Добавить 2-3 Microdata examples (Product + Article + FAQPage) или явно сослаться на `geo-aeo` skill: «Microdata templates: см. geo-aeo Part X».

### GAP-2: Conflict resolution с content-factory не определён (DRY/overlap risk)

**Severity:** Medium
**Location:** Header + Part 12 workflow
**Issue:** Riски-23. Бордеркейс «лендинг 3000 слов на сайте»: content-factory (lending = его format) или content-expert (>2000 слов = long-form)? Не разобрано. Аналогично «PR-статья 1500 слов в Тильду»: какой skill?
**Fix:** Добавить раздел «Boundary cases» с 5-7 примерами + decision rule:
- Long-form on website + SEO/AEO intent → content-expert
- Direct lead-gen + structured channels (КП, скрипт) → content-factory
- Лендинг: content-factory (он-то и есть format «landing page»)
- Длинная статья для PR → content-expert
- Email-кампания 500 слов → content-factory

### GAP-3: Negative scope statement отсутствует

**Severity:** Low-medium
**Location:** Header / Part 2 introduction
**Issue:** Skill говорит «обслуживает website articles» но не говорит «НЕ использовать для X». Это может вызвать misuse при auto-invoke.
**Fix:** В header добавить строку: «NOT for: КП, sales scripts, emails, short social posts, marketplace cards (use content-factory). NOT for: voice/brand spec (use brand skill).»

---

## Top-2 Minor Gaps (nice-to-fix)

### Minor 1: 350+ установок/проектов без `[ДАННЫЕ]` метки

Lines 274, 277, 278. Добавить `[ДАННЫЕ: brand/references/product-facts.md, требует verification из CRM]`.

### Minor 2: Толщина покрытия 80мкм вместо диапазона 60-80мкм

Line 238 anti-slop replacement сузил диапазон. Заменить на «60-80мкм по ГОСТ» или «толщина покрытия 80мкм (по верхней границе ТУ)».

---

## Phase 4: Debate

**Не требуется** (score 8.23 >= 8.0 threshold для GO без debate). Если автор pushback на GAP-1, дискуссия откроется.

---

## Phase 5: Verdict

```json
{
  "agent": "feniks",
  "task_id": "audit-content-expert-v2-step125",
  "deliverable_ref": ".claude/skills/content-expert/SKILL.md",
  "scores": {
    "accuracy": 8.8,
    "actionability": 8.5,
    "insight": 7.5,
    "brand_fit": 9.0,
    "risk_awareness": 7.0
  },
  "weighted_total": 8.23,
  "gaps": [
    "GAP-1: Microdata templates promised but not provided in Part 8",
    "GAP-2: No conflict-resolution rule for content-expert vs content-factory boundary cases",
    "GAP-3: No negative scope statement (NOT for КП/scripts/email)"
  ],
  "rework_tz": "1) Add 2-3 Microdata examples or explicit geo-aeo cross-reference in Part 8. 2) Add 'Boundary cases' section with 5-7 examples mapping query to skill (content-expert vs content-factory). 3) Add 'NOT for' line in header. 4) Add [ДАННЫЕ] tag to '350+ installations' on lines 274, 277, 278. 5) Restore 60-80мкм range for powder coating thickness on line 238.",
  "verdict": "go",
  "dispute_thread": null,
  "confidence": 0.86
}
```

**VERDICT: GO** (8.23 >= 7.5 threshold), но с обязательным rework по GAP-1 и GAP-2 в течение 48 часов. GAP-3 и minor: opportunistic, при следующем edit.

---

## P9 Hard Rules check

| Rule | Status |
|---|---|
| Em dash ban | PASS (0 Unicode em dash violations) |
| [ДАННЫЕ]/[ГИПОТЕЗА] метки | PARTIAL (2 числа без метки, minor) |
| «Уникальный актив» без механики | PASS (skill использует «измеримо превосходит» + 3 axis) |
| Diapason wider than 2x | PASS (диапазоны цен и сроков в пределах) |
| Бюджет >200K на гипотезе | N/A (skill не финансовый) |
| ROMI >50x без unit-эк | N/A |

---

## Inter-skill consistency

| Skill | Conflict | Note |
|---|---|---|
| content-factory | overlap risk | См. GAP-2 |
| brand | OK | Cross-link явный, quick-reference disclaimer |
| encyclopedia / encyclopedia-router | OK | Cross-link в Part 7 |
| geo-aeo | schema overlap | См. GAP-1 + Schema.org templates могут жить в geo-aeo |
| humanizer-ru | OK | Cross-link в Part 4 |
| phoenix-eval | OK | Step 10 в workflow |
| competitor-intel | OK | Cross-link в Part 1 anti-patterns |

---

**Auditor sign-off:** ФЕНИКС #35
**Next review trigger:** при первом merge изменения, добавление новых templates, или conflict с content-factory boundary
