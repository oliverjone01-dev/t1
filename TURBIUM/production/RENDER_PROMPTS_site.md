# TURBIUM · Промпты под графику сайта (13 фреймов)

> Для каждого `data-render` в `www/*.html` есть готовый промпт. Рендеришь отдельно (Midjourney / Flux / Claude-совместимый image-tool / нейрофото), вставляешь картинку на место `<figure class="gfx" data-render="КЛЮЧ">`.
>
> **Единая арт-дирекция (KREA).** Держи во всех кадрах, иначе сайт рассыпется на стоки:
> - База: почти-чёрный тёплый фон `#0E1512` / `#0A0F0D`, лёгкий зерно-шум, без чистого белого фона.
> - Свет: мятный `#4EEAC0` и бирюзовый `#00BFA5` как источник свечения; янтарный `#FF8C42` только как акцент боли/тепла.
> - Материал: стекло, матовый металл, кристаллическая решётка (отсылка к тербию, элемент №65). Никакого глянцевого 3D-пластика.
> - Форма карточек-объектов: скруглённые углы, но один угол острый (radius 20/20/20/4) - фирменная «огранка».
> - **Запрещено:** стоковые улыбающиеся лица, рукопожатия, лампочки-идеи, галочки-щиты клипарт, флаги, деньги-веером, роботы-андроиды, «ИИ-мозг из неона».
> - **Anti-median тест:** если дефолтный Midjourney по слову «маркетинг» выдаст то же - переделать.
> - Соотношение сторон указано в каждом блоке (совпадает с `data-ratio`).
> - Текст на картинке не пишем (кроме символа `Tb` и цифр, где явно сказано): подписи даёт вёрстка.
> - Негатив-промпт для всех: `--no text, watermark, stock people, faces, handshake, lightbulb, cliché robot, glossy plastic, rainbow, flag`

Формат MJ-хвоста дан как пример; под Flux/другой движок убери `--ar/--stylize`, оставь описание.

---

## 1. hero-tb-tile · 1:1 · Главная, герой
**Смысл:** символ бренда, «реагент роста». Первое, что видит клиент.
**Промпт:**
```
A single dark crystalline tile floating in warm near-black void #0E1512, subtle film grain. The tile is matte glass with one sharp cut corner (others rounded), edges lit from within by mint #4EEAC0 and teal #00BFA5. Faint element symbol "Tb 65" etched on its surface like a periodic-table cell, glowing softly. Thin light-lines grow outward from the tile like roots turning into an upward arrow of particles. Amber #FF8C42 spark at the base. Cinematic product-shot lighting, depth of field, premium fintech mood, editorial.
--ar 1:1 --stylize 250 --no text, watermark, stock people, faces, lightbulb, glossy plastic, rainbow
```

## 2. pain-heat-strip · 16:9 · Главная, блок боли
**Смысл:** «где течёт бюджет» - тепловая карта потерь заявок.
**Промпт:**
```
Abstract horizontal heat-map ribbon on warm near-black #0A0F0D, film grain. A funnel/pipeline of flowing particles moving left to right; along the path several leaks glow hot amber #FF8C42 where particles fall away and dim to grey, while the surviving stream stays cool mint #4EEAC0. Data-viz aesthetic, thin gridlines, no chart labels. Feels like money leaking out of a broken pipe visualised as light. Dark editorial, cinematic.
--ar 16:9 --stylize 200 --no text, watermark, stock people, faces, cliché robot, rainbow
```

## 3. services-rail-node · 3:2 · Главная, «Что делаем»
**Смысл:** узел-связка на рельсе лидогенерации.
**Промпт:**
```
A glowing node on a dark rail track made of light, warm near-black background #0E1512, grain. The rail carries mint #4EEAC0 particles; at the node they converge, brighten and split into ordered streams (leads sorted). Matte glass hexagonal node with one sharp corner, teal inner glow. Three or four rails run parallel receding into depth. Precise, engineered, calm. Cinematic depth of field.
--ar 3:2 --stylize 220 --no text, watermark, stock people, faces, glossy plastic, rainbow
```

## 4. process-timeline-vertical · 4:5 · Главная, «Как работаем»
**Смысл:** вертикальная лестница-этапы: боль → диагностика → связка → рост.
**Промпт:**
```
Vertical timeline as four floating crystalline steps ascending, warm near-black void #0A0F0D, film grain. Bottom step glows amber #FF8C42 (pain), each higher step shifts cooler to mint #4EEAC0 (growth), top step brightest. Steps are matte glass slabs with one sharp cut corner each, connected by a thin rising light-thread. Side view, cinematic, editorial fintech, shallow depth of field.
--ar 4:5 --stylize 220 --no text, watermark, stock people, faces, rainbow, glossy plastic
```

## 5. case-before-after · 3:2 · Главная, модель-кейс
**Смысл:** честная МОДЕЛЬ (не реальный кейс): было хаос → стало поток. Подпись «модель» даёт вёрстка.
**Промпт:**
```
Split composition on warm near-black #0E1512, grain. Left half: tangled chaotic mess of dim grey scattered dots and broken lines (lost leads, disorder). Right half: the same dots reorganised into a clean ordered mint #4EEAC0 stream flowing upward through a glass node. A soft vertical seam of teal light divides the halves. Data-viz abstraction, no faces, no charts with labels. Cinematic, editorial.
--ar 3:2 --stylize 200 --no text, watermark, stock people, faces, rainbow
```

