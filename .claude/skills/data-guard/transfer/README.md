# data-guard: перенос в другой аккаунт или репозиторий

Скилл «цифры без переделок»: pre-mortem по реестру прошлых ошибок (классы К1-К14), спека метрики до кода,
probe источника, инварианты в билдере, сверка с независимым источником, ретро в реестр.
Собран из ретро чатов аналитики GENGROUP (июнь-сентябрь 2026).

## Вариант A. Скилл в аккаунте claude.ai (чат, Cowork, Claude Code без хуков)
1. claude.ai -> Settings -> Skills -> Upload skill -> файл `account/data-guard.zip`.
2. Проверка: в новом чате написать «собери дашборд по выручке» - скилл должен подхватиться и начать с pre-mortem.

Реестр ошибок внутри: `references/registry-snapshot.jsonl` (снимок на дату сборки).
Скрипты (`registry_match.py`, `invariants.py`, `audit_hash.py`) запускаются из папки скилла.

## Вариант B. Claude Code в другом репозитории (скилл + хуки-предупреждения + реестр)
1. `bash install.sh /путь/к/репо`
2. В целевом репо поправить `.claude/data-guard.json`: `numbers_globs`, `generated_globs`, `snapshot_globs`,
   `trace_globs`, `build_script_regex`. Сейчас там пути и имена сборщиков репо t1 (`analytics-mvp/...`).
   Без правки хуки будут молчать на файлах с цифрами, но не сломаются.
3. Проверка: `python3 .claude/hooks/tests/data-guard-tests.py -v`, затем новая сессия Claude Code в репо
   (хук session-start показывает памятку data-guard).
4. В CLAUDE.md целевого репо добавить абзац из `repo/.claude/skills/data-guard/bootstrap.md`.

Хуки только предупреждают и спрашивают подтверждение, ничего не отменяют.
Выключатель: `DATA_GUARD_OFF=1` в окружении или удалить `.claude/data-guard.json`.
Переопределение одного шага: `DG_OVERRIDE="причина"` в команде.

## Что внутри
- `account/data-guard.zip` - скилл для загрузки в аккаунт (папка скилла и снимок реестра).
- `repo/.claude/skills/data-guard/` - скилл.
- `repo/.claude/hooks/data-guard.py`, `repo/.claude/hooks/tests/` - хуки и их тесты.
- `repo/.claude/data-guard.json` - настройки хуков.
- `repo/.claude/data-guard.hooks.json` - записи хуков для settings.json (их дописывает `install.sh`).
- `repo/knowledge/errors/` - живой реестр ошибок и его README.
- `install.sh`, `merge_hooks.py` - установка варианта B.

Ссылки в SKILL.md на `knowledge/semantic/`, `knowledge/decisions.md`, `knowledge/os/analytics-dod.md` ведут в папки
репо t1. В другом репо заведи свои или пропускай эти шаги: скилл это допускает («вне репо t1 используй
`references/classes.md`»). Реестр обезличен (без фамилий, телефонов, email, номеров заказов), но описывает
внутренние ошибки GENGROUP: передавать только своим.
