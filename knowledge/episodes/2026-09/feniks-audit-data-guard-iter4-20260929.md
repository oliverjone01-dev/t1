# ФЕНИКС: data-guard, итерация 4 (29.09.2026)

**Оценка 7.9 из 10, вердикт RETURN.** По баллам это диапазон «go с gaps». Вердикт опущен до return по правилу 9: проба A4 снова дала FAIL. Все пункты R1-R7 из прошлого ТЗ сделаны буквально, четыре команды итерации 3 теперь дают ask. Но корень проблемы остался: хук оценивает состояние до выполнения команды. Поэтому молчит канонический путь, когда Claude вливает свою ветку в main одной командой. Эту дыру я пропустил в итерациях 1-3, она была и в хуках e74186ef и e3322004 (проверил их на той же фикстуре). Значит, это не регрессия, а мой прошлый недосмотр, и балл за него не снижаю: 7.9 против 7.8.

## Сверка
- **Хеш.** Пересчитал сам: `2a3684c879c9683b`, совпадает с переданным. После `git fetch` origin/main ушёл на a74f4359, merge-base по-прежнему 46e87314, хеш не изменился. `git merge-tree` с origin/main проходит без конфликтов.
- **Тесты.** `data-guard-tests.py`: 85 из 85. `run-hook-tests.sh`: 119 из 119.
- **Файлы и коммит.** `.claude/agents/feniks.md` и `agents/feniks.md` идентичны. В добавленных строках 0c7ad605 нет em dash. Трейлеры Rework, Co-Authored-By и Claude-Session на месте.

## Пробы
Фикстура: `scratchpad/feniks-i4/`. В ней bare origin, main = 46e87314, `numbers` = `pull/50` = 0c7ad605 (ветка с цифрами), `docs` = `pull/51` (только docs).

| ID | Результат | Доказательство |
|---|---|---|
| A1 подделка трейса | PARTIAL (принято) | Ручная строка go со свежим ts проходит, это остаточный риск из шага 7. R6 закрыт: go из будущего игнорируется, более поздний return перекрывает go, 6 каталогов с будущими датами не вытесняют настоящий |
| A1b override | PASS | `DG_OVERRIDE='decisions.md#...'`, `-m 'Иван разрешил'`, override в `commit_message` MCP: везде ask, причина видна только в тексте |
| A4 обход разбора | **FAIL** | Закрыто, дают ask: `merge`, `cherry-pick`, `rebase`, `pull origin numbers`, `add/commit -am && push` (включая `;` и обёртки env, timeout, command), `git merge numbers` без push. Вся R3 тоже: `gh pr merge numbers`, URL, `-R`, `--repo`, `numbers:main`, `refs/heads/...`, `gh api PUT`, MCP. Открытые пути в списке ниже |
| A5 FP и мёртвый гейт | PARTIAL | Молчат, как и должны: чтения, push рабочей ветки, `pull`, `pull --rebase origin main && push`, `merge origin/main`, `--allow-empty`. Новое ложное срабатывание в списке ниже. Prompt: 1 FP из 3 бытовых фраз («оборотная сторона»), как и раньше |
| A7 срок | PASS | go возрастом 80 ч даёт ask |

**Команды, которые при A4 проходят молча:**
1. **Смена ветки в той же команде.** Для Claude это основной путь влить ветку в main одной командой. Пропускаются:
   - `git checkout main && git merge --no-ff numbers -m 'Merge: data-guard' && git push origin main`, запущенная с ветки numbers;
   - `git checkout main && git merge numbers && git push` и `git switch main && git pull && git merge --no-ff numbers && git push origin main`, запущенные с work;
   - `git switch numbers && git push origin HEAD:main`, запущенная с main.

   Почему так: checkout и switch не меняют `cur_branch` в `merge_targets`, поэтому push оценивает локальный main до слияния (`data-guard.py:304-311`). В сентябре Claude трижды вливал ветку в main локальным merge и ещё 5 раз ветку после «merge main в ветку» подняли в main fast-forward'ом [ДАННЫЕ: `git log origin/main --first-parent --merges --since=2026-09-01 --committer=Claude`, 8 коммитов]. Сколько из них сделано одной командой, неизвестно.
