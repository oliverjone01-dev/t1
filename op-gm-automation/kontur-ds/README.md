# Контур DS 1.5.1

Дизайн-система рабочих интерфейсов: дашборды, трекеры, отчёты, панели управления.
От складного телефона до монитора, светлая и тёмная тема (фон на ступень темнее тёмного Claude).
Выросла из дашборда «Контур» и проверена на нём. 1.3: продуктовый вид вместо шаблонного
(плитки одной панелью, класс цифры точкой, палитра команд Cmd+K, стеклянные подсказки).
1.4: переключатель плотности, липкие шапки таблиц, плавные переходы между экранами,
микроанимации и анимации Rive, почти чёрная основная кнопка в shadcn.
1.5: страница настройки вида: логотип и дескриптор, шрифт, цвета кнопок и акцента, плавные
или острые графики, палитра серий, форма, глубина, раскладка и движение по умолчанию.
1.5.1: исправления по проверке на живом проекте. Статический сторож читает стиль из перечня источников (CSS,
`<style>`, `style=""`, CSS в JS, `el.style`, вложенный CSS), правила разобраны по классам обходов; живой слой
(`--live`) проверяет вычисленные стили в браузере и падает громко, если не запустился. Замер на наборах подмен:
159 из 159, 0 ложных тревог на 37 законных приёмах, живьём 13 из 13. Перечень и то, чего сторож не видит:
DESIGN_SYSTEM.md, раздел 19.
Настройки вида у каждой папки сайта свои. На телефоне и планшете выбор периода виден целиком, тема и плотность
на телефоне в меню, пункты палитры команд 44 px. Тепловая карта подписывает строки словами, первая сверху.

- **Витрина**: `specimen.html`, все элементы в светлой и тёмной теме, каркас в рамках телефона и планшета
- **Полное описание**: `DESIGN_SYSTEM.md`
- **Старт нового проекта**: `templates/starter.html`
- **Настройка вида под проект**: `templates/nastroyki.html`, результат в `kit/brand.js`
- **Готовые образцы**: `templates/obzor.html` (дашборд), `templates/treker.html` (трекер), `templates/otchet.html` (отчёт);
  `python3 tools/build_pages.py` собирает их в самостоятельные файлы в `dist/`

## Подключение

```html
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="kontur-ds/tokens/tokens.css">
<link rel="stylesheet" href="kontur-ds/kit/kit.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/apexcharts/3.54.1/apexcharts.min.js"></script>
<script src="kontur-ds/kit/brand.js"></script>   <!-- вид проекта со страницы настроек -->
<script src="kontur-ds/kit/icons.js"></script>
<script src="kontur-ds/kit/kit.js"></script>
<script src="kontur-ds/kit/charts.js"></script>
<script src="kontur-ds/kit/motion.riv.js"></script>  <!-- по желанию: анимации Rive -->
```

В артефакте Claude внешние файлы блокируются: содержимое `tokens.css`, `kit.css` и
скриптов вставляется внутрь страницы. Пример сборки в `tools/build_specimen.py`.

Tailwind v3: `presets: [require('./kontur-ds/tokens/tailwind.preset.js')]`.
shadcn/ui и Tailwind v4: после `tokens.css` подключить `tokens/shadcn.css` (основная кнопка `bg-primary` почти чёрная, синий `bg-primary-blue`, вернуть синий: `data-shadcn-primary="blue"`).
Figma и прочие инструменты: `tokens/tokens.json`.

## Проверка

```bash
python3 tools/check_ds.py путь/к/странице.html --live  # сторож + живой контраст и стиль (нужны Node и Playwright с браузером)
python3 tools/tamper_ds.py --live                       # подмены, законные приёмы и живой слой (Playwright): сторож не врёт
npx impeccable detect путь/к/странице.html              # второе мнение (детектор слопа)
```

## Правка токенов

Только в `tokens/tokens.css`, затем `python3 tools/export_tokens.py`, затем сторож.
Новый цвет графика сначала проходит `tools/validate_palette.mjs` в обеих темах.

Шрифт: на Mac и iPhone системный SF, у остальных Golos Text; цифры табличные, моноширинный только для кода.
Меню на телефоне: `KS.shell.init({ sidebar:'#sb', backdrop:'#bd', menu:'#menu' })`, фильтры шапки в `.ks-topbar-tools`.

Палитра команд: `KS.cmdk.set([...])` и `KS.cmdk.button()`; сегмент с плашкой: `KS.seg.wire(el)`; после отрисовки экрана `KS.ticker.run(корень)`.
Переход между экранами: `KS.vt(() => { VIEW = v; render(); })`; плотность: `KS.density.toggle()`; анимации Rive: `KS.rive.enable()` (исходники в `rive/`).

Настройки вида: `KS.prefs.get()`, `KS.prefs.save(p)`, `KS.prefs.reset()`; плавные линии `data-curve="smooth"` (monotone), анимации `data-motion="calm|off"`.

Переход с 1.4: раздел 18 `DESIGN_SYSTEM.md`. Переход с 1.3: раздел 17 `DESIGN_SYSTEM.md`. Переход с 1.2: раздел 16 `DESIGN_SYSTEM.md`. Переход с 1.1: раздел 15. Переход с 1.0: `--accent*` переименован в `--primary*`, `--text-on-accent` в `--primary-foreground`. Подробно в разделе 13 `DESIGN_SYSTEM.md`.
