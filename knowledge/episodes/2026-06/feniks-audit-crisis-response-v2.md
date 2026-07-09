# FENIX Audit Report - crisis-response skill (v9 post-atomization)

**Auditor:** ФЕНИКС #35
**Timestamp:** 2026-06-08
**Target:** `/home/user/t1/.claude/skills/crisis-response/SKILL.md`
**Source comparison:** `/home/user/t1/incoming-skills/unpacked/gengroup-crisis-response/SKILL.md`
**Atomization iter-1 ref:** A6.1-A6.4 (crisis-response, MERGED, 4 atoms)
**Method:** phoenix-eval 25-checkpoint matrix + 5-criteria weighted scoring
**Threshold for GO:** ≥7.5/10

---

## Phase 1: CROSS-CHECK

| Источник | Согласованность | Примечание |
|---|---|---|
| `CLAUDE.md` §2, §11 (decision tree) | OK | crisis -> /crisis -> spartak + feniks + roman + emma; полное совпадение |
| `CLAUDE.md` §9 HITL | OK | «Финансы >500K Ивана approval» соблюдается через Phase 4 deliver Ивану + Богдану |
| `CLAUDE.md` §13 «Не пропускать Step 12.5» | OK | Phase 3 явно фиксирует FENIX gate в кризисе |
| `.claude/commands/crisis.md` | OK | Slash command зеркалит Phase 0->4; ссылки на CC-15 совпадают |
| `.claude/agents/spartak.md` CC-15 | OK | `feniks + roman + emma + профильный` совпадает |
| `.claude/agents/roman.md` cash flow workflow | OK | 0-30 мин -> 30мин-4ч -> Plan B; same timings |
| v8 source `gengroup-crisis-response` | DELTA | v8 содержал «ОЛЬГА #32», v9 заменён на `emma` (active roster). Корректная миграция. |
| 6 triggers vs CLAUDE.md P8 | OK | Все 6 пунктов совпадают по формулировке и порогам |
| Plan B template vs v8 | OK | Template дословно перенесён, em dashes заменены на дефисы |
| Em dash audit (Brand-18) | OK | `grep dash-count` = 0 в target file (v8 имел 6 em dash) |

**Cross-check verdict:** все 4+ источника проверены, противоречий не найдено. Замена ОЛЬГА -> ЭММА консистентна с v9 active roster (12 агентов).

---

## Phase 2: 25-Checkpoint Phoenix-Eval

### Block A: ACCURACY (5 checkpoints, weight 25%)

| # | Checkpoint | Verdict | Score |
|---|---|---|---|
| A1 | Все цифры verified (timings, пороги) | PASS - T+0:00->T+24:00 фактически из CLAUDE.md; 2 нед расходов, >3% рекламаций, <80% × 2 нед - совпадают с §5 P8 | 9.5 |
| A2 | Источники указаны | PARTIAL - «Source-of-truth для cash: 1С (через ДАТА)» указан; ссылки на CC-15/CLAUDE.md есть; но Plan B template не помечен `[ШАБЛОН]` | 8.0 |
| A3 | Нет противоречий с RAG (CLAUDE.md, semantic/) | PASS - 6 триггеров идентичны §5 CLAUDE.md | 9.5 |
| A4 | Терминология v2.1 | PASS - используется СПАРТАК/ФЕНИКС/РОМАН/ЭММА; aviation-style фазы Phase 0-4 | 9.0 |
| A5 | Все факты verifiable | PARTIAL - «компенсационная коммуникация» T4 не определена количественно (% скидки, сроки) | 7.5 |

**ACCURACY = (9.5+8.0+9.5+9.0+7.5)/5 = 8.7**

### Block B: ACTIONABILITY (5 checkpoints, weight 25%)

| # | Checkpoint | Verdict | Score |
|---|---|---|---|
| B1 | Назначены ответственные | PASS - в Phase 1 указаны ФЕНИКС/РОМАН/ЭММА с конкретными scope | 9.0 |
| B2 | Тайминги реалистичны | PARTIAL - Phase 1 ФЕНИКС «30 мин на scope» и РОМАН «1-2ч cash position» при условии что 1С доступен. Не указано что делать если 1С недоступен | 7.0 |
| B3 | Кост/бюджет определён | PASS - Best/Expected/Downside с границами ≤50K / 50-300K / >300K | 8.5 |
| B4 | Decision tree чёткий | PASS - Escalation matrix L1-L4 с конкретными триггерами и временем реакции | 9.0 |
| B5 | Deliverables конкретны | PASS - Plan B template inline + post-mortem path + daily standup | 9.0 |

