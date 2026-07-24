# GG Message Automation - автоматизация сообщений в чаты команды

Внутренний инструмент GENGROUP: панель, из которой команда собирает, расписывает
и выгружает автосообщения в рабочие чаты (Telegram / Bitrix24) - напоминания о
планёрках, KPI-сводки, уведомления о деплоях, кризис-алерты.

Живёт в отдельной ветке `claude/gg-message-automation-ffpwpd` и публикуется на
отдельный URL, не задевая остальной сайт GENGROUP.

## URL

- Бой: `https://oliverjone01-dev.github.io/t1/messages/`

## Что это (и чего это НЕ делает)

Панель - **генератор конфигов и превью**, не сервер отправки:

- собирает правило `template + channel + variables + cron`;
- показывает живое превью «как в чате»;
- отдаёт готовый payload под Telegram Bot API (`sendMessage`) или бота Bitrix24
  (`imbot.message.add`);
- выгружает всё правило одним `schedule.json`.

Реальную рассылку запускает планировщик (GitHub Actions cron / n8n / бот) - он же
хранит токены и вебхуки в секретах. В браузере секретов нет. Включение боевой
рассылки - отдельный HITL-шаг (Protocol 6): правило проверяет человек.

## Как устроена публикация

По образцу `/op-gm/`, `/rop/`, `/prod/` (см. `.github/workflows/deploy-pages.yml`):

1. Контент лежит в этой ветке, папка `gg-message-automation/public/`.
2. Шаг `Build GG message automation (isolated, /messages/)` в `deploy-pages.yml`
   (в main) забирает ветку через `git fetch` + `git worktree` и копирует `public/`
   в `_site/messages/`.
3. Шаг обёрнут в `continue-on-error: true` - поломка проекта не валит остальной сайт.

Чтобы выкатить свежие правки без ожидания: Actions → "Deploy to GitHub Pages" →
Run workflow.

## Структура

```
gg-message-automation/
  README.md        - этот файл
  send.js          - референс-отправщик для планировщика (читает schedule.json)
  public/
    index.html     - панель (self-contained, данные в localStorage)
```

## Как включить отправку

1. Собери правила в панели, выгрузи `schedule.json`, закоммить в ветку.
2. Заведи бота (Telegram `@BotFather` или входящий вебхук Bitrix24), положи токен
   в секрет (`TG_BOT_TOKEN` / `B24_WEBHOOK_URL`).
3. Подключи cron-воркфлоу, который дёргает `node gg-message-automation/send.js schedule.json`.

## Правила

- Вся разработка - в ветке `claude/gg-message-automation-ffpwpd`, не в main.
- Статика self-contained: без внешних CDN, данные в HTML или рядом в `public/`.
- Никаких токенов в репозитории и в HTML - только в секретах планировщика.