2. **Содержимое, которое нельзя определить до выполнения.** На main молчат:
   - `git am <patch>`;
   - `git apply ... && git add -A && git commit && git push`;
   - `git reset --hard numbers && git push -f origin main`;
   - `git checkout numbers -- . && git commit ...`;
   - `git restore --source numbers ...`;
   - `git stash pop && git commit -am`;
   - запись файлов через shell перед коммитом: `echo > tools/y.json`, `python3 tools/sync.py`.

   В R1 я прямо требовал «если не удалось определить, давать ask», и `am` там был назван. Эти операции входят в `STATE_OPS`, но проверяется только рабочее дерево до выполнения.
3. **go, а затем правка в той же команде.** После go на `--worktree`-хеш команда `sed -i s/1/2/ tools/x.json && git add -A && git commit -m x && git push origin main` молчит. Так в main уходит содержимое, которое ФЕНИКС не проверял.
4. **Составная команда внутри `bash -c`.** `bash -c 'git merge numbers && git push origin main'` и `sh -c "git merge numbers; git push origin HEAD:main"` молчат. Причина: `re.split` по `&&` идёт до shlex, у ref остаётся хвост кавычки, и `is_main_ref` не срабатывает. Одиночная `bash -c 'git push origin numbers:main'` даёт ask. В e3322004 было так же.
5. **Имя текущей ветки в refspec после коммита.** `git add -A && git commit -m x && git push origin work:main` на ветке work молчит. Вариант с `HEAD:main` даёт ask.

**Ложное срабатывание, новое в этой итерации:** `git merge --no-ff -m 'Merge docs' docs` на main даёт ask, хотя в ветке docs нет цифр. `git merge --no-ff -m 'Merge: data-guard' numbers` даёт ask даже при действующем go. Причина: текст сообщения попадает в позиционные аргументы и принимается за ref, merge-base не находится, срабатывает `touches_numbers=True`. Получается, go не работает для обычной формы локального слияния с сообщением, а в headless это отказ. Тот же механизм у `git cherry-pick -m 1 <sha>` (ref «1») и `gh pr merge -t 'title' 51` (ask «не удалось получить содержимое ветка title»). В e3322004 эти команды молчали.

## Что закрыто
- **R1 буквально:** 4 команды из таблицы итерации 3, плюс `rebase`, `pull <ветка>` и `git merge <ветка>` на main, который оценивается по ветке.
- **R2:** правило охвата `audited_hash` в Phase 5 п.4, в обеих копиях.
- **R3:** все формы.
- **R4 и R7:** строки в SKILL.
- **R5:** timeout 90/30, fetch 30 с.
- **R6:** вместе с тестом.

## Gaps
**MAJOR**
- **G1 (A4).** Смена ветки внутри команды. В `merge_targets` нужно отслеживать `checkout/switch <ветка>` (без `--`), обновлять текущую ветку и оценивать push уже после смены: по этой ветке или prospective, если после смены было слияние. Нужны тесты на 3 команды из пункта 1.
- **G2 (A4).** Нужен ask, если перед push в main в той же команде есть:
  - `am`, `apply`, `reset <ref>`, `checkout <ref> -- ...`, `restore --source`, `stash pop/apply`;
  - любой не-git сегмент, который может писать файлы: перенаправление `>`, `sed -i`, `cp`, `mv`, `python`, `node` и т.п. Проще всего белым списком: `cd`, `git status/log/diff/fetch/add/commit`, merge с разрешимым ref.

  Это же закрывает пункт 3 (правка после go).

