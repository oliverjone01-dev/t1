---
name: content-factory
description: Production-grade content templates for GENGROUP across all channels. Auto-invoke when producing structured deliverables - articles, landings, KP, email sequences, social posts, marketplace cards. Bundles channel-specific limits, anti-slop discipline, and golden-example references.
---

# Content-Factory (v1.1)

## When to invoke

- Производство контента в объёме (5+ единиц)
- Структурированный deliverable: статья, лендинг, КП, email-цепочка, пост, карточка маркетплейса
- Нужны channel-specific лимиты (символы, weight, кэп изображений)

## Templates

### Article (Pillar / Satellite)
- 1500-2500 слов
- Структура: 7 блоков от задачи читателя (см. МАКС #3)
- 6-block output: META / ТЕКСТ / ИЛЛЮСТРАЦИИ / SCHEMA / GEO-AEO / ПЕРЕЛИНКОВКА
- Min 3 цифры на H2-блок
- Inline CTA каждые 600-800 слов

### Landing page
- Hero: H1 + sub + 1-line proof + CTA
- 5 sections: что решаем / для кого / как работает / цены 3-уровня / FAQ
- Trust band: 27 000 заказов, 350+ проектов, 16 000 м²
- Footer: контакты + полит. cookies/обработка

### КП (commercial proposal)
- 1 page если возможно. Max 3.
- Структура: проблема клиента (1 абз) → решение (3-5 пунктов) → 3 цены → дедлайны → CTA
- Output формат: DOCX (Protocol 10)
- НЕ путать с лонгридом

### Email sequence
- 5-7 писем, частота 2-5 дней
- Каждое - одна mission (welcome / educate / soft-pitch / case / urgency / re-engagement / hard-pitch)
- Subject line: ≤50 символов, без emoji, без CAPS

### Social post (TG/VK/Instagram)
- 200-800 знаков
- Hook в первой строке (без «друзья», без «не секрет»)
- 1 CTA внизу

### Marketplace card (WB/Ozon/Я.Маркет)
- Title: модель + палитра + размер + размерности
- Description: ≥1000 символов, structured: что это / для кого / габариты / материалы / комплектация / срок изготовления / гарантия
- 8+ фото + 1 видео

## Channels - limits & best practices

| Канал | Длина | Особенности |
|---|---|---|
| Telegram пост | 200-1500 знаков | Markdown поддержка, форматирование умеренно |
| VK | 300-4000 | Хештеги до 5; «Статья» для лонгрида (8K+ знаков) |
| Дзен | 1500+ | SEO-логика, заголовок ≤100, обложка обязательна |
| Email | 300-800 для сейл, 1500+ для образовательного | HTML inline, темная тема - fallback |
| OZON title | 60 знаков | Модель + категория + параметр |
| WB title | 60 знаков | Модель + категория + ключ |
| Я.Маркет title | 100 знаков | Развёрнутее |
| Instagram caption | 125 first визибл; total 2200 | Hashtags max 10 (не 30) |

## Anti-patterns

- Контент без unit-эк (нет CR, CAC, средний чек этой кампании)
- Один шаблон на 5 брендов (см. skill `brand`)
- 30+ единиц в неделю «потому что можем» - без Anti-Slop pass = слоп
- Лендинг без 3-уровневого pricing
- Email-цепочка без чёткой mission на каждое письмо

## Golden examples (placeholder)

`knowledge/semantic/golden-examples/`:
- 5 лучших КП - pending Иван deposit (см. MIGRATION Sprint 2)
- 3 лучших лендинга - pending

После депозита - каждый раз использовать как reference, NOT копировать. Anti-Median test применять.

## Output mark

```yaml
---
factory_template: article|landing|kp|email|social|marketplace
channel: telegram|vk|dzen|email|ozon|wb|yamarket|instagram
length: <words>
anti_slop_pass: true
humanizer_pass: true
brand_voice_check: passed
---
```

## Reference

См. `SEO_PIPELINE_content_forge_prompt.md` для article template (Content Forge).
См. CLAUDE.md §8 для Output Routing (Protocol 10).
