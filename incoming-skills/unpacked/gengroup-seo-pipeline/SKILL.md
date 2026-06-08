---
name: gengroup-seo-pipeline
description: |
  Автоматизированный SEO контент-конвейер GENGROUP через n8n. Три workflow:
  Semantic Harvester (Keys.so), Content Forge (Claude API), AI Visibility
  Monitor (Share of Model). КРИТИЧНО: автопубликация ОТКЛЮЧЕНА -
  менеджер/контент-маркетолог всегда в цепочке. n8n генерирует, человек
  проверяет и публикует. Содержит: спецификации workflow, system prompts
  для Claude API, шаблоны Google Sheets, конфигурацию нод.
  Триггеры: n8n SEO, автоматизация контента, pipeline, workflow SEO,
  Content Forge, Semantic Harvester, AI Visibility Monitor, Keys.so workflow,
  автоматический контент, масштабирование контента, конвейер n8n,
  автоматизировать статьи, SEO автомат. Используй когда обсуждается
  автоматизация контент-производства, настройка n8n workflow для SEO,
  или масштабирование того, что делает gengroup-seo-manual.
---

# SEO Pipeline - Автоматизированный контент-конвейер (n8n)

## Связь с ручным скиллом

Этот скилл - МАСШТАБИРОВАНИЕ gengroup-seo-manual. Ручной скилл создаёт эталонные статьи и отлаживает промпт. Этот скилл берёт отлаженный промпт и ставит его на поток через n8n.

**Правило:** Сначала 3-5 эталонных статей через manual → потом автоматизация через pipeline.

---

## ПРИНЦИП #0: КЛИЕНТ-FIRST

Наследуется из gengroup-seo-manual. Каждая статья пишется от боли клиента, не от каталога. System prompt Content Forge содержит этот принцип - Claude API генерирует контент от задачи покупателя. Структура: задача -> решение -> страхи -> бюджет (3 сценария) -> процесс -> доказательства -> CTA. Техданные подаются через призму клиентского вопроса. Статья для SEO-роботов = брак.

---

## Архитектурный принцип: ЧЕЛОВЕК В ЦЕПОЧКЕ

```
n8n генерирует → Telegram уведомляет → Менеджер проверяет → Менеджер публикует
     [авто]          [авто]              [ручная работа]     [ручная работа]
```

**Что автоматизировано:**
- Сбор семядра и кластеризация (Workflow 1)
- Генерация черновика статьи со всем фаршем (Workflow 2)
- Мониторинг AI-видимости (Workflow 3)
- Запись в Google Sheets
- Уведомления в Telegram

**Что ВСЕГДА делает человек:**
- Финальная вычитка статьи
- Проверка фактов и цен (могли измениться)
- Добавление реальных фото (не AI-генерация)
- Публикация на сайт через WordPress admin
- Подтверждение перелинковки на существующих страницах

---

## Пререквизиты

### Credentials (настраивает Дмитрий в n8n UI)

| # | Credential | Где взять | Статус |
|---|---|---|---|
| 1 | Keys.so API-токен | keys.so/account/api, тариф Проф+ | БЛОКЕР |
| 2 | Google Sheets OAuth | n8n Settings → Credentials → Google | БЛОКЕР |
| 3 | Anthropic API-ключ | console.anthropic.com | БЛОКЕР |
| 4 | Telegram Bot Token | @BotFather в Telegram | 5 минут |

### Инфраструктура

| Компонент | Статус | Заметка |
|---|---|---|
| n8n Cloud (gen-group.app.n8n.cloud) | Работает | Starter $20/мес, хватает до 50 статей/мес |
| MCP-подключение к n8n | Работает | 13 инструментов доступны из чата |
| Google Sheets шаблон | Создаётся при первом запуске WF1 | Столбцы описаны ниже |
| Telegram-канал для уведомлений | Нужен chat_id | Дмитрий создаёт |

---

## WORKFLOW 1: SEMANTIC HARVESTER

**Триггер:** ручной запуск, ввод: название категории
**Частота:** по запросу (при запуске новой категории)
**Executions:** ~15-20 за один прогон

### Спецификация нод