**ACTIONABILITY = (9.0+7.0+8.5+9.0+9.0)/5 = 8.5**

### Block C: INSIGHT (5 checkpoints, weight 20%)

| # | Checkpoint | Verdict | Score |
|---|---|---|---|
| C1 | Нетривиальные элементы | PASS - Phase 3 «FENIX gate даже в кризисе» нестандартно; «no PR/social during crisis» = отрицательная инструкция полезна | 8.5 |
| C2 | Второй порядок учтён | PARTIAL - «Downstream effects» в Phase 1 ФЕНИКС есть, но нет cross-effects: например, T2 (Loss РОПа) может триггерить T6 (Revenue <80%) - не указано | 6.5 |
| C3 | Не консенсус | PASS - «24 часа - не 25» жёстко; «Daily standup иначе кризис не активен» - анти-консенсус | 8.5 |
| C4 | Templates пригодны без модификации | PASS - Plan B template ready-to-use; sub-scenarios T2/T4/T6 имеют day-by-day actions | 8.5 |
| C5 | Anti-patterns обозначены | PASS - hard rules перечисляют 5 запретов | 8.5 |

**INSIGHT = (8.5+6.5+8.5+8.5+8.5)/5 = 8.1**

### Block D: BRAND FIT (5 checkpoints, weight 15%)

| # | Checkpoint | Verdict | Score |
|---|---|---|---|
| D1 | Voice & tone GENGROUP | PASS - «brutal honesty» и «specificity over poetry» соблюдены; никаких «уважаемых клиентов» | 9.5 |
| D2 | Em dash count = 0 (Brand-18) | PASS - grep подтверждает 0 em dashes | 10.0 |
| D3 | Anti-Slop blocklist чисто | PASS - проверил «уникальный», «эффективный», «оптимальный» - не найдено | 9.5 |
| D4 | Терминология агентов корректна | PASS - все 4 агента CC-15 присутствуют, slash command синхронизирован | 9.5 |
| D5 | Русский formal-but-warm | PASS - «callout по неоплаченным КП», «не email - direct message» - живой язык | 9.0 |

**BRAND FIT = (9.5+10.0+9.5+9.5+9.0)/5 = 9.5**

### Block E: RISK AWARENESS (5 checkpoints, weight 15%)

| # | Checkpoint | Verdict | Score |
|---|---|---|---|
| E1 | Downside scenario озвучен | PASS - Downside Case (>30 дней, >300K, structural change) явно | 9.0 |
| E2 | P9 hard rules не нарушены | PASS - нет розовых очков (pink-glasses lexicon); цифры явные | 9.5 |
| E3 | Escalation paths полны | PARTIAL - L4 (system error в публичном канале) определён, но нет L5 (Ивана нет на связи >4ч) - кто принимает решения? | 7.0 |
| E4 | Kill criteria есть | PARTIAL - hard rules есть, но нет explicit kill criteria «прекращаем Plan B и идём в L4 если...» | 7.0 |
| E5 | Communication risk учтён | PASS - «no PR/social during crisis»; ЭММА roles на Phase 1 и T4 | 9.0 |

**RISK AWARENESS = (9.0+9.5+7.0+7.0+9.0)/5 = 8.3**

---

## Phase 3: Weighted Score

| Block | Score | Weight | Contribution |
|---|---|---|---|
| ACCURACY | 8.7 | 25% | 2.175 |
| ACTIONABILITY | 8.5 | 25% | 2.125 |
| INSIGHT | 8.1 | 20% | 1.620 |
| BRAND FIT | 9.5 | 15% | 1.425 |
| RISK AWARENESS | 8.3 | 15% | 1.245 |
| **WEIGHTED TOTAL** | | | **8.59** |

**Confidence:** 0.86

---

## Phase 4: Dispute (skipped - score ≥8.0, no debate trigger)

Не требуется. Если бы score был <8.0, оппонировал бы по INSIGHT-C2 (cross-trigger effects не учтены).

---

## Phase 5: Gaps

### Top-3 gaps (приоритезированы)

1. **Cross-trigger effects не описаны (INSIGHT-C2, score 6.5):** Один триггер часто запускает следующий (T2 Loss РОПа -> T6 Revenue <80% через 2-3 недели; T3 Channel block -> T1 Cash gap). Skill рассматривает каждый триггер изолированно. Нужен раздел «Cross-trigger correlation map» (минимум 6 пар).

