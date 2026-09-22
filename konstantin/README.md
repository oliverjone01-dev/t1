# Константин - живой бот отдела продаж GENGLASS

Отвечает в рабочем Telegram-чате на вопросы про отдел продаж, используя ключ Claude и данные дашбордов (снимки Bitrix). Крутится на VPS, публичный URL не нужен (long-polling).

## Как пользоваться в чате

- Упомяни бота: `@<имя_бота> что по Платоновой дожать?`
- Или ответь (reply) на любое сообщение бота с вопросом.
- Понимает склонения имён («по Лакомовой», «у Зазнобы»). Если менеджер назван - даёт глубокую карточку (топ сделок на дожим, застрявшие).
- Под каждым ответом - расход: `💰 N ₽ за ответ · за месяц ~M ₽ · запрос k/лимит`.

Бот отвечает ТОЛЬКО в заданном чате и ТОЛЬКО на обращение к себе (упоминание или reply) - болтовню в чате он не читает и не тратит на неё ключ.

## Что нужно

- VPS с Node.js 18+ (fetch встроен).
- Токен Telegram-бота (тот же `ROPCACHE_BOT_TOKEN`, бот должен состоять в чате).
- Ключ Anthropic (`ANTHROPIC_API_KEY`).
- Доступ к снимкам дашбордов (ветки данных репозитория) - тянутся скриптом `sync.sh`.

## Переменные окружения

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `BOT_TOKEN` | токен Telegram-бота | - (обязательно) |
| `CHAT_ID` | id рабочего чата (напр. -1003652568523) | - (обязательно) |
| `ANTHROPIC_API_KEY` | ключ Claude | - (обязательно) |
| `ROP_PATH` | путь к rop.json | `./data/rop.json` |
| `DIALOG_PATH` | путь к dialog.json | `./data/dialog.json` |
| `DAILY_LIMIT` | лимит запросов в день (общий на чат) | `30` |
| `MODEL` | модель Claude | `claude-sonnet-5` |
| `RUB_PER_USD` | курс для расчёта расхода | `95` |
| `LOG_DIR` | папка логов и счётчиков | `./log` |

## Установка

```bash
git clone <репозиторий> && cd konstantin       # или скопируй папку konstantin/ на VPS
# 1) настрой синхронизацию снимков (ветки данных → ./data)
export REPO_URL="https://<токен>@github.com/oliverjone01-dev/t1.git"
bash sync.sh                                    # первый прогон, дальше по cron
# 2) запусти бота
export BOT_TOKEN=... CHAT_ID=-1003652568523 ANTHROPIC_API_KEY=...
npm start
```

Синхронизация снимков по cron (каждые 30 минут):

```
*/30 * * * * cd /opt/konstantin && REPO_URL="https://<токен>@github.com/oliverjone01-dev/t1.git" bash sync.sh >> log/sync.log 2>&1
```

## systemd (автозапуск и перезапуск)

`/etc/systemd/system/konstantin.service`:

```ini
[Unit]
Description=Konstantin sales bot
After=network.target

[Service]
WorkingDirectory=/opt/konstantin
Environment=BOT_TOKEN=xxx
Environment=CHAT_ID=-1003652568523
Environment=ANTHROPIC_API_KEY=xxx
Environment=DAILY_LIMIT=30
ExecStart=/usr/bin/node bot.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now konstantin
journalctl -u konstantin -f      # логи
```

## Контроль расхода

- Дневной лимит запросов (`DAILY_LIMIT`) - общий на чат; при превышении бот отвечает «лимит на сегодня исчерпан».
- Лог расхода: `log/YYYY-MM.jsonl` - по строке на запрос (кто, вопрос, токены, ₽). Месячная сумма показывается под каждым ответом.
- Расход считается по токенам ответа Claude (Sonnet 5: вход $2 / выход $10 за 1M). Контекст компактный (сводка + карточка нужного менеджера), поэтому один ответ - единицы рублей.

## Безопасность

- Ключ Claude живёт только на VPS (env / systemd), в репозиторий не коммитится.
- Бот привязан к одному `CHAT_ID` - в другие чаты не отвечает.
- Данные ответов чувствительны (суммы, имена, клиенты) - чат рабочий, наружу выносить нельзя.
- Бот берёт цифры только из снимка дашборда; выдумывать не должен (заложено в системный промпт). Если снимок устарел - в ответе видна дата снимка.
