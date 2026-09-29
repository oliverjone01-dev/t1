# ФЕНИКС: data-guard, итерация 5 (29.09.2026)

**Оценка 8.2 из 10, вердикт RETURN.** По баллам это диапазон «go с gaps», но по правилу 9 (feniks.md:150) вердикт снижен до return: проба A4 снова дала FAIL. Переход на белый список сработал. Все 16 команд итерации 4 теперь дают ask, и путь go работает. Однако белый список проверяет только сегменты перед push. Сам push или merge хук распознаёт, лишь когда сегмент начинается с `git`. Если перед ним стоит ключевое слово оболочки (`do`, `then`, `if`, `while`, `until`), команда проходит молча. Хук итерации 4 (0c7ad605) на тех же командах тоже молчит, так что это не регрессия, а мой недосмотр в итерациях 1-4.

## Сверка
- **Хеш.** Пересчитал сам: `4ce8e09ed0bb1d23`, совпадает с переданным. После `git fetch` origin/main стоит на 60ec3c23, merge-base остался 46e87314, `git merge-tree` проходит без конфликтов.
- **Тесты.** `data-guard-tests.py` 105 из 105, `run-hook-tests.sh` 119 из 119.
- **Коммит.** В добавленных строках нет em dash. Трейлеры Rework, Co-Authored-By и Claude-Session на месте. Файлы `.claude/agents/feniks.md` и `agents/feniks.md` идентичны.

## Пробы
Фикстура: `scratchpad/feniks-i5/`. В ней свежий bare origin; `numbers` (pull/50) содержит цифры, `docs` (pull/51) нет; `goodbr` содержит `tools/x.json`, и на его хеш `811e45663087f86a` записан go.

| ID | Результат | Доказательство |
|---|---|---|
| A1 | PARTIAL (принято) | Ручная строка go со свежим ts проходит, это остаточный риск из SKILL. go из будущего игнорируется, более поздний return перекрывает go |
| A1b | PASS | `DG_OVERRIDE=...`, `-m 'Иван разрешил'` и override в commit_message MCP дают ask |
| A4 | **FAIL** | Все команды итерации 4 дают ask: G1 с work и с main, G2 (am, apply, reset, checkout --, restore, stash, cherry-pick, echo >, sed, python), G4 (`bash -c`, `sh -c`), G5 (`work:main` и `refs/heads/work:refs/heads/main` при цифрах в дереве). Обход списком ниже |
| A5 | PASS | Молчат `pull && push`, `pull --rebase origin main && push -u origin work`, `merge origin/main` (в том числе с `-m`), push рабочей ветки, `merge --no-ff -m 'Merge docs' docs`, `gh pr merge -t/-b ... 51`. Путь go работает: `merge -m ... goodbr` молчит, затем отдельный `git push` тоже молчит. `add/commit/push` при go на `--worktree` молчит (в том числе с heredoc в `-m`). Консервативные ask на main: `rebase origin/main`, `sleep`, `python3` перед push, это допустимо. Prompt: 1 срабатывание из 3 бытовых фраз («оборотная сторона»), как было |
| A7 | PASS | go возрастом 80 ч даёт ask |
| fail-closed | PASS | При битом конфиге push в main, `gh pr merge` и цикл с push дают ask, а `push -u origin work` молчит |

**Что при A4 проходит молча** (на main с локальным коммитом `tools/local.json`, где простой `git push origin main` даёт ask):
1. **Ключевое слово оболочки в начале сегмента** (MAJOR). Такой сегмент не распознаётся как git: в список неизвестных операций уходит `do`, а цель push не создаётся совсем.
   - `for i in 1 2 3 4; do git push && break || sleep $((2**i)); done`. Эта идиома retry встречается в 4 workflow репо: harvest.yml:65, wordstat-semcore.yml:63, keyso-collect.yml:74, orders-backfill.yml:86 [ДАННЫЕ: grep]. Как часто агенты пишут её в интерактивных командах, неизвестно [ГИПОТЕЗА].
   - `until git push origin main; do sleep 2; done` и `while ! git push origin main; do ...`
   - `if git merge numbers; then git push origin main; fi` и `if true; then git push origin main; fi`
2. **Перенаправление в файл у git-команды** (MAJOR). `>` проверяется только у не-git сегментов, поэтому проходит `git show numbers:<путь> > <путь> && git add -A && git commit -m x && git push origin main`. Для репо это обычная идиома «взять файл из ветки». Та же форма обходит go: после go на worktree-хеш команда `git show HEAD:... > tools/wt.json && add && commit && push` молчит. Это «правка после go», которую коммит объявляет закрытой.
3. **fetch в белом списке двигает локальный main** (minor). С рабочей ветки молчат `git fetch . numbers:main && git push origin main` и `git fetch origin numbers:main && ...`.
4. **Прочее** (minor):
   - `@:main`, `HEAD~0:main`, `HEAD^{}:main` не распознаются как push в main (`is_main_ref`, data-guard.py:273);
   - `git pull` без аргументов на рабочей ветке тянет upstream этой ветки, а белый список считает его pull из origin main;
   - перенаправления `>|` и `&>` у echo не ловятся.

