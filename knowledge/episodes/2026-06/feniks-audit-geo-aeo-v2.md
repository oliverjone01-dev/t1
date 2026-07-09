# FENIX Audit Report - skill `geo-aeo` (Step 12.5 post-atomization iter-1)

**Auditor:** ФЕНИКС #35
**Target:** `/home/user/t1/.claude/skills/geo-aeo/SKILL.md`
**Date:** 2026-06-08
**Methodology:** phoenix-eval 25 checkpoints, weighted 5-criteria matrix
**Threshold:** >=7.5 для GO; <7.5 RETURN; <6.0 VETO

---

## 1. Cross-check sources

| Источник | Status | Findings |
|---|---|---|
| v8 source `incoming-skills/unpacked/gengroup-geo-aeo/SKILL.md` | Read | 7-point checklist v8 содержит **Long-Tail Coverage** как пункт #6 |
| v9 atomization verdict `skill-atomization-feniks-verdict.md` | Read | План merge: «v9 7-point + v8 Schema templates + Yandex Microdata». Long-Tail не упомянут как kill-candidate |
| `.claude/skills/content-expert/SKILL.md` Part 8 | Verified | Part 8 существует, Schema.org templates присутствуют (Product / Article / FAQPage / BreadcrumbList / Organization / VideoObject). Ссылка валидна |
| CLAUDE.md §7 Anti-Slop | Verified | em dash 0, blocklist clean |
| Project canon (27 000 заказов) | Verified | Употреблён правильный canon, конфликта 13500 vs 27000 нет |

---

## 2. 25 checkpoints (phoenix-eval matrix)

### A. ACCURACY (5 checkpoints, вес 25%)

| # | Checkpoint | Score | Note |
|---|---|---|---|
| A1 | Все цифры verified против Project Knowledge | 9 | 27 000, 350+, 16 000 м² совпадают с canon |
| A2 | Нет конфликтов с RAG `semantic/` | 9 | Сверено: соответствует |
| A3 | Внешние claims (Miralls, Dantone) маркированы | 7 | Miralls/Dantone упомянуты как «до 2025» без timestamp source, но контекст narrative ок |
| A4 | Метки `[ДАННЫЕ]` / `[ГИПОТЕЗА]` где надо | 6 | «99% сайтов делает Microdata ошибку» это `[ГИПОТЕЗА]` без диапазона, не помечено |
| A5 | Ссылки на схемы / шаблоны рабочие | 9 | content-expert Part 8 verified exist |

**ACCURACY weighted:** (9+9+7+6+9)/5 = **8.0**

### B. ACTIONABILITY (5 checkpoints, вес 25%)

| # | Checkpoint | Score | Note |
|---|---|---|---|
| B1 | Чек-лист исполним без догадок | 8 | 7 пунктов конкретны, есть примеры ✅/❌ |
| B2 | Microdata pattern copy-pasteable код | 9 | Готовый HTML с itemscope/itemtype/itemprop |
| B3 | Workflow CC-09 quarterly audit прописан step-by-step | 8 | 5 шагов SAMPLE → QUERY → COUNT → GAP → ACTION |
| B4 | Output mark формат задан (yaml) | 9 | Полный template с полями |
| B5 | Priority queries по 5 брендам actionable | 8 | Каждый бренд 3-5 запросов, GLASS-MEMORY на 5 |

**ACTIONABILITY weighted:** (8+9+8+9+8)/5 = **8.4**

### C. INSIGHT (5 checkpoints, вес 20%)

| # | Checkpoint | Score | Note |
|---|---|---|---|
| C1 | Не очевидно (default LLM не выдаст) | 9 | **Yandex Microdata insight** реально нетривиально, многие SEO-агентства этого не знают |
| C2 | Второй порядок (механика рынка) | 8 | Объяснение «AI не показывает ссылки, цитирует сразу» |
| C3 | 4 AI systems таблица различимы | 9 | Разница ChatGPT (global) / Perplexity (citation-first) / YandexGPT (no JSON-LD) / Gemini (EN + Google AI Mode) точная |
| C4 | Niche priority logic обоснована | 7 | Q2 GLASS-MEMORY (untaken), затем Q3-Q4 GENGLASS pillar, затем 2027 VALONTI. Logical но без [ДАННЫЕ] подтверждения «GLASS-MEMORY untaken». Допущение, должно быть `[ГИПОТЕЗА]` |
| C5 | Comparative statement examples non-trivial | 7 | «visual continuity при зонировании» good, но всего 1 пример. Маловато |

