# Runbook: «Подтащи обнову у Димы»

**Триггер:** Иван говорит «подтащи обнову у Димы» либо «синкани с эталона».
**Owner процедуры:** Claude (текущая сессия).
**Что делает:** тянет последний прогресс из `rop-dashboard-v1` (Димин эталон) в нашу `ozon-dashboard-dima-fork` (копия Ивана) без затирания нашей работы.

## Механика

### Что мы тянем от Димы

Файлы, которые Дима владеет и обновляет:
- `analytics-mvp/rop/data/rop.json` — snapshot Bitrix24
- `analytics-mvp/rop/rop-command.template.html` — шаблон дашборда
- `analytics-mvp/rop/plan/plan.json` — план продаж
- `analytics-mvp/src/scripts/b24/*.ts` — build/fetch скрипты
- `analytics-mvp/public/rop-command.html` — собранный HTML
- Любые изменения в его episodes / docs

### Что мы НЕ трогаем (наше)

Файлы которые появились после отрезки fork'а (Дима их не видит):
- `.claude/skills/sales-director/**` — наш skill
- `Kostya-analitycs-2026/**` — Костины анализы (тянуты из main)
- `knowledge/episodes/2026-06/kostya-analitycs-synthesis-20260630.md`
- `knowledge/episodes/2026-06/gm-managers-stash-for-future-dashboard.md`
- `knowledge/episodes/2026-06/feniks-audit-sales-director-*.md`
- `knowledge/episodes/2026-06/sync-from-dima-runbook.md` (этот файл)

Пересечения не ожидаются. Merge должен пройти чисто.

## Процедура (шаги Claude)

### 1. Проверка чистоты fork-ветки

```bash
git status --short
```

Если есть uncommitted changes — сначала коммитить/стешить, потом sync. Синкать грязный tree = потерять правки.

### 2. Fetch latest от Димы

```bash
git fetch origin rop-dashboard-v1
```

### 3. Показать что нового у Димы (Иван читает список)

```bash
git log --oneline HEAD..origin/rop-dashboard-v1
```

Если пусто — Дима ничего не пушил, sync не нужен. Сообщить Ивану, выйти.

### 4. Merge с anchor-message для audit trail

```bash
git checkout ozon-dashboard-dima-fork
git merge origin/rop-dashboard-v1 -m "sync: pull latest from rop-dashboard-v1 (Dima) $(date +%Y-%m-%d)

Тянем последний прогресс эталона от Димы. Наши файлы (skill sales-director,
Костины анализы, episodes) не трогаются.

Список коммитов Димы:
<вставить git log --oneline HEAD..origin/rop-dashboard-v1>"
```

### 5. Если merge conflict (не ожидается, но возможен)

**Ожидаемые файлы конфликтов если Дима правил то что мы тоже правили:**
- `analytics-mvp/public/rop-command.html` — если Дима перекомпилил + мы правили руками

**Правило разрешения:**
- Наши файлы (`.claude/skills/sales-director/**`, Kostya, episodes) — **всегда наш вариант** (`--ours`)
- Диминые файлы (`analytics-mvp/rop/**`, `analytics-mvp/src/scripts/b24/**`) — **всегда его вариант** (`--theirs`)
- Смешанные (workflow YAML, CLAUDE.md, glossary) — прочитать оба, руками смёржить (не автовыбор)

```bash
# автоматическое разрешение по правилам выше:
git checkout --theirs analytics-mvp/rop/ analytics-mvp/src/scripts/b24/ analytics-mvp/public/rop-command.html
git checkout --ours .claude/skills/sales-director/ Kostya-analitycs-2026/ knowledge/episodes/2026-06/kostya-analitycs-synthesis-*.md knowledge/episodes/2026-06/gm-managers-stash-*.md knowledge/episodes/2026-06/feniks-audit-sales-director-*.md
git add -A
```

**Если остались нестандартные конфликты** — остановиться, показать Ивану, спросить как разруливать. Не гадать.

### 6. Push в fork

```bash
git push origin ozon-dashboard-dima-fork
```

### 7. Обновить `/rop-preview/` на GitHub Pages

Preview обновляется автоматически при следующем deploy главного сайта (push в main / nightly / manual dispatch). Для срочной актуализации preview прямо сейчас:

```bash
# Через GitHub UI: Actions → "Deploy to GitHub Pages" → Run workflow →
#   rop_preview_ref = ozon-dashboard-dima-fork (default)
```

Либо через gh CLI если доступен.

### 8. Отчёт Ивану

Формат:
```
Синк с Димой завершён.
- Тянули X коммитов из rop-dashboard-v1 (эталон Димы).
- Merge: clean / <конфликт-описание>.
- Наши файлы не тронуты (проверено: git log --name-only --author=... от точки sync).
- /rop-preview/ обновится: <ETA до следующего deploy>.

Что нового у Димы:
<git log --oneline>
```

## Anti-pattern (что не делать)

- ❌ Не делать `git pull --rebase` — переписывает нашу историю, ломает fork-tag reference
- ❌ Не делать `git reset --hard origin/rop-dashboard-v1` — стирает нашу работу
- ❌ Не делать merge с флагом `-Xtheirs` глобально — потеряем наши файлы если Дима случайно тронул что-то наше
- ❌ Не мёржить если есть uncommitted changes — сначала save state
- ❌ Не запускать `npm run fetch:live` в этой сессии — у нас нет токенов Bitrix. Данные приходят с Диминой стороны через его коммиты

## Rollback (если синк оказался плохим)

```bash
git reflog | head -5  # найти commit до merge
git reset --hard <hash-before-merge>
git push origin ozon-dashboard-dima-fork --force-with-lease
```

**Только с разрешения Ивана.** Force-push переписывает удалённую ветку.

## Related

- Fork создан на коммите `861f5ca` (2026-06-30) от `rop-dashboard-v1`
- Синтез что общего Кости и дашборда: `kostya-analitycs-synthesis-20260630.md`
- Skill sales-director: `.claude/skills/sales-director/`
- GitHub Pages deploy: `.github/workflows/deploy-pages.yml`

## Log синков

Первый sync после создания fork — пока не было. Записывать формат:

```
YYYY-MM-DD HH:MM: pulled <N> commits from rop-dashboard-v1@<sha>. Conflicts: <none/list>. Duration: <minutes>.
```
