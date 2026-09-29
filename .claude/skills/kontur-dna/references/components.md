# Контур DS 1.4 · разметка деталей

Всё работает внутри `.kx`. JS-помощники берутся из `KS.kx`:

```js
const { esc, nf, pct, tick, N, seg, ring, spark, statusOf, toast, drawer, cmdk } = KS.kx;
```

## Каркас страницы

```html
<div class="ks-app kx">
  <aside id="sb" class="ks-sidebar"> ... <nav id="nav" class="ks-nav"></nav> ... </aside>
  <div class="ks-main">
    <header class="ks-topbar"> меню · переключатель среза .seg · поиск .kx-search · тема </header>
    <main class="hx" id="view">
      <section class="hs" id="p-sum"></section> ...
    </main>
  </div>
</div>
```

- Меню: `KS.nav(tree, activeId)` и `KS.navWire(nav, go)`.
- Мобильное меню: `KS.shell.init({sidebar, backdrop, menu})`.
- Подсветка текущего пункта при прокрутке: `IntersectionObserver` по `.hs` (см. `starter.html`).

## Шапки

```js
SH('01', 'Заголовок', '<b>Вывод с числом.</b> Пояснение.', 'd' /* или 'g' */)
```

```html
<div class="hd"><span class="cap">Подпись карточки</span><span class="m">служебное справа</span></div>
```

## Первый экран

```html
<article class="card c8 hero rise" style="--i:1">
  <div class="meta"><span class="st crit"><i class="dot crit"></i>требует решения</span><span>неделя</span><span>источник</span></div>
  <h1>Вывод. <em>Проблема красным.</em></h1>
  <p class="lede">Две строки с цифрами.</p>
  <div class="hero-row"><div class="hero-n"><span class="big">${N(5,'k1')}</span><span class="of">из ${N(417,'k0')}</span></div><div class="hero-cap">что посчитано</div></div>
  <div class="ratio"><i style="--i:0;flex:28;background:var(--neutral-bar)"></i> ...</div>
  <div class="ratio-leg"><span><i style="background:..."></i>подпись N</span> ...</div>
</article>
<aside class="card c4 rise fill"> .hd · <div class="acts grow"><div class="act"><span class="kbd">1</span><div><b>Решение</b><span>почему</span></div><button class="b gh sm" data-drill="k">открыть</button></div>...</div>
  <button class="b pri" data-copy="текст">Скопировать вывод</button></aside>
```

## Показатели

- **Ряд против нормы:** `<div style="grid-column:1/-1"><div class="stats">` и внутри `.stat.spot.click.lift` с `data-drill` и `tabindex="0"`. Состав: `.k` (название + статус), `ring(v, norm, statusOf(v, norm, up))`, `.v` (число), `.s` (подпись, норма), строка «a% → b% за 8 недель» и `.dl`.
- **Мини-графики:** `.minis.four > .mini` (название, число + `.dl`, `spark(vals, 'var(--text-strong)', 220, 34, true)`).
- **Отдельное число:** `.kpi` (+ `<small>`).
- **Число с пояснением:** `.note > b + span`.
- **Статус:** `<span class="st ok|warn|crit|na"><i class="dot ok"></i>слово</span>`.
- **Изменение:** `<span class="dl good|bad">+2,5</span>`.
- **Метка:** `<span class="bdg"><i class="dot ok"></i>данные</span>`.
- **Шкалы:**
  - `<div class="meter" style="--tone:var(--crit)"><i style="width:40%"></i></div>` в строке `.mrow` (`.k` с названием и `<b>`);
  - `.bullet` (зоны, значение, риска нормы).

## Графики

- **Линии в SVG:** сетка только горизонтальная (`--grid`); зона нормы: прямоугольник `--ok-soft` с `opacity .5` и подписью; линии через `class="draw" pathLength="1"`.
- **Наведение:** на каждую неделю `<g class="hc" data-tip="...">` с прозрачным прямоугольником, линией `.gl` и точками.
- **Узкий экран:** оборачивать в `.scx`, чтобы на телефоне был горизонтальный скролл.
- **Легенда:** `.leg > span > i`.
- **Поток по стадиям:** `.sankey`. Идущие дальше `.band.kp`, ушедшие `.band.dr`, выбранный `.sel`, узлы `.node`, подписи `.sk-n` / `.sk-s`. Код потока: `sFlow()` в `sales-detalizaciya/package/sections/detalizaciya/detalizaciya.js`.
- **ApexCharts:** если нужен сложный график, берите пресеты из `charts.js` (`KS.charts`), цвета там читаются из токенов.

## Списки и таблицы

- **Строки-кнопки с полосой:** `button.lrow` (подпись, `.lbar` из `<i style="flex:n;background:...">`, число).
- **Строки-кнопки со шкалой:** `button.prow > .mrow`.
- **Таблица:** `.tbl` в `<div style="overflow:auto;max-height:440px">`, шапка липкая. ID с копированием: `<span class="idc">id<button data-copy="id">...</button></span>`.
- **Фильтр:** `.seg` с `<span class="pill">` + `seg(el, onPick)`.
- **Аккордеон:** `.acc > button[aria-expanded] + .pn(.open) > div > .ans`.
- **Вкладки** `.tabs .ink`, **крошки** `.crumbs`, **пагинация** `.pg`.

## Переписка и примеры «как надо»

```html
<div class="dialog">
  <div><span class="lab st crit"><i class="dot crit"></i>как сейчас</span><div class="chat"><div class="bub c">клиент<small>кто · время</small></div><div class="bub m">менеджер</div></div></div>
  <div><span class="lab st ok"><i class="dot ok"></i>как надо</span><div class="chat">...</div></div>
</div>
<div class="steps3"><div><span class="n">01</span><h5>Шаг</h5><p>Что делать</p></div>...</div>
```

## Врезки и состояния

- **Врезки:** `.alert.ok|warn|crit` (иконка + текст), без цветной полосы сбоку.
- **Лента событий:** `ul.tl > li.ok|crit > b + small`.
- **Загрузка:** `.sk` (шиммер).
- **Пусто и нет данных:** `.empty > svg + b + span`.

## Слои поверх (стекло)

- **Подсказка:** атрибут `data-tip="<b>Заголовок</b><br>текст"` на любом элементе.
- **Уведомление:** `toast('Скопировано')`. Атрибут `data-copy="..."` копирует текст и сам показывает уведомление.
- **Панель деталей:** `drawer.open(html, fromEl)` / `drawer.close()`. Клики по `data-drill="ключ"` уходят в `KS.kx.onDrill = (key, el) => ...`.
- **Палитра команд:** `cmdk.set([[группа, название, () => действие, 'клавиша']])`, `cmdk.open()`. ⌘K / Ctrl+K подключено.
- **Тема:** `KS.kx.themeToggle(btn)`.

## Кнопки

`.b.pri` (одна на экран), `.b.sec`, `.b.gh`, `.b.dan`, размеры `.sm`, `.ic`. Для загрузки `<span class="spin">`.