```
[Manual Trigger]
  → ввод: category (string), domain (string, default: genglass.ru)

[HTTP Request] Keys.so organic/keywords
  → URL: https://api.keys.so/report/organic/keywords
  → Params: domain={{domain}}, filter_keyword={{category}}
  → Auth: API-токен Keys.so
  → Выход: массив {keyword, position, volume, url}

[HTTP Request] Keys.so organic/keywords/bypage
  → URL: https://api.keys.so/report/organic/keywords/bypage
  → Params: domain={{domain}}/blog/
  → Выход: существующие блог-страницы и их ключи
  → Цель: ЗАЩИТА ОТ КАННИБАЛИЗАЦИИ

[HTTP Request] Keys.so organic/keywords (конкуренты)
  → Итерация по: miralls.ru, archpole.ru, loffi.ru
  → filter_keyword={{category}}
  → Выход: ключи конкурентов по этой категории

[HTTP Request] Keys.so similarkeys
  → seed-запросы из шага 1 (топ-20 по частотности)
  → Выход: расширенное семядро

[Code Node] ДЕДУПЛИКАЦИЯ + ФИЛЬТР (JavaScript)
  → Убрать: запросы где наш blog уже в ТОП-10
  → Убрать: частотность <10/мес
  → Убрать: нерелевантные (фильтр по стоп-словам)
  → Логика фильтрации: см. references/dedup_filter.js

[HTTP Request] Keys.so Кластеризатор
  → URL: https://api.keys.so/report/cluster
  → Встроенная группировка по search intent
  → Выход: кластеры с главными ключами

[HTTP Request] Anthropic Claude API → ПРИОРИТИЗАЦИЯ
  → model: claude-sonnet-4-20250514
  → System prompt: "Ты SEO-стратег. Для каждого кластера определи:
    тип статьи (1-8 по шаблону GENGROUP), коммерческий потенциал
    (1-5), рекомендуемую длину, основной CTA. Ответ в JSON."
  → Выход: обогащённые кластеры

[Google Sheets] Запись КОНТЕНТ-ПЛАНА
  → Spreadsheet: "SEO Контент-план [brand]"
  → Sheet: {{category}}
  → Столбцы: cluster_id, cluster_name, keywords, total_volume,
    article_type, priority, pillar_or_satellite, status,
    assignee, planned_date, actual_date, url

[Telegram] Уведомление
  → "Семядро собрано: {{category}}, {{N}} кластеров,
    {{M}} запросов. Контент-план готов: [ссылка на Sheet]"
```

---

## WORKFLOW 2: CONTENT FORGE

**Триггер:** ручной запуск на конкретный кластер (менеджер нажимает)
**Частота:** 3-5 раз в день при активном производстве
**Executions:** ~5-8 за одну статью

### Спецификация нод

```
[Manual Trigger]
  → ввод: cluster_id (string), sheet_url (string)

[Google Sheets] Чтение кластера
  → Прочитать строку по cluster_id
  → Получить: keywords, article_type, priority

[HTTP Request] Anthropic Claude API → ГЕНЕРАЦИЯ СТАТЬИ
  → model: claude-sonnet-4-20250514
  → max_tokens: 8000
  → System prompt: <<< SYSTEM PROMPT CONTENT FORGE >>>
    (полный промпт в references/content_forge_prompt.md)
  → User message: "Кластер: {{keywords}}.
    Тип статьи: {{article_type}}.
    Бренд: GENGLASS. Категория: {{category}}."
  → Выход: полный 6-блочный документ

[Code Node] Форматирование
  → Разделить ответ на 6 блоков
  → Сформировать чистый HTML (блок 2)
  → Сформировать JSON-LD (блок 4)
  → Собрать в один структурированный документ

[Google Sheets] Обновление статуса
  → cluster_id → status = "черновик готов"
  → Добавить: дата генерации, preview-ссылка

[Telegram] Уведомление менеджеру
  → "Статья готова: {{title}}
    Кластер: {{cluster_name}}
    Ключи: {{keywords}}
    Тип: {{article_type}}
    
    → Забрать и проверить: [ссылка]
    
    ⚠️ Перед публикацией:
    1. Проверить цены и факты
    2. Добавить реальные фото
    3. Опубликовать вручную"
```

### QUALITY CONTROL: 3 уровня

```
Level 1 (автоматический, в Code Node):
  ✓ Длина текста >= 1500 слов
  ✓ Количество H2 >= 5
  ✓ Inline CTA >= 2
  ✓ FAQ блок присутствует
  ✓ Schema.org JSON-LD валидный
  ✓ Нет слов из Anti-Slop blocklist (топ-20)
  ✓ Нет em dash "—"
  → Если любой check fail → пометить "требует доработки"

Level 2 (контент-менеджер, ручной):
  ✓ Факты и цены актуальны
  ✓ Фото заменены на реальные (не заглушки)
  ✓ Перелинковка корректна (URL существуют)
  ✓ Текст читается естественно
  → Если ОК → статус "готово к публикации"

Level 3 (продакт/SEO-шник, выборочно):
  ✓ Каждая 5-я статья проходит углублённый ревью
  ✓ Проверка: нет каннибализации с существующими страницами
  ✓ Корректность Schema.org (через Google Rich Results Test)
  ✓ Проверка GEO/AEO чек-листа
```

---

## WORKFLOW 3: AI VISIBILITY MONITOR

**Триггер:** cron, раз в неделю (понедельник 10:00)
**Частота:** автоматически
**Executions:** ~5-10 за прогон

### Спецификация нод

```
[Schedule Trigger]
  → Cron: каждый понедельник 10:00 MSK

[HTTP Request] Keys.so AI Tracker
  → URL: https://api.keys.so/report/ai/tracker
  → Params: domain=genglass.ru
  → Выход: Share of Model данные

[Code Node] Обработка
  → Подсчёт: общий Share of Model %
  → Сравнение с прошлой неделей (из Sheets)
  → Топ-5 запросов где нас цитируют
  → Топ-5 запросов где нас НЕТ (возможности)

[Google Sheets] Запись отчёта
  → Sheet: "AI Visibility"
  → Строка: дата, share_of_model_%, delta, details

[Telegram] Еженедельный отчёт
  → "📊 Share of Model: {{share}}% ({{delta}})
    Нас цитируют: {{top_cited}}
    Возможности: {{top_missed}}
    Полный отчёт: [ссылка на Sheet]"
```

