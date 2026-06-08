# GENGROUP AI MASTER SYSTEM v8.0 PRO

## CHANGELOG vs v7.0 (20 пунктов)

**Дата:** Март 2026 | **Статус:** APPROVED (ФЕНИКС 9.8/10)

---

### НОВЫЕ СКИЛЛЫ (+4)

**1.** +gengroup-humanizer-ru v1.0 - 30 русских AI-паттернов в 5 блоках (канцелярит, significance inflation, promotional, структурные, разное). Каждый с before/after. Em dash ban. Двойной финальный проход.

**2.** +gengroup-competitor-intel v1.0 - конкуренты по 5 брендам с ценами, скриптами отработки, сравнительными преимуществами. Автотриггер при упоминании любого конкурента.

**3.** +gengroup-geo-aeo v1.0 - 7-пунктовый чек-лист AI-видимости для ChatGPT/Perplexity/YandexGPT. Entity Markup, FAQ-структура, Citation-Worthy Facts. Приоритет: GLASS-MEMORY (незанятая ниша). Привязка к CC-09.

**4.** +gengroup-crisis-response v1.0 - Protocol 8 как исполняемый скилл. 6 триггеров с порогами и ответственными. Шаблон Плана Б. Типовые сценарии. Механизм эскалации Богдану.

### АПГРЕЙДЫ СУЩЕСТВУЮЩИХ СКИЛЛОВ (x4)

**5.** phoenix-eval v1.0 -> v1.1: +references/benchmarks.md (отраслевые CR, CAC, LTV, EBITDA с pessimistic/optimistic диапазонами), +references/dispute-template.md (формат диспута с раундами), +inter-skill feedback loop.

**6.** content-factory v1.0 -> v1.1: +references/channels.md (Telegram, VK, Дзен, Email, OZON/WB - лимиты, best practices, антипаттерны), +placeholder golden-examples.md (заполняется Иваном).

**7.** brand v1.0 -> v1.1: version bump, подготовка к screenshot-gallery.md.

**8.** encyclopedia v1.0 -> v1.1: version bump, подготовка к меткам версий документов.

### НОВЫЕ ПРОТОКОЛЫ (+2)

**9.** +Protocol 9: SKILL LIFECYCLE - каждый скилл имеет версию, дату, статус (active/outdated/deprecated). ФЕНИКС проверяет раз в месяц. Устарело >60 дней = requires-update. Inter-skill feedback: если ФЕНИКС 3x находит одну проблему - обновляется чек-лист скилла-источника.

**10.** +Protocol 10: OUTPUT ROUTING - формализация: запрос -> формат -> platform skill. КП дилеру = DOCX. Лендинг = HTML. Дашборд = React. Презентация = PPTX. Карточка МП = текст.

### НОВЫЙ COUNCIL CONFIGURATION (+1)

**11.** +CC-16: SKILL GOVERNANCE - состав: ИЛЬЯ #33 + АЛЕКС #2 + ФЕНИКС #35. Миссия: ежемесячный аудит скиллов. Ceiling: 15 user skills max (обосновано: ~5-7% контекста при полной загрузке).

### АРХИТЕКТУРНЫЕ РЕШЕНИЯ

**12.** Формальное разделение: Роли (36 агентов, остаются в DOCX) vs Процессы (скиллы SKILL.md, устанавливаются глобально). Роль = кто думает. Скилл = как делает.

**13.** Таблица маппинга Агент -> Скиллы (16 ключевых агентов привязаны к primary/secondary skills).

**14.** Dependency Graph: 4 уровня зависимостей (Level 0 = нет зависимостей, Level 3 = post-MCP infrastructure).

**15.** Ceiling: 15 user skills max. Обоснование: 15 описаний x 100 токенов = 1 500 токенов metadata + 3 загруженных x 8 000 = ~25 500 токенов = 5-7% от 200K-1M контекста.

**16.** JARVIS || MCP: JARVIS (n8n + Python) ПИШЕТ (действия, триггеры, цепочки). MCP-серверы ЧИТАЮТ (данные CRM, аналитика, карточки). Не дублируют. Развиваются параллельно.

**17.** Reserved slots #11-12: gengroup-pricing-engine + gengroup-rlaif-feedback. Создаются ТОЛЬКО после Bitrix24 MCP (Q3-2026) или CSV fallback.

### ИТОГО v8.0

**18.** 10 protocols (8 из v7.0 + Protocol 9 Skill Lifecycle + Protocol 10 Output Routing)

**19.** 16 Council Configurations (15 из v7.0 + CC-16 Skill Governance)

**20.** 36 агентов (без изменений - роли стабильны), 10 active user skills + 2 reserved

---

## ПОЛНАЯ АРХИТЕКТУРА v8.0 PRO

### 10 Active User Skills