## 6. services-hero-grid · 16:9 · Услуги, шапка
**Смысл:** сетка граней-услуг, одна выделена (флагман Пульс).
**Промпт:**
```
An isometric grid of dark matte-glass tiles on warm near-black #0A0F0D, film grain, each tile with one sharp cut corner. Most tiles are dim; one tile in the grid is lit from inside with mint #4EEAC0 and teal glow, standing slightly raised - the hero product. Thin light seams between tiles. Premium SaaS pricing-page hero mood, cinematic depth, editorial.
--ar 16:9 --stylize 220 --no text, watermark, stock people, faces, glossy plastic, rainbow
```

## 7. approach-diagram · 3:2 · Как работаем, метод
**Смысл:** схема метода: боль → AI-слой диагностики → связка → результат на дашборде.
**Промпт:**
```
A clean horizontal process diagram rendered as glowing light-flow on warm near-black #0E1512, grain. Four stages left to right: an amber #FF8C42 pain-spark, a translucent AI diagnostic layer (mesh of thin mint lines scanning), a solid glass connector node, and a bright dashboard-plane of ordered mint bars. Connected by a single continuous light-thread. Engineered, minimal, no readable labels. Cinematic editorial.
--ar 3:2 --stylize 200 --no text, watermark, stock people, faces, cliché robot, rainbow
```

## 8. about-team-abstract · 4:5 · О нас
**Смысл:** «команда как кристаллическая решётка Tb», без стоковых лиц.
**Промпт:**
```
Abstract portrait of a team as a crystalline lattice, NOT people: several glowing nodes of mint #4EEAC0 and teal connected into one terbium-like crystal structure on warm near-black #0A0F0D, film grain. Each node a small matte-glass cell with one sharp corner, together forming a stronger whole. Sense of a small precise alloy that amplifies. Cinematic, editorial, premium, depth of field.
--ar 4:5 --stylize 240 --no text, watermark, stock people, faces, handshake, rainbow
```

## 9. contacts-map-glow · 1:1 · Контакты
**Смысл:** карта России, точки городов светятся мятным, линии-заявки сходятся к Tb.
**Промпт:**
```
Dark stylised map of Russia on warm near-black #0E1512, film grain, coastlines as thin faint teal lines. City points across the country glow mint #4EEAC0. From every point thin light-threads converge toward a single central node shaped like a matte-glass "Tb" cell with one sharp corner, softly glowing. Nationwide-online feeling, calm, premium, cinematic. No labels, no flags.
--ar 1:1 --stylize 220 --no text, watermark, stock people, faces, flag, rainbow
```

## 10-13. blog-card-thumb-1..4 · 16:9 · Блог, обложки
**Общий стиль обложек:** одинаковая рамка-язык, чтобы лента блога читалась как система. Тёмный фон #0A0F0D, зерно, один мятный акцент-объект по центру, много воздуха, без текста.

**10. blog-card-thumb-1 - «Сколько стоит клиент» (Деньги):**
```
Minimal dark editorial cover, warm near-black #0A0F0D, grain. A single glowing mint #4EEAC0 coin-like glass disc with one sharp corner, on it a faint price-tag notch; a thin light-thread measures its size like a ruler. Calm, lots of negative space. Cinematic.
--ar 16:9 --stylize 200 --no text, watermark, stock people, faces, rainbow
```
**11. blog-card-thumb-2 - «Заявки теряются» (Система):**
```
Minimal dark editorial cover, warm near-black #0A0F0D, grain. A pipe of mint #4EEAC0 particles with one visible amber #FF8C42 leak where a few particles drip away. Rest of frame empty, lots of air. Cinematic, data-viz abstraction.
--ar 16:9 --stylize 200 --no text, watermark, stock people, faces, rainbow
```
**12. blog-card-thumb-3 - «Ушли с маркетплейса» (Каналы):**
```
Minimal dark editorial cover, warm near-black #0A0F0D, grain. A small glass node breaking free from a large dim grey grid (the marketplace) and growing its own mint #4EEAC0 branch of light toward the viewer. Negative space. Cinematic.
--ar 16:9 --stylize 200 --no text, watermark, stock people, faces, rainbow
```
**13. blog-card-thumb-4 - «CRM без боли» (Инструменты):**
```
Minimal dark editorial cover, warm near-black #0A0F0D, grain. Scattered dim contact-dots being gently gathered by thin mint #4EEAC0 threads into one neat ordered column - a calm CRM metaphor. One sharp-corner glass card holds them. Lots of air. Cinematic.
--ar 16:9 --stylize 200 --no text, watermark, stock people, faces, rainbow
```

---

## Как вставить рендер в вёрстку
1. Сохрани картинку в `www/img/<ключ>.webp` (или `.jpg`).
2. В нужном `*.html` замени плейсхолдер:
```html
<figure class="gfx" data-ratio="1:1" data-render="hero-tb-tile">...</figure>
```
на:
```html
<figure class="gfx has-img" data-ratio="1:1">
  <img src="img/hero-tb-tile.webp" alt="Символ TURBIUM: реагент роста" loading="lazy">
</figure>
```
3. Alt-текст пиши по смыслу кадра (для SEO и доступности), не ключ.
4. Вес: держи каждую картинку <300 КБ (webp, качество ~80). Иначе просядет скорость и Core Web Vitals.