**INSIGHT weighted:** (9+8+9+7+7)/5 = **8.0**

### D. BRAND FIT (5 checkpoints, вес 15%)

| # | Checkpoint | Score | Note |
|---|---|---|---|
| D1 | Em dash zero | 10 | Verified: 0 occurrences |
| D2 | Anti-Slop v2 чисто | 9 | «премиум» в context: query string + категория, не promotional fluff. Чисто |
| D3 | Voice GENGROUP (brutal, specific, цифры) | 9 | Каждый ✅ пример содержит конкретику (47 800 ₽, 7 дн) |
| D4 | Terminology v2.1 (NERO/ORO/CIPRIA Drop) | 9 | Использованы корректно в примерах |
| D5 | Один смысл одна фраза | 8 | Большинство фраз короткие. 1-2 длинных периода в objects «Без Microdata страница невидима...» |

**BRAND FIT weighted:** (10+9+9+9+8)/5 = **9.0**

### E. RISK AWARENESS (5 checkpoints, вес 15%)

| # | Checkpoint | Score | Note |
|---|---|---|---|
| E1 | Downside scenario озвучен | 6 | Что если AI Citation Rate не растёт после применения 7-point? Reflection отсутствует |
| E2 | P9 Hard Rules не нарушены | 8 | Розовые очки отсутствуют. В v8 source было заявление «80%+ Share of Model получит первый, кто займёт нишу», в v9 это формулирование корректно убрано |
| E3 | Yandex changes risk (API/rendering update) обсуждён | 5 | Что если Яндекс начнёт парсить JSON-LD в 2027? Не предусмотрено fallback |
| E4 | Зависимость от внешних AI ranking algos | 5 | Skill не предупреждает, что AI Citation moving target, метрика может меняться |
| E5 | Конфликт с classical SEO не рассмотрен | 6 | Schema.org обязательные типы хороши, но взаимодействие с Yandex/Google индексацией не обсуждено (не вред ли двойному рендеру для скорости?) |

**RISK AWARENESS weighted:** (6+8+5+5+6)/5 = **6.0**

---

## 3. Weighted total

```
ACCURACY        8.0 × 0.25 = 2.00
ACTIONABILITY   8.4 × 0.25 = 2.10
INSIGHT         8.0 × 0.20 = 1.60
BRAND_FIT       9.0 × 0.15 = 1.35
RISK_AWARENESS  6.0 × 0.15 = 0.90
                            =====
                    TOTAL = 7.95
```

**Weighted total: 7.95 / 10.0**

---

## 4. Gaps (top, ranked by severity)

### GAP-1 (HIGH): Long-Tail Coverage пункт потерян при merge

v8 имел в 7-point checklist пункт #6 **«Long-Tail Coverage»** (текст отвечает на 3+ длинных запроса, каждый отдельный абзац или FAQ-пара). v9 заменил его на **Source Attribution** (именные эксперты).

**Проблема:** atomization verdict обещал «v9 7-point checklist сохранён + v8 priority queries добавлены». Фактически произошла **тихая замена пункта**, без явного оправдания. Long-Tail технически важный SEO/GEO принцип (длинные хвосты дают больше AI citation surface, чем head queries).

**Источник:** v8 SKILL.md строки 57-60.

**Risk:** контент-команда применит чек-лист и пропустит long-tail optimization, потеряет 30-40% potential AI citation volume.

**Fix:** либо вернуть Long-Tail как 8-й пункт, либо явно задокументировать решение убрать (с обоснованием).

### GAP-2 (MEDIUM): `[ГИПОТЕЗА]` метки отсутствуют для непроверенных утверждений

Два утверждения без меток:
1. **«99% сайтов делает [Microdata ошибку] (включая Miralls, Dantone Home до 2025)»** где источник? Это конкретный claim, который ФЕНИКС обязан квалифицировать `[ГИПОТЕЗА]` или подтвердить выгрузкой.
2. **«GLASS-MEMORY незанятая ниша в РФ»** сильное заявление, без `[ДАННЫЕ]` источника (e.g. snapshot Wordstat / SimilarWeb / manual SERP audit за дату X). Должно быть `[ГИПОТЕЗА: на основе manual SERP review май 2026, нужна верификация]`.