| # | Skill | Version | Status | Files |
|---|---|---|---|---|
| 1 | gengroup-brand | 1.1.0 | active | SKILL.md + 2 references |
| 2 | gengroup-content-factory | 1.1.0 | active | SKILL.md + 2 references + 1 placeholder |
| 3 | gengroup-cross-sell | 1.0.0 | active | SKILL.md |
| 4 | gengroup-phoenix-eval | 1.1.0 | active | SKILL.md + 2 references |
| 5 | gengroup-encyclopedia | 1.1.0 | active | SKILL.md |
| 6 | humanizer (EN) | 2.3.1 | active | SKILL.md + WARP.md |
| 7 | gengroup-humanizer-ru | 1.0.0 | **NEW v8.0** | SKILL.md |
| 8 | gengroup-competitor-intel | 1.0.0 | **NEW v8.0** | SKILL.md |
| 9 | gengroup-geo-aeo | 1.0.0 | **NEW v8.0** | SKILL.md |
| 10 | gengroup-crisis-response | 1.0.0 | **NEW v8.0** | SKILL.md |

### 2 Reserved Slots

| # | Skill | Blocker | ETA |
|---|---|---|---|
| 11 | gengroup-pricing-engine | Bitrix24 MCP или CSV fallback | Q3-2026 |
| 12 | gengroup-rlaif-feedback | Bitrix24 MCP + 90 дней данных | Q4-2026 |

### Agent -> Skill Mapping

| Агент | Primary Skills | Secondary Skills |
|---|---|---|
| МАРКО #1 (CMO) | content-factory, geo-aeo, competitor-intel | brand, phoenix-eval |
| МАКС #3 (Copy) | content-factory, humanizer-ru, brand | humanizer-en |
| ЗАРА #4 (SMM) | content-factory, humanizer-ru | brand, geo-aeo |
| ФЁДОР #6 (CustDev) | cross-sell, competitor-intel | content-factory |
| ЭММА #7 (Packaging) | brand, content-factory | cross-sell |
| БОРИС #11 (CRM) | cross-sell, encyclopedia | pricing-engine (future) |
| ВИКТОР #13 (Scripts) | content-factory, competitor-intel | humanizer-ru |
| СЕМЁН #17 (AI Vis.) | geo-aeo | competitor-intel |
| КРЕА #19 (Creative) | brand, humanizer-ru | content-factory |
| ВИЗУАЛ #20 (Visual) | brand | frontend-design |
| СПАРТАК #21 (Orch.) | ВСЕ (маршрутизация) | - |
| РОМАН #30 (CFO) | crisis-response | phoenix-eval |
| ФЕНИКС #35 (Audit) | phoenix-eval | competitor-intel, encyclopedia |
| ТРЕНЕР #36 (L&D) | content-factory, encyclopedia | brand |
| Tech #22-28 | frontend-design, brand (CSS) | encyclopedia |
| ДАТА #29 | encyclopedia | phoenix-eval, rlaif (future) |

### Dependency Graph

```
LEVEL 0 — нет зависимостей, делается сейчас:
  humanizer EN v2.3.1 ............ done
  humanizer RU v1.0 .............. done
  brand v1.1 ..................... done
  encyclopedia v1.1 .............. done
  phoenix-eval v1.1 .............. done
  competitor-intel v1.0 .......... done
  cross-sell v1.0 ................ done
  content-factory v1.1 ........... done (placeholder golden-examples)
  crisis-response v1.0 ........... done
  geo-aeo v1.0 ................... done

LEVEL 1 — зависит от данных Ивана:
  content-factory golden-examples .. Иван: 5 лучших КП + 3 лендинга -> апрель 2026
  competitor-intel верификация ..... Наташа: проверка цен -> апрель 2026
  crisis-response пороги .......... Богдан: утверждение -> апрель 2026

LEVEL 2 — стратегическое решение:
  geo-aeo приоритет ниши .......... Иван: GLASS-MEMORY first? -> май 2026

LEVEL 3 — инфраструктура:
  pricing-engine .................. Bitrix24 MCP или CSV fallback -> Q3-2026
  rlaif-feedback .................. Bitrix24 MCP + 90 дней данных -> Q4-2026

JARVIS || MCP:
  JARVIS = пишет (n8n middleware, действия)
  MCP = читает (данные для Claude)
  Не дублируют. Развиваются параллельно.
```

---

## Установка

### Все 10 .skill файлов:
1. Claude.ai -> Settings -> Skills -> Add skill
2. Загрузить каждый .skill файл
3. Скиллы работают ГЛОБАЛЬНО во всех чатах и проектах

### Humanizer EN:
Если уже установлен - не трогать. Если нет - установить humanizer.skill.
В description добавлено: «for English. For Russian use gengroup-humanizer-ru»

### Cowork Migration (H2-2026):
- .skill формат совместим с Cowork plugins
- При GA: создать plugin bundle «GENGROUP Marketing» = 10 skills + connectors
- Private GitHub repo для хранения (Cowork private beta supports GitHub as plugin source)
- Текущие skills НЕ требуют переписывания

---

## Open Items

| Item | Owner | Deadline | Status |
|---|---|---|---|
| Golden examples для content-factory | Иван | Апрель 2026 | pending |
| Верификация цен конкурентов | Наташа | Апрель 2026 | pending |
| Пороги crisis-response | Богдан | Апрель 2026 | pending |
| GEO/AEO приоритет ниши | Иван | Май 2026 | pending |
| Screenshot gallery для brand | Иван | Апрель 2026 | pending |
| MASTER SYSTEM v8.0 DOCX | Claude + Иван | Май 2026 | pending |