---

## SYSTEM PROMPT для Claude API (Content Forge)

Полный промпт хранится в `references/content_forge_prompt.md`. Краткая структура:

```
ROLE: Ты SEO-копирайтер GENGLASS с 8 годами опыта в мебельной нише.
Ты работаешь на производстве 16 000 м² в Домодедово и знаешь каждый
станок лично.

ЗАДАЧА: Написать статью для блога genglass.ru по заданному кластеру.

ФОРМАТ ОТВЕТА: 6 блоков (META, ТЕКСТ, ПРОМПТЫ, SCHEMA, GEO/AEO, ПЕРЕЛИНКОВКА).

ПРАВИЛА:
1. Первое предложение = прямой ответ на поисковый запрос
2. Каждый H2 содержит минимум 3 конкретных числа
3. Inline CTA каждые 600-800 слов
4. FAQ: 5-7 вопросов из реальных клиентских запросов
5. Schema.org: Article + FAQPage обязательно
6. ЗАПРЕЩЕНО: em dash "—", слова из Anti-Slop blocklist
7. Entity Definition в первых 2 предложениях
8. Именные эксперты: "конструктор GENGLASS Максим К."
9. Товарные карточки: фото + название + от X ₽ + кнопка

ANTI-SLOP BLOCKLIST: [25 запрещённых фраз - из content-expert]

ДАННЫЕ О ПРОДУКЦИИ: [вставляется динамически из encyclopedia]
```

**Важно:** этот промпт отлаживается на эталонных статьях через gengroup-seo-manual. Каждое изменение промпта сначала тестируется вручную, потом обновляется в n8n.

---

## Google Sheets шаблон: столбцы контент-плана

| Столбец | Тип | Описание |
|---|---|---|
| cluster_id | string | Уникальный ID: CAT-001, CAT-002... |
| cluster_name | string | Человекочитаемое название кластера |
| keywords | string | Ключи через запятую |
| total_volume | number | Суммарная месячная частотность |
| article_type | number | 1-8 по типологии content-expert |
| priority | number | 1-5, где 1 = максимум |
| pillar_satellite | string | pillar / satellite / standalone |
| parent_pillar | string | cluster_id пиллара (для сателлитов) |
| status | string | новый → в работе → черновик → проверка → опубликовано |
| assignee | string | Имя ответственного |
| planned_date | date | Плановая дата публикации |
| generated_date | date | Дата генерации черновика (автозаполнение WF2) |
| published_date | date | Фактическая дата публикации |
| url | string | URL опубликованной страницы |
| geo_aeo_score | number | Баллы по GEO/AEO чек-листу (0-7) |
| notes | string | Заметки менеджера |

---

## Деплой через MCP

Все три workflow собираются, валидируются и деплоятся на gen-group.app.n8n.cloud прямо из чата через n8n MCP:

```
1. Написать код workflow (n8n SDK)
2. validate_workflow → проверка синтаксиса
3. create_workflow_from_code → деплой на инстанс
4. Дмитрий добавляет credentials в UI
5. publish_workflow → активация
6. execute_workflow → тестовый прогон
7. get_execution → проверка результата
```

Keys.so подключается через HTTP Request node (REST API). Нативного Keys.so node в n8n нет, но HTTP Request + API-ключ в header = полный функционал.

---

## Масштабирование

| Объём | Тариф n8n | Executions/мес | Стоимость |
|---|---|---|---|
| 10-15 статей/мес | Starter $20 | ~800 | $20 + Keys.so + Anthropic API |
| 20-30 статей/мес | Starter $20 | ~1800 | То же |
| 50+ статей/мес | Pro $50 | ~4000 | $50 + Keys.so + Anthropic API |

Anthropic API cost: ~$0.50-1.00 за статью (Sonnet, 8K output).
Keys.so: Проф ~$50/мес, Корп ~$100/мес.
Итого: 15 статей/мес = ~$85-100/мес = ~8 500 ₽/мес.

---

## Чек-лист запуска

- [ ] Keys.so API-токен получен
- [ ] Дмитрий настроил Google Sheets credential в n8n
- [ ] Дмитрий настроил Anthropic API credential в n8n
- [ ] Telegram Bot создан, chat_id получен
- [ ] 3-5 эталонных статей созданы через gengroup-seo-manual
- [ ] System prompt Claude API отлажен на эталонах
- [ ] WF1 Semantic Harvester задеплоен и протестирован
- [ ] WF2 Content Forge задеплоен и протестирован
- [ ] WF3 AI Visibility Monitor задеплоен (бонус)
- [ ] Контент-менеджер обучен процессу Level 2 проверки