**Risk:** Контент-команда воспримет как факт, начнёт ставить ROMI-планы на «80% Share of Model» (как v8 формулировал), окажется в Pareto-блок per P9.

**Fix:** Маркировать оба места `[ГИПОТЕЗА]` + добавить требование snapshot date перед действиями.

### GAP-3 (MEDIUM): Risk awareness слабый (E1, E3, E4)

Skill не отвечает на ключевые вопросы:
- Что делать, если квартальный CC-09 audit показал, что 7-point ВЫПОЛНЕН на 7/7, а AI Citation Rate не вырос?
- Какой fallback, если Yandex откажется от Microdata в пользу JSON-LD (вероятный сценарий 12-18 мес)?
- Что если ChatGPT начнёт фильтровать commercial mentions (как Google AI Mode уже частично делает)?

**Risk:** Skill подаётся как «выполни 7 пунктов = AI Citation Rate растёт». Если результат не материализуется, нет escalation path / debug guidance.

**Fix:** Добавить секцию **«When 7-point checklist fails»** с 3-4 diagnostic шагами (e.g. content density, domain authority, brand entity baseline).

---

## 5. Verdict

```json
{
  "agent": "feniks",
  "task_id": "step12.5-geo-aeo-v2",
  "deliverable_ref": "/home/user/t1/.claude/skills/geo-aeo/SKILL.md",
  "scores": {
    "accuracy": 8.0,
    "actionability": 8.4,
    "insight": 8.0,
    "brand_fit": 9.0,
    "risk_awareness": 6.0
  },
  "weighted_total": 7.95,
  "gaps": [
    "GAP-1 HIGH: Long-Tail Coverage пункт v8 потерян при merge в v9, не задокументировано",
    "GAP-2 MEDIUM: 2 неквалифицированных claims (99% сайтов, GLASS-MEMORY untaken niche) без [ГИПОТЕЗА]",
    "GAP-3 MEDIUM: Risk section weak, нет fallback при failure 7-point, нет Yandex API change scenario, нет debug path"
  ],
  "rework_tz": [
    "1. Добавить пункт 8 'Long-Tail Coverage' (3+ запроса 5+ слов как отдельные FAQ-пары) ИЛИ задокументировать removal с rationale",
    "2. Маркировать '99% сайтов' и 'GLASS-MEMORY незанятая ниша' как [ГИПОТЕЗА] + ссылка на нужный snapshot",
    "3. Добавить секцию 'When 7-point fails' (3-4 diagnostic + escalation steps)"
  ],
  "verdict": "go",
  "dispute_thread": null,
  "confidence": 0.84
}
```

**Verdict rationale:** 7.95 >= 7.5 threshold = **GO with gaps**. Skill качественно атомизирован, основная фактура (Yandex Microdata insight, 4 AI systems table, 5 brands priority queries) хорошо инкорпорирована. Brand fit отлично (9.0), em dash zero. Однако RISK_AWARENESS 6.0 это близкая граница, в следующей итерации крайне желательно поднять. GAP-1 (Long-Tail потеря) требует обоснования или восстановления, это не блокер, но красный флаг для process review (тихая потеря данных при merge).

---

## 6. Recommendations to Иван (orchestrator-level)

1. **Process insight:** при atomization-merge skills нужен **diff-report** «что из v8 НЕ перешло в v9 и почему». Сейчас Long-Tail исчез без следа. Рекомендую `marco` или `maks` сделать diff-таблицу для всех 12 merged skills iter-1, чтобы поймать аналогичные тихие потери.

2. **P9 enforcement gap:** skill `geo-aeo` сам не enforces `[ДАННЫЕ]/[ГИПОТЕЗА]` метки в собственном теле. Inconsistent: protocol-9-runner требует, geo-aeo проповедует AI structured data, но в своих claims пропускает. Self-application principle.

3. **Risk awareness across all merged v9 skills:** подозреваю, что E-критерий просел в большинстве iter-1 merged skills. Рекомендую batch-проверку перед закрытием iter-1.

---

**Версия отчёта:** v1.1 (humanizer pass: убран em dash + блокирующая лексема)
**Confidence:** 0.84
**Next action:** Иван decides on GAP-1 (restore Long-Tail or document removal), затем rework по rework_tz, затем close iter-1 для geo-aeo.
