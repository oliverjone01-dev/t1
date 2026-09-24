# Как поставить Контур DS в новый проект

Контур DS живёт в одном месте: папка `kontur-ds/` в основной ветке репозитория `t1`. Выпуски отмечены метками
`kontur-ds-vX.Y.Z`. Правки системы делаются только здесь. Проект держит у себя копию нужной версии и
обновляется, когда сам решит.

## 1. Взять копию нужной версии

В проект кладётся папка `kontur-ds/` целиком, без изменений.

Из репозитория по метке (скачивается только папка пакета):

```bash
git clone --depth 1 --branch kontur-ds-v1.5.2 --filter=blob:none --sparse \
  https://github.com/oliverjone01-dev/t1.git /tmp/kontur && \
  git -C /tmp/kontur sparse-checkout set kontur-ds && \
  cp -r /tmp/kontur/kontur-ds ./kontur-ds
```

Или распаковать архив `kontur-ds-1.5.2.zip`. Номер версии виден в первой строке `kontur-ds/README.md`.

## 2. Подключить на страницу

```html
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="kontur-ds/tokens/tokens.css">
<link rel="stylesheet" href="kontur-ds/kit/kit.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/apexcharts/3.54.1/apexcharts.min.js"></script>
<script>window.KS_PREFS_KEY = 'my-project';</script>   <!-- своё имя, если на сайте несколько проектов -->
<script src="kontur-ds/kit/brand.js"></script>
<script src="kontur-ds/kit/icons.js"></script>
<script src="kontur-ds/kit/kit.js"></script>
<script src="kontur-ds/kit/charts.js"></script>
```

Страницу проще начать с шаблона: `templates/starter.html` (каркас), `obzor.html` (дашборд), `treker.html`
(трекер), `otchet.html` (отчёт). Правила экранов, цифр и графиков: `SKILL.md` и `DESIGN_SYSTEM.md`.

## 3. Вид проекта

1. Открыть `kontur-ds/templates/nastroyki.html`, настроить логотип, подпись, цвета, форму.
2. Нажать «Код для проекта» и заменить этим кодом `kontur-ds/kit/brand.js` проекта.
3. Прогнать сторож (шаг 4): он проверит контраст с новым видом.

Вид лежит только в `brand.js` проекта. Кит, токены и сторож у всех проектов общие, их не править: иначе
следующее обновление затрёт правку. Нужно новое в системе, значит правка в `kontur-ds/` репозитория `t1`
и новая версия.

## 4. Сторож

Локально (нужны Python 3, Node и Playwright с Chromium):

```bash
python3 kontur-ds/tools/check_ds.py public/*.html --live
```

В GitHub: скопировать `kontur-ds/ci/kontur-ds.yml` в `.github/workflows/` проекта и указать свои страницы в
`pages`. Проверка идёт на каждый PR и пуш в main, красный прогон значит нарушение системы. Проект внутри
репозитория `t1` может звать шаблон проверки локально: `uses: ./.github/workflows/kontur-ds-check.yml`.

Законный приём, похожий на нарушение, помечается выключателем с причиной (`--ks-allow`, `DESIGN_SYSTEM.md` §20).
Страница за паролем видна сторожу только экраном входа: для неё нужен свой прогон по экранам.

## 5. Обновление

1. Взять новую версию (шаг 1) во временную папку.
2. Прочитать в `DESIGN_SYSTEM.md` раздел «Переход с ...» своей версии: там список заменяемых файлов и что
   поправить в своих страницах.
3. Заменить файлы, свой `kit/brand.js` оставить.
4. Прогнать сторож. Метку шаблона проверки в `.github/workflows/kontur-ds.yml` поменять на новую.

## 6. Claude

Чтобы Claude в любой сессии собирал экраны по этой системе, архив пакета загружается как скилл аккаунта
(`SKILL.md` уже внутри). После каждой новой версии скилл обновляется тем же архивом.
