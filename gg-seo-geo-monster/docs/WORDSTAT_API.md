# Wordstat API - сбор семантического ядра

Как SEO/GEO Монстр тянет частотность запросов из Yandex Wordstat, чтобы собирать
семантическое ядро на проекты (GENGLASS в приоритете).

## Важное ограничение среды

Web-контейнер Claude **не имеет сети к доменам Яндекса** (агент-прокси режет CONNECT,
403) - как и к ozon.ru. Поэтому живой сбор идёт **в GitHub Actions** с секретами,
результат коммитится в `data/semcore/`. Паттерн повторяет `ozon-snapshots.yml`.

Локально у Ивана/Семёна скрипт тоже работает (там сеть к Яндексу открыта).

## Две Wordstat-API - выбрать одну

Яндекс даёт два разных API под одну задачу. Нужно подтвердить, какой у нас доступ.

### Вариант A - AI Studio Search API (ссылка Ивана)

`aistudio.yandex.ru/docs/ru/search-api/concepts/wordstat.html`. Часть Yandex Cloud
Search API. Биллинг через Yandex Cloud.

- **Auth:** `Authorization: Api-Key <YANDEX_SEARCH_API_KEY>` (ключ Yandex Cloud)
- **Тело:** содержит `folderId` (ID каталога Yandex Cloud)
- **Эндпоинты:** `/api/v1/tools/wordstat/top`, `/dynamics`, `/regions`, `/regions-tree`
- Нужно: аккаунт Yandex Cloud, каталог (folder), сервисный API-ключ.

### Вариант B - standalone Wordstat API v1

`yandex.ru/support2/wordstat/.../api-wordstat`. Привязан к доступу Wordstat/Direct.

- **Host:** `https://api.wordstat.yandex.net`
- **Auth:** `Authorization: Bearer <OAuth-token>`
- **Метод top:** `POST /v1/topRequests`
- **Тело:** `{"phrase":"стеклянные перегородки","regions":[213,225],"devices":["phone","desktop"]}`
- **Ответ:** `{"topRequests":[{"phrase":"...","count":12345}, ...]}` - похожие и
  вложенные запросы за последние 30 дней с частотой.
- Нужно: OAuth-токен с доступом к Wordstat.

Скрипт `scripts/wordstat.mjs` поддерживает **оба** режима (`WORDSTAT_MODE=aistudio|direct`),
транспорт вынесен в одну функцию - переключается env-переменной без правки кода.

**Выбор Ивана (07.07.2026): вариант B (standalone, OAuth-токен).** Workflow уже
стоит на `direct` по умолчанию, правок кода не нужно.

## Пошаговое подключение (вариант B)

1. **Активировать доступ к Wordstat API.** На странице «API Вордстата»
   (yandex.ru/support2/wordstat → API) оставить заявку на подключение API. Доступ
   Яндекс подтверждает не мгновенно - это шаг, который стоит начать первым.
2. **Зарегистрировать OAuth-приложение** на `oauth.yandex.ru`:
   - создать приложение;
   - Redirect URI - выбрать «Подставить URL для отладки» (debug-URL);
   - дать приложению доступ хотя бы к одному типу данных (scope Wordstat);
   - скопировать `ClientID` со страницы приложения.
3. **Получить OAuth-токен** (debug). Открыть в браузере, подставив свой ClientID:
   `https://oauth.yandex.ru/authorize?response_type=token&client_id=<ClientID>`
   Залогиниться - токен отобразится прямо на странице. Скопировать.
4. **Добавить секрет в GitHub.** Repo → Settings → Secrets and variables → Actions
   → New repository secret: имя `YANDEX_OAUTH_TOKEN`, значение - токен из шага 3.
5. **Запустить сбор.** Actions → «Wordstat semcore» → Run workflow:
   - сначала `dry_run = 1` (проверка коннекта, ничего не коммитит);
   - затем `dry_run = 0`, `mode = direct` - живой сбор, коммит в `data/semcore/`.
6. **Проверить результат.** В `data/semcore/index.json` у сидов `count_phrases > 0`
   и `measured` с датой. Если 0/ошибка - смотреть лог шага «Сбор» (чаще всего
   доступ ещё не активирован из шага 1, либо токен протух).

Токен - персональный, живёт ограниченный срок (обычно до года). Когда протухнет -
повторить шаг 3 и обновить секрет.

## Что нужно от Ивана (доступы)

Добавить в **GitHub Secrets** репозитория (Settings → Secrets → Actions):

**Если вариант A (AI Studio, по твоей ссылке):**
- `YANDEX_SEARCH_API_KEY` - API-ключ сервисного аккаунта Yandex Cloud
- `YANDEX_FOLDER_ID` - ID каталога Yandex Cloud

**Если вариант B (standalone):**
- `YANDEX_OAUTH_TOKEN` - OAuth-токен с доступом к Wordstat

Один набор, не оба. Скажи какой доступ у нас есть - зафиксирую `WORDSTAT_MODE`
по умолчанию в workflow.

## Регионы

Частотность зависит от региона. Дефолт: `213` (Москва) + `225` (Россия).
Список ID - метод `/regions` (вариант A) или справочник Wordstat. Меняются в
`WORDSTAT_REGIONS` (env) или per-seed в `data/seed-phrases.json`.

## Как это собирает семантическое ядро

```
data/seed-phrases.json   (сиды по брендам, ведёт Семён)
        │
        ▼  scripts/wordstat.mjs  (GitHub Actions, секреты)
        │      для каждого сида: POST top → {phrase,count}[]
        ▼
data/semcore/<brand>/<slug>.json   (сырьё: запросы + частота + дата)
data/semcore/index.json            (сводка: всего фраз, топ по частоте)
        │
        ▼  (Этап: кластеризация - ручная/полу-авто)
data/clusters.json                 (pillar/satellite, кормит контент-план)
```

Частота (`count`) - это `[ДАННЫЕ]` с датой замера и источником (Wordstat).
Кластеризация на первом шаге ручная (Семён группирует по интенту), позже -
полу-авто. Не выдумываем частоту: если сид не собран, поле пустое = «не измерено».

## Запуск

**В Actions:** workflow `Wordstat semcore` (`workflow_dispatch`), опционально по
расписанию. Коммитит `data/semcore/`.

**Локально (сеть к Яндексу открыта):**
```bash
export WORDSTAT_MODE=direct           # или aistudio
export YANDEX_OAUTH_TOKEN=...          # или YANDEX_SEARCH_API_KEY + YANDEX_FOLDER_ID
node gg-seo-geo-monster/scripts/wordstat.mjs
# проверить план без сети:
DRY_RUN=1 node gg-seo-geo-monster/scripts/wordstat.mjs
```

## Дисциплина (Protocol 9)

- `count` подаётся с датой замера и `source: wordstat` - иначе не показывать.
- Пустой сбор = «не измерено», не «ноль частоты».
- Прогноз трафика из частоты (CTR × позиция) - это `[ГИПОТЕЗА]`, не факт.

## Источники

Спека собрана из публичной документации Яндекса (страница по ссылке Ивана
отдаёт 403 боту, поэтому сверить точные имена полей варианта A нужно при первом
живом 200-ответе):

- AI Studio Search API Wordstat: aistudio.yandex.ru/docs/ru/search-api/concepts/wordstat.html
- REST-справка: yandex.cloud/ru/docs/search-api/api-ref/Wordstat/
- Standalone Wordstat API: yandex.ru/support2/wordstat (api-structure, api-wordstat)
