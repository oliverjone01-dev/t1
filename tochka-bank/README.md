# Точка Банк - ежедневный синк остатка и поступлений

Интеграция с Open API Точка Банка: каждый день забирает **остаток по расчётным
счетам** и **поступления за операционный день**, кладёт снимок в `data/` и печёт
самодостаточный дашборд в `/tochka/`.

Read-only по построению: только чтение счетов и выписки. Никаких платежей и мутаций.
Токены живут в GitHub Secrets и в клиентский HTML не попадают.

## URL

- Бой: `https://oliverjone01-dev.github.io/t1/tochka/`

## Как устроено (паттерн direct-snapshots / ozon-snapshots)

```
tochka-bank/
  fetch.mjs        - клиент API: auth -> счета -> баланс -> выписка -> data/latest.json (+ history.ndjson)
  build.mjs        - печёт data/ -> public/index.html (данные запекаются в HTML)
  data/            - снимки (коммитятся воркфлоу)
  public/          - собранный дашборд, публикуется в /tochka/
```

1. `.github/workflows/tochka-snapshots.yml` (ежедневный cron ~09:30 МСК) запускает
   `node fetch.mjs` -> дельта-гейт -> `node build.mjs` -> commit `data/` и `public/`.
2. Успешный синк триггерит `deploy-pages.yml` (`workflow_run`) -> публикация `/tochka/`.
3. Шаг в `deploy-pages.yml` обёрнут в `continue-on-error` - поломка не валит остальной сайт.

Запустить вручную: Actions → «Tochka snapshots» → Run workflow (можно указать `day`).

## Что нужно от владельца счёта (подключение к боевому API)

API Точки использует OAuth2 с согласиями (consents). Чтобы синк заработал:

1. В личном кабинете Точки: **Настройки → Интеграции → создать приложение**.
   Указать `redirect_uri`, выбрать права **на чтение счетов и выписок** (read-only).
   Получить `client_id` и `client_secret`.
2. Пройти согласие (consent) и выпустить токены. Дальше - один из двух режимов:

   **Режим A (просто, но access-токен живёт ~24ч):**
   - положить действующий access-token в секрет `TOCHKA_TOKEN`.

   **Режим B (рекомендуется для ежедневного крона):**
   - положить `TOCHKA_REFRESH_TOKEN` (живёт ~30 дней), `TOCHKA_CLIENT_ID`,
     `TOCHKA_CLIENT_SECRET`. `fetch.mjs` сам обменяет refresh на свежий access
     при каждом запуске. Если Точка ротирует refresh-token - синк напишет
     warning с напоминанием обновить секрет (значение печатается в маске).

3. Добавить секреты в репозиторий: **Settings → Secrets and variables → Actions**.

### Секреты

| Секрет | Обязателен | Назначение |
|---|---|---|
| `TOCHKA_TOKEN` | Режим A | Bearer access-token |
| `TOCHKA_REFRESH_TOKEN` | Режим B | refresh-token (30 дней) |
| `TOCHKA_CLIENT_ID` | Режим B | client_id приложения |
| `TOCHKA_CLIENT_SECRET` | Режим B | client_secret приложения |
| `TOCHKA_CUSTOMER_CODE` | нет | фильтр счетов по коду клиента |
| `TOCHKA_ACCOUNT_FILTER` | нет | оставить только нужные р/с (подстрока номера) |
| `TOCHKA_API_BASE` | нет | по умолчанию `https://enter.tochka.com/uapi` |
| `TOCHKA_API_VERSION` | нет | по умолчанию `v1.0` |

## Эндпоинты API (Open Banking, read-only)

- `GET  /open-banking/{ver}/accounts` - список счетов (accountId, номер, валюта).
- `GET  /open-banking/{ver}/accounts/{accountId}/balances` - остаток (доступный/закрывающий).
- `POST /open-banking/{ver}/statements` - создать выписку за период (async).
- `GET  /open-banking/{ver}/accounts/{accountId}/statements/{statementId}` - забрать операции;
  поступления = операции с `creditDebitIndicator = Credit`.

Авторизация: `Authorization: Bearer <access_token>`. Токен-эндпоинт для рефреша:
`https://enter.tochka.com/connect/token` (`grant_type=refresh_token`).

## Локальный прогон

```bash
cd tochka-bank
TOCHKA_TOKEN=... node fetch.mjs          # или связка refresh + client_id/secret
node build.mjs                           # печёт public/index.html
```

## Границы и безопасность

- Только чтение. Скрипт не умеет создавать платежи.
- Токены - только в env/Secrets, в репозиторий и в HTML не пишутся, в логах маскируются.
- Дельта-гейт: снимок с 0 счетов не публикуется (защита от битого ответа/протухшего токена).
- Первый боевой прогон стоит сверить с реальным ответом API: если у вашего контура
  Точки другой регистр/обёртка полей выписки - поправить маппинг в `fetch.mjs`
  (функции `extractBalance` / `extractTransactions`, они уже написаны защитно).