2. **Continuity gap при недоступности Ивана / отказе 1С (RISK-E3, ACTIONABILITY-B2, score 7.0):** Phase 1 РОМАН требует выгрузку из 1С (1-2ч). Что если 1С недоступен (T3-class инцидент)? Phase 4 deliver Ивану + Богдану. Что если Иван offline >4ч? Нужен L5 escalation: «авто-delegation to Богдан if Иван silent >4h в T+ окне» + manual cash position fallback (банк-клиент + последние выписки).

3. **Explicit kill criteria для Plan B отсутствуют (RISK-E4, score 7.0):** Hard rules есть, но не сформулировано «когда мы признаём что Plan B не работает и переключаемся на Plan C». Предлагаемые критерии: (a) score <5.0 на Phase 3, (b) downside scenario материализуется на день 7, (c) cash position падает ниже 1 недели расходов после Phase 4.

### Minor gaps

- **A2:** Plan B template не помечен версионно (рекомендую `[TEMPLATE v1.0 - 2026-06]`)
- **A5:** T4 «компенсационная коммуникация» без количественной рамки (% скидки/сроки бесплатной замены)
- **Plan B template** в задаче упомянут как inline + отдельный файл `knowledge/semantic/templates/plan-b-template.md` per atomization verdict A6.4. Inline есть, но папки `knowledge/semantic/templates/` нет. Нужно либо создать template файл, либо удалить из atomization plan.

---

## Phase 6: Rework TZ

### Обязательно перед GO (если threshold = 8.0, то skill уже passed; ниже - рекомендации для score >9.0):

1. Добавить раздел «Cross-trigger correlation map» (6 пар T#->T#) после раздела «Sub-scenarios»
2. Добавить L5 escalation row в Escalation Matrix: «Иван offline >4ч в активной Phase» -> auto-delegate Богдану
3. Добавить раздел «Kill criteria Plan B -> Plan C transition» (3 критерия выше)
4. Создать `knowledge/semantic/templates/plan-b-template.md` (extract из inline) ИЛИ убрать упоминание из atomization plan
5. Параметризовать T4 «компенсационная коммуникация»: «discount 5-15% или free replacement в 14 дней»

### Опционально (для +0.3-0.5 балла):

- Добавить link в каждый sub-scenario на соответствующий agent для delegation (T2 -> viktor, T4 -> boris, T6 -> roman+marco)
- Time-zone стандарт для T+0:00 (Москва UTC+3) - явно зафиксировать

---

## Phase 7: Verdict

```json
{
  "agent": "feniks",
  "task_id": "audit-crisis-response-2026-06-08",
  "deliverable_ref": "/home/user/t1/.claude/skills/crisis-response/SKILL.md",
  "scores": {
    "accuracy": 8.7,
    "actionability": 8.5,
    "insight": 8.1,
    "brand_fit": 9.5,
    "risk_awareness": 8.3
  },
  "weighted_total": 8.59,
  "gaps": [
    "Cross-trigger correlation map отсутствует (INSIGHT)",
    "L5 escalation для unavailable Иван не определён (RISK)",
    "Explicit kill criteria Plan B -> Plan C отсутствуют (RISK)",
    "Plan B template файл по atomization plan не создан (minor)",
    "T4 компенсация без числовой рамки (ACCURACY)"
  ],
  "rework_tz": "5 рекомендаций перечислены выше. Все - improvement, не блокер. Skill готов к use as-is.",
  "verdict": "go",
  "dispute_thread": null,
  "confidence": 0.86,
  "threshold_check": "8.59 >= 7.5 = PASS",
  "notes": "v8 -> v9 atomization успешен. Em dash sweep clean (0 dashes vs 6 в v8). ОЛЬГА -> ЭММА миграция корректна для v9 active roster. Phase timings и 6 triggers сохранены. Plan B template перенесён."
}
```

---

## Phase 8: Sign-off

**Verdict:** GO. Skill `crisis-response` готов к activation.

**Quality delta vs v8:**
- v8 был «doc-style» Wiki (Шаг 1-5). v9 - executable Protocol с timings.
- v8 имел 6 em dashes - sanitized to 0.
- v8 не имел Phase 3 (FENIX gate в кризисе). v9 добавляет это явно.
- v8 не имел Escalation Matrix L1-L4. v9 добавляет.
- v9 содержит больше sub-scenarios (T2/T4/T6 day-by-day) чем v8.

**Recommended next:**
1. Rework TZ можно сделать в отдельной iteration (не блокер)
2. Pre-prod test: симуляция кризиса T1 (cash gap) - прогнать через workflow и измерить actual time-to-Plan-B
3. После 1-го реального кризиса - mandatory iter-3 audit с post-mortem feedback

**Sign:** ФЕНИКС #35 · 2026-06-08
