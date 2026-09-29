# Git, снимки, cron: правила

Закрывают К12. Источники: `sources.md` (раздел «Механизм и git»).


1. **Снимки в отдельной ветке `data` или отдельном репо, код в main.** Бот пишет только в `data`, билдер читает её через `git fetch`/worktree. Паттерн git scraping: https://simonwillison.net/2020/Oct/9/git-scraping/ (рекомендую: выделять в ветку).
2. **Коммитить только при изменениях, один батч-коммит за прогон** (`git diff --quiet || git commit`): https://til.simonwillison.net/github-actions/commit-if-file-changed. Логи и трейсы в `.gitignore`, в Actions загружать их как artifacts.
3. **Бот пушит через `GITHUB_TOKEN`, не через PAT.** Такие события не запускают новые workflow (кроме `workflow_dispatch` и `repository_dispatch`), и петли не возникает: https://docs.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token
4. **`concurrency: {group: data-snapshot, cancel-in-progress: false}`**: в группе один запущенный и один ожидающий прогон. Перед push делать `git pull --rebase` с повтором: https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs
5. **Сгенерированный HTML не хранить в main.** Собирать в CI и деплоить артефакт (рекомендую). Если хранить всё же нужно: `linguist-generated=true` сворачивает такие файлы в PR-диффе (https://thoughtbot.com/blog/github-diff-supression), и хук из п.2 предупреждает о правке.
6. **`merge=union` только для append-only логов, где строки не зависят друг от друга** (например, реестр ошибок .jsonl). Он может переставить или задублировать строки. **Кнопка merge на GitHub кастомные драйверы игнорирует**: https://github.com/orgs/community/discussions/9288. `merge=ours` не встроен, нужен локальный `git config merge.ours.driver true`, в CI его нет (из знаний о git, git-scm.com был заблокирован прокси).
7. **После squash-merge удалить ветку и создать заново от main**, иначе старый merge-base снова даёт разрешённые конфликты: https://sudolabs.com/insights/reoccurring-conflicts-after-git-squash-merge, https://learn.microsoft.com/en-us/azure/devops/repos/git/merging-with-squash. Включить автоудаление head-веток.
8. **Билдер сам отказывается запускаться на main без флага** (fail-closed), а хук дублирует проверку (рекомендую).
9. **Сборщики fail-closed**: при пустом или частичном ответе ненулевой код выхода, запись во временный файл и атомарный rename, никогда не перезаписывать снимок пустым диапазоном (закрывает и К7). В CI actionlint для YAML, тесты с замороженным временем вместо литералов дат (рекомендую).
10. **Хендоффы и реестр ошибок всегда в main** короткими PR. Рабочие ветки агентов живут недолго.


## Правила репо t1 (из ретро)

- Рабочая ветка агента не содержит снимков данных: `analytics-mvp/data*/`, `public/**/*.html` коммитит бот или пересборка на main через workflow.
- Workflow снимков не запускается на рабочей ветке (иначе бот пушит туда и `git pull` даёт self-merge).
- После squash-мержа PR: `git fetch origin main && git checkout -B <ветка> origin/main`.
- Хендофф и запись реестра ошибок: отдельный короткий PR в main в тот же день.
- Трейсы (`traces/`) коммитятся пачкой в конце дня, не после каждого хода.
- Пересборка на main только через workflow, не руками агента.
