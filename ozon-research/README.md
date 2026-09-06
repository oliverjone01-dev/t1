# Ozon Research - карта ниш для производственных цехов

Сайт-упаковка исследования: 180 ниш Ozon, 120 с полным расчётом экономики, 24 кейса с конкурентами,
48 идей ноу-хау и Reality Audit по топ-10.

## Стек

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** - токены в `src/app/globals.css`, конфиг-файла нет
- **next-themes** - светлая и тёмная тема, по умолчанию системная
- **lucide-react** - иконки, **class-variance-authority** - варианты компонентов

## Запуск

Нужен Node 20.9 или новее (проверено на 22).

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # продакшн-сборка, 35 статических страниц
npm start        # запуск собранной версии
```

Сборка скачивает шрифты Onest, Golos Text и JetBrains Mono с Google Fonts, поэтому первая
сборка требует сети.

## Структура

```
src/
  app/                 маршруты: главная, method, niches, cases, cases/[id], knowhow, audit, decisions
  components/          UI и интерактив: таблица ниш, витрина кейсов, переключатель тем
  content/*.json       данные для страниц, генерируются скриптом (руками не править)
  lib/types.ts         типы и словари, без импорта данных
  lib/data.ts          загрузка контента
  lib/format.ts        рубли, проценты, ссылки на фото
data/source/           выгрузка исследования: sieve.json, cards/, knowhow.json, audit.json
scripts/build_content.py   пересборка src/content из data/source
```

## Пересборка данных

`src/content/*.json` - результат скрипта, а не ручной работы:

```bash
npm run content     # то же самое: python3 scripts/build_content.py
```

Скрипт читает `data/source/`, нормализует цеха, считает показатель «маржа сегодня» и складывает
счётчики в `meta.json`. Формула маржи описана в самом скрипте и продублирована на странице
`/method#margin` - она единственная считается здесь, а не приходит из исследования.

## Как поменять фотографии

Фотографии примерные, с Unsplash. У каждого кейса в `src/content/cases.json` поле `photo` содержит
**полный идентификатор** снимка вида `photo-1593850577500-e09291dee089` (именно с префиксом `photo-`,
без него URL вернёт 404). Постоянное место правки - словарь `PHOTOS` в `scripts/build_content.py`:
меняете там и запускаете `npm run content`, иначе следующая пересборка затрёт правку.

Чтобы поставить свои файлы вместо Unsplash:

1. Положите снимки в `public/photos/`.
2. В `PHOTOS` укажите путь, начинающийся со слеша: `"N005": "/photos/drovnitsa.jpg"`.
3. Функция `unsplash()` в `src/lib/format.ts` отдаёт такие пути как есть, без обращения к Unsplash.

## Данные

| Файл | Что внутри |
| --- | --- |
| `src/content/niches.json` | 180 ниш: спрос, цены, себестоимость, вердикт сита, маржа |
| `src/content/cases.json` | 24 кейса: конкуренты, сезонность, Reality Audit |
| `src/content/knowhow.json` | 48 идей с причинами отклонения |
| `src/content/meta.json` | счётчики, допущения модели, общий вывод аудита |

## Деплой

**Vercel** - подключить репозиторий, менять ничего не нужно.

**GitHub Pages** (статика). В `next.config.ts`:

```ts
const repo = "ozon-research";               // имя репозитория
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },            // на Pages нет оптимизатора картинок
  basePath: `/${repo}`,                     // только для project-страницы user.github.io/repo
  assetPrefix: `/${repo}/`,
};
```

Затем `npm run build`, положить в каталог `out` пустой файл `.nojekyll` (иначе Jekyll вырежет
каталог `_next` и страница останется без стилей) и опубликовать `out`. Для пользовательского домена
или `user.github.io` строки `basePath` и `assetPrefix` не нужны.

## Демо для показа

`demo/ozon-research.html` - вся история одним файлом: итог, методика, интерактивная карта
120 ниш, 24 кейса с конкурентами, 48 идей, аудит и решения. Данные встроены в файл,
сервер и сборка не нужны. Пересобирается после `npm run content`:

```bash
python3 scripts/build_demo.py
```

Файл написан как фрагмент страницы (без `<html>` и `<body>`), чтобы публиковаться
как есть. Фотографий в демо нет: снимки Unsplash грузятся с внешнего хоста и в
изолированной среде показа не откроются.
