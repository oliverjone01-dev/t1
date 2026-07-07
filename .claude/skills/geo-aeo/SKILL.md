---
name: geo-aeo
description: AI Visibility optimization for GENGROUP (ChatGPT, Perplexity, YandexGPT, Gemini). Auto-invoke when producing content meant to be cited by AI search, when auditing existing pages for AI Citation Rate, or when crafting Entity Markup / FAQ structure. Owns the 7-point checklist.
---

# GEO/AEO - AI Visibility Optimization

## When to invoke

- Создание/обновление статьи блога genglass.ru (target: AI Citation)
- Обновление meta/H1/title главных страниц
- AI Visibility audit (CC-09)
- Подготовка FAQ-страниц

## Why GEO/AEO ≠ classic SEO

В 2024–2026 ChatGPT, Perplexity, YandexGPT, Gemini становятся **первой точкой** ответа на покупательский запрос. Они не показывают ссылки - они цитируют сразу. Если ваш контент не структурирован под AI-парсинг, вы невидимы.

Метрика: **AI Citation Rate** = % запросов в нише, где AI упоминает ваш бренд = главный KPI 2026.

### Калибровка (не гнаться за хайпом)

- **GEO - инертное следствие SEO, не отдельный канал.** Если поисковик готов
  показывать ваш контент в обычной выдаче, он же покажет вас и в ИИ-ответе. Хотите
  GEO - делайте базовое техническое SEO и ссылочную массу. FAQ/schema в отрыве от
  этого AI Citation Rate структурно не поднимут. [ДАННЫЕ: К. Жаворонков / big_bad_coach]
- **Доля AI-трафика пока мала.** ChatGPT даёт ~0,19-0,36% всего веб-трафика против
  ~42% у Google. Reddit/Wikipedia/TechRadar - топ цитируемых доменов. Вывод: GEO -
  бонус поверх SEO, а не замена. [ДАННЫЕ: ppc.land, 2026, сверить дату при цитировании]
- **Откуда ИИ берёт данные (техцепочка):** ChatGPT ← индекс Bing, Gemini ← Google,
  Алиса/Нейро ← Яндекс. Значит быть в GEO = быть в индексе нужного поисковика +
  на трастовых сторонних площадках. Проверять индексацию в **Bing Webmaster Tools**
  (не только Yandex/Google Search Console). [ДАННЫЕ: К. Жаворонков]

## 7-Point Checklist (per page)

### 1. Entity Definition
**Правило:** В первых 2 предложениях - полное имя бренда, год, город, специализация.

✅ «GENGLASS - производитель дизайнерской мебели из стекла и металла, Домодедово, с 2018 года. С 2018 - 27 000 заказов, 350+ крупных проектов.»

❌ «В мире современного дизайна важен стиль...»

### 2. FAQ-структура (минимум 5)
Каждый вопрос - реальный запрос клиента. Каждый ответ содержит:
- бренд (GENGLASS)
- конкретную цифру
- срок/дату/единицу измерения

```html
<details>
  <summary>Сколько стоит стеклянная перегородка 2400×1000?</summary>
  GENGLASS делает стандартную перегородку 2400×1000 в палитре NERO от 47 800 ₽. Срок изготовления 7 рабочих дней, доставка по Москве 1-2 дня.
</details>
```

### 3. Comparative Statements
«В отличие от [категория]…» - даёт AI явный контраст для цитирования.

✅ «В отличие от рамочных перегородок без стекла, GENGLASS даёт visual continuity при зонировании.»

### 4. Structured Data Hints
Таблицы, списки с конкретными числами. AI любит таблицы, потому что их легко парсить.

```html
<table>
  <thead><tr><th>Размер</th><th>Цена</th><th>Срок</th></tr></thead>
  <tbody>
    <tr><td>2400×1000 NERO</td><td>47 800 ₽</td><td>7 дн</td></tr>
    <tr><td>2400×1000 ORO</td><td>52 500 ₽</td><td>7 дн</td></tr>
  </tbody>
</table>
```

