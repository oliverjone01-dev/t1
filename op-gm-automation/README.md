# Автоматизация ОП ГМ

Проект автоматизации отдела продаж ГМ. Живёт в отдельной ветке `op-gm-automation-v1`
и публикуется на отдельный URL, не задевая остальной сайт GENGROUP.

## URL

- Бой: `https://oliverjone01-dev.github.io/t1/op-gm/`

## Как устроена публикация

По образцу `/rop/`, `/prod/` и `/office/` (см. `.github/workflows/deploy-pages.yml`):

1. Контент проекта лежит в этой ветке (`op-gm-automation-v1`), папка `op-gm-automation/public/`.
2. Шаг `Build OP-GM automation (isolated, /op-gm/)` в `deploy-pages.yml` (в main) забирает
   ветку через `git fetch` + `git worktree` и копирует `public/` в `_site/op-gm/`.
3. Шаг обёрнут в `continue-on-error: true` - поломка проекта не валит остальной сайт.

Деплой срабатывает при каждом запуске `deploy-pages.yml` (push в main, ночные синки,
ручной workflow_dispatch). Чтобы выкатить свежие правки этой ветки без ожидания -
Actions → "Deploy to GitHub Pages" → Run workflow.

## Структура

```
op-gm-automation/
  README.md        - этот файл
  public/          - статика, публикуется в /op-gm/ как есть
    index.html     - стартовая страница проекта
```

## Правила

- Вся разработка проекта - в ветке `op-gm-automation-v1`, не в main.
- Статика self-contained: без внешних CDN, данные запекать в HTML или класть рядом в `public/`.
- Перед публикацией содержательных артефактов - Step 12.5 (ФЕНИКС), как для любого критического деливерабла.