**MINOR**
- **G3 (FP).** Убрать значения опций из позиционных аргументов: `-m`, `-F`, `--message`, `-X`, `-s`, `--strategy` у merge, commit и cherry-pick; `-m <n>` у cherry-pick; `-t`, `-b`, `--subject`, `--body`, `-F` у gh pr merge. Нужен тест: `git merge --no-ff -m 'x' docs` молчит, а при go на numbers `git merge -m 'x' numbers` тоже молчит.
- **G4.** Разбивать команду на сегменты с учётом кавычек (`shlex.shlex(..., punctuation_chars=True)`), чтобы `bash -c '... && ...'` разбирался.
- **G5.** В `git push origin <текущая ветка>:main` после коммита в той же команде оценивать то же, что для HEAD.
- **G6 (Accuracy).** В SKILL.md написано «Составная команда оценивается по тому, что окажется в main после неё». Сейчас это неверно для G1 и G2. Нужно либо исправить код, либо сузить формулировку и добавить эти формы в остаточные риски.

## rework_tz
1. G1 и G2 с тестами на каждую команду из списка A4 выше. Обязательно.
2. G3 с тестом на go-путь. Обязательно, иначе go не работает на обычной форме слияния.
3. G4-G6 желательно.

## Self-check (5 критериев)
- **Accuracy 8.0.** Хеш, тесты и поведение по R1-R7 воспроизводятся. Минус за строку SKILL про составные команды (G6).
- **Actionability 8.0.** Основной путь в main закрыт: коммит на main и push (157 коммитов в сентябре). Открыт путь «checkout main && merge && push», а go не работает на `merge -m`.
- **Insight 8.0.** Хорошие решения: prospective-оценка и учёт сливаемых refs. Упущены два эффекта второго порядка: смена ветки внутри команды и содержимое, которое нельзя определить заранее.
- **Brand fit 8.5.** Трейлеры на месте, em dash нет.
- **Risk 7.0.** Молча пропускаются канонический путь слияния с ветки и правка после go. Плюс новое FP, которое в headless превращается в отказ.

Расчёт: 8.0×0.25 + 8.0×0.25 + 8.0×0.2 + 8.5×0.15 + 7.0×0.15 = 7.925, округляю до 7.9. JSON отчёта прошёл `schemas/validate.py`: «VALID по схеме audit-report». Поле iteration опущено, потому что схема допускает максимум 3. Файл: `/tmp/claude-0/-home-user-turbium/73fa2544-6bbc-5692-96c4-41c825f82fc5/scratchpad/feniks-i4/report.json`.

## Что я изменил
- В `/home/user/t1/traces/2026-09-29/agents.jsonl` дописал одну строку `event: audit`: task_id `feniks-data-guard-iter4-20260929`, verdict return, feniks_score 7.9, audited_hash `2a3684c879c9683b`. Охват указан в note: итерации 1-4 вместе покрыли все пути ветки, а дельту 0c7ad605 я проверил целиком. `git status` показывает только этот файл, хеш после записи не изменился.
- В t1 выполнил `git fetch -q origin`. Сдвинулись только remote-tracking refs.
- Все пробы шли в `/tmp/claude-0/-home-user-turbium/73fa2544-6bbc-5692-96c4-41c825f82fc5/scratchpad/feniks-i4/`: `probe.py`, плюс `probe_i2.py` и `probe_i3.py` для сравнения с прошлыми версиями хука.

## Ключевые пути
- `/home/user/t1/.claude/hooks/data-guard.py`: `merge_targets` на строках 269-324 (push 298-312, STATE_OPS 256-258, позиционные аргументы 297 и 318-322), `segments` 209-239, `merge_gate` 384-422
- `/home/user/t1/.claude/skills/data-guard/SKILL.md`: строка про составные команды (G6)
- `/home/user/t1/.claude/hooks/tests/data-guard-tests.py`: сюда нужны тесты G1-G3

AUDITED: 2a3684c879c9683b
VERDICT: return