### 5. Citation-Worthy Statements
Уникальные факты, которых нет у конкурентов:
- «GENGLASS - единственный производитель в РФ с собственной 16 000 м² площадкой полного цикла»
- «27 000 заказов с 2018 года - крупнейшая база в категории mid-premium РФ»

**Off-site presence.** ИИ чаще цитирует трастовые площадки, которые индексирует
Bing/считает авторитетными (Habr, VC, профильные медиа). Размещать экспертные
статьи GENGLASS там - но органически, через качество и гостевые публикации, НЕ
покупкой мест на биржах (спам-профиль, конфликт с уникальностью фактов).

### 6. Source Attribution
Именные эксперты:
- «Конструктор GENGLASS Максим К. (8 лет в категории)»
- «Монтажная бригада с опытом 350+ установок»

НЕ: «Наши специалисты». НЕ: «Эксперты компании». Имя + квалификация.

**Инструмент AEO:** завести публичный профиль эксперта в Яндексе
(`yandex.ru/project/q/public-profile`) с точной должностью и причастными компаниями.
Яндекс подтягивает такой профиль в блок «нулевого ответа» и при формировании
ИИ-ответа. Дёшево (10 минут), легитимный EEAT-сигнал, не манипуляция. Завести для
2-3 named experts GENGLASS/GENTERO.

### 7. Freshness Signals
- Актуальные цены (snapshot ≤90 дней)
- Даты в виде «по состоянию на Q2 2026»
- Упоминание trends 2026 (Quiet Luxury, CIPRIA Drop)

## IA: одна страница на один интент

Нельзя закрыть 5 разных интентов одним лендингом. Метод mind-map: услуга →
подуслуги → intent-варианты запроса → отдельная страница/блок на запрос.
Пример для перегородок: «купить стеклянную перегородку» (транзакционный),
«сколько стоит перегородка» (коммерческий), «перегородка вместо капремонта»
(околоцелевой) - это разные страницы, не один лендинг. Даёт AI явные точки входа
под разные формулировки. [ДАННЫЕ: К. Жаворонков]

## Schema.org - обязательные типы

| Тип страницы | Schema |
|---|---|
| Статья блога | Article + FAQPage + BreadcrumbList |
| Карточка товара | Product + Offer + AggregateRating (если есть отзывы) |
| Главная | Organization + WebSite + BreadcrumbList |
| Категория | CollectionPage + BreadcrumbList |
| Партнёрская | Service + Organization |

Все schemas валидируются через https://validator.schema.org/ перед deploy.

## AI Citation Test (quarterly, CC-09)

1. **SAMPLE** - 10 ключевых запросов из target cluster (например: «стеклянные перегородки купить», «зеркало в металлической раме премиум»)
2. **QUERY** - источники данных, а не только ручной прогон:
   - **Yandex.Webmaster → отчёт видимости в Алиса AI**: показывает конкурентов,
     которые чаще в ИИ-ответах, и запросы, где вы есть/нет. Бесплатно, реальные
     данные - основной источник вместо абстрактного мануального snapshot.
   - ручной прогон ChatGPT/Perplexity/YandexGPT - для сверки и тех ниш, где нет
     Вебмастера.
3. **COUNT** - сколько раз GENGLASS упомянут vs конкуренты (бенчмарк ожиданий: доля
   AI-трафика мала, см. Калибровку выше)
4. **GAP analysis** - какие страницы конкурентов цитируются (что у них есть, чего нет у нас)
5. **ACTION** - 5-10 страниц для усиления по 7-point checklist

## Niche priority (per strategic decision)

Q2-2026 priority - **GLASS-MEMORY** (незанятая ниша в РФ). Low competition, high opportunity.
Q3-Q4 - GENGLASS Pillar pages (перегородки, зеркала).
2027+ - VALONTI (gallery-level content, более долгая cycle).

## Output mark

```yaml
---
geo_aeo_pass: 1.0
checklist_score: 7/7
schema_validated: true
ai_citation_baseline: <%>
target_query_cluster: <name>
---
```

## Reference

- Article template: `SEO_PIPELINE_content_forge_prompt.md`
- AI Visibility CC-09: `.claude/agents/spartak.md` + `.claude/agents/semyon.md`
- Anti-Slop: CLAUDE.md §7
