# Контур DS 1.2

Дизайн-система рабочих интерфейсов: дашборды, трекеры, отчёты, панели управления.
От складного телефона до монитора, светлая и тёмная тема (фон на ступень темнее тёмного Claude).
Выросла из дашборда «Контур» и проверена на нём.

- **Витрина**: `specimen.html`, все элементы в светлой и тёмной теме, каркас в рамках телефона и планшета
- **Полное описание**: `DESIGN_SYSTEM.md`
- **Старт нового проекта**: `templates/starter.html`

## Подключение

```html
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="kontur-ds/tokens/tokens.css">
<link rel="stylesheet" href="kontur-ds/kit/kit.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/apexcharts/3.54.1/apexcharts.min.js"></script>
<script src="kontur-ds/kit/icons.js"></script>
<script src="kontur-ds/kit/kit.js"></script>
<script src="kontur-ds/kit/charts.js"></script>
```

В артефакте Claude внешние файлы блокируются: содержимое `tokens.css`, `kit.css` и
скриптов вставляется внутрь страницы. Пример сборки в `tools/build_specimen.py`.

Tailwind v3: `presets: [require('./kontur-ds/tokens/tailwind.preset.js')]`.
shadcn/ui и Tailwind v4: после `tokens.css` подключить `tokens/shadcn.css`.
Figma и прочие инструменты: `tokens/tokens.json`.

## Проверка

```bash
python3 tools/check_ds.py путь/к/странице.html --live  # сторож + реальный контраст в браузере
python3 tools/tamper_ds.py                              # 24 испорченные версии, ловит все
npx impeccable detect путь/к/странице.html              # второе мнение (детектор слопа)
```

## Правка токенов

Только в `tokens/tokens.css`, затем `python3 tools/export_tokens.py`, затем сторож.
Новый цвет графика сначала проходит `tools/validate_palette.mjs` в обеих темах.

Шрифт: на Mac и iPhone системный SF, у остальных Golos Text; цифры табличные, моноширинный только для кода.
Меню на телефоне: `KS.shell.init({ sidebar:'#sb', backdrop:'#bd', menu:'#menu' })`, фильтры шапки в `.ks-topbar-tools`.

Переход с 1.1: раздел 15 `DESIGN_SYSTEM.md`. Переход с 1.0: `--accent*` переименован в `--primary*`, `--text-on-accent` в `--primary-foreground`. Подробно в разделе 13 `DESIGN_SYSTEM.md`.