**Точность (minor):**
- В additionalContext хука (data-guard.py:480) осталась фраза «Составную команду... хук оценивает по итоговому содержимому». Это то же старое обещание, которое исправили в SKILL.
- При действующем go и одной команде `merge goodbr && push origin main` причина ask звучит как «без go ФЕНИКСА». Это вводит в заблуждение, агенту стоит прямо предложить разделить команду.
- Тест «G5» содержит `git checkout work && ...`, поэтому ask даёт checkout, а G5 фактически не проверяется. Форма `git switch main && git pull && git merge ... && git push origin main` в тесты не попала, хотя моя проба на ней даёт ask.

## Что закрыто
- G1: смена ветки внутри команды.
- G2: am, apply, reset, checkout --, restore, stash, cherry-pick, запись файлов через shell, правка через sed после go.
- G3: путь go для `merge -m`, `gh pr merge -t`, `cherry-pick -m 1`.
- G4: bash -c и sh -c.
- G5 работает (проверено моей пробой с цифрами в дереве).
- G6 в SKILL.
- fail-closed при сбое хука.

## rework_tz
1. **R1 (обязательно).** В `segments` снимать ведущие `do/then/else/elif/if/while/until/!`, как это делается с обёртками. Нужны тесты на retry-цикл push, `until` и `if merge; then push`.
2. **R2 (обязательно).** Токены `>`, `>>`, `>|`, `&>` и опцию `--output` в любом сегменте, включая git, считать неизвестной операцией (unknown_ops). Нужен тест `git show X:путь > путь && commit && push` при go на worktree.
3. **R3.** `fetch` с refspec, где приёмник - локальная ветка, считать неизвестной операцией.
4. **R4.** В `is_main_ref` принимать любой src перед `:main`.
5. **R5.** Поправить текст additionalContext и причину ask для неизвестных операций (подсказать разделить команду). Сделать тест G5 без checkout.

## Self-check
- **Accuracy 8.0.** SKILL обещает «всегда спрашивает», а для п.1-3 это неверно. Плюс устаревший текст в хуке и тест G5.
- **Actionability 8.5.** Путь go работает в два шага и через worktree.
- **Insight 8.5.** Смена подхода на белый список и fail-closed закрывают класс проблем по построению, но распознавание цели осталось чёрным списком.
- **Brand fit 8.5.**
- **Risk 7.5.** Канонические пути закрыты, но молчат retry-цикл и `git show >`.

Расчёт: 8.0×0.25 + 8.5×0.25 + 8.5×0.2 + 8.5×0.15 + 7.5×0.15 = 8.225, округляю до 8.2. JSON отчёта прошёл проверку: «VALID по схеме audit-report». Файл: `/tmp/claude-0/-home-user-turbium/73fa2544-6bbc-5692-96c4-41c825f82fc5/scratchpad/feniks-i5/report.json`.

## Что я изменил
- В `/home/user/t1/traces/2026-09-29/agents.jsonl` дописал одну строку `event: audit`: task_id `feniks-data-guard-iter5-20260929`, verdict return, feniks_score 8.2, audited_hash `4ce8e09ed0bb1d23`. Охват указан в note: итерации 1-5 вместе покрыли все 39 путей ветки без служебных, дельту 5abad9aa (хук, тесты, SKILL) я проверил целиком. `git status` показывает только этот файл, хеш после записи не изменился.
- В t1 выполнил `git fetch -q origin`, сдвинулись только remote-tracking refs.
- Все пробы шли в `/tmp/claude-0/-home-user-turbium/73fa2544-6bbc-5692-96c4-41c825f82fc5/scratchpad/feniks-i5/`: `probe.py` для текущего хука и `probe4.py` с `dg-iter4.py` для сравнения с итерацией 4.
- Отчёт в episodes я не писал: по заданию меняю только строку трейса. Если нужна копия в `knowledge/episodes/2026-09/feniks-audit-data-guard-iter5-20260929.md`, её может закоммитить автор.

## Ключевые пути
- `/home/user/t1/.claude/hooks/data-guard.py`:
  - `segments` 234-259 (сюда нужны ключевые слова, R1);
  - `merge_targets` 320-385 (перенаправление проверяется только у не-git сегментов, строки 349-354, R2);
  - `safe_before_push` 308-317 (fetch, R3);
  - `is_main_ref` 272-273 (R4);
  - текст 480 (R5).
- `/home/user/t1/.claude/hooks/tests/data-guard-tests.py`: блок итерации 4, тест G5.

AUDITED: 4ce8e09ed0bb1d23
VERDICT: return
