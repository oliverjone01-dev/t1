# ФЕНИКС: data-guard, итерация 6 (29.09.2026)

**Оценка 7.8 из 10, вердикт RETURN.** По правилу 9 (feniks.md:150) проба A4 дала FAIL. Все пять пунктов rework_tz итерации 5 (R1-R5) закрыты, каждый обход из прошлого отчёта теперь даёт ask.

Проблема в другом. Самая частая бытовая форма, `git push 2>&1 | tail`, на main проходит молча и реально доставляет цифры в origin main. Это не обфускация, поэтому по заявленной модели угроз (небрежный агент) остаточным риском это считать нельзя. Причина в регрессии коммита 5abad9aa: хук итерации 4 (0c7ad605) на этой команде давал ask. В итерации 5 я эту регрессию пропустил.

## Сверка
- **Хеш.** Пересчитал сам: `c94ac6b9b489db97`, совпадает с переданным. `git fetch` выполнен: origin/main на 60ec3c23, merge-base 46e87314, `git merge-tree` без конфликтов.
- **Тесты.** data-guard-tests 117 из 117, run-hook-tests 119 из 119.
- **Коммит.** В добавленных строках нет em dash. Трейлеры Rework, Co-Authored-By и Claude-Session на месте.

## Пробы
Фикстура: `/tmp/claude-0/-home-user-turbium/73fa2544-6bbc-5692-96c4-41c825f82fc5/scratchpad/feniks-i6/`. В ней свежий bare origin из 78715649. PR 50 = `numbers` (есть цифры), PR 51 и PR 2 = `docs` (цифр нет). На хеш `goodbr` записан go.

| ID | Результат | Доказательство |
|---|---|---|
| A1 | PARTIAL (принято) | Ручная строка go со свежим ts проходит, это остаточный риск из SKILL. go из будущего игнорируется, более поздний return перекрывает go |
| A1b | PASS | DG_OVERRIDE в env, в `-b`, в `-o` у push и в commit_message MCP: во всех случаях ask |
| A4 | **FAIL** | Все обходы итерации 5 дают ask: for/until/while !/if, `git show X > путь`, fetch с refspec, `@:main`, `HEAD~0:main`, `HEAD^{}:main`, `>\|`, `&>`. Новые обходы перечислены ниже |
| A5 | PASS | Молчат `pull && push`, `pull --ff-only && push`, `merge origin/main` (в том числе с `-m`), `fetch && merge origin/main && push`, push рабочей ветки, `merge -m docs`, `gh pr merge 51 -t -b`. Путь go работает: `merge goodbr`, затем отдельный push, молчит. add/commit/push при go на `--worktree` молчит, в том числе с heredoc в сообщении. Ложные запросы (FP) описаны в B2 |
| A7 | PASS | go возрастом 80 ч даёт ask |
| fail-closed | PARTIAL | При битом конфиге `push origin main`, `gh pr merge 50` и MCP дают ask. Голый `git push` на main и цикл с `git push` молчат |

### B1 (MAJOR, регрессия 5abad9aa): перенаправление у push
С переходом на `shlex(punctuation_chars=True)` строка `2>&1` режется на токены `2`, `>&`, `1`. В сегменте push эти токены попадают в `positional`: remote становится `2`, refspec становится `1`, и цель «push в main» не создаётся (`merge_targets`, data-guard.py:375-387). Условие `writes and sub != "push"` тоже пропускает push.

На main с локальным коммитом `tools/local.json` молча проходят:
- `git push 2>&1 | tail -5`
- `git push > /dev/null 2>&1`
- `git push -q 2>/dev/null`
- `git push origin 2>&1 | tail -3`
- `git add -A && git commit -m 'upd' && git push 2>&1 | tail -3`, хотя та же команда без `2>&1` даёт ask

Сквозная проверка: `git push 2>&1 | tail -2` молча отправил `78715649..ca10ab4d main -> main` с `tools/local.json` в origin фикстуры.

Для сравнения: iter2 и iter4 на `git push 2>&1 | tail -5` дают ask, iter5 и iter6 молчат. Хуже всего, что именно эту форму агент наберёт по совету самого хука «раздели команду, потом отдельный push».

Как часто агенты дописывают `2>&1 | tail`, я не измерял: в репо примеров нет, транскрипты забиты моими же пробами [ГИПОТЕЗА: частая идиома агентов].

**Тот же корень в gh:** на рабочей ветке `gh pr merge --squash 2>&1 | tail -3` молчит. Хук принял `2` за номер PR и проверил PR #2 (docs) вместо текущей ветки с цифрами.

### B2 (A5, тот же корень, обратная сторона)
`2>&1` и `2>/dev/null` у pull, log и commit считаются записью в файл. На чистом main команды `git pull --rebase origin main 2>&1 | tail -3 && git push origin main` и `git log 2>&1 && git push` дают ask с текстом «изменения с цифрами», хотя цифр там нет. Для этого пути ветка unknown_ops вообще не проверяет, затронуты ли цифры.

### B3 (minor)
- **Fail-closed.** Запасной regex (data-guard.py:~607) требует слово `main` в тексте команды. Поэтому при битом конфиге голый `git push` на main проходит.
- **Другой каталог.** `cd <другой checkout или worktree на main> && git push` и `git -C <путь> push` без refspec оцениваются по ветке ROOT и молчат. Worktree в этом окружении реально используются (`git worktree list` в t1).
- **case.** `case ... esac` с push внутри молчит.
- **`$(...)` в кавычках.** `"$(git branch --show-current)"` молчит. В SKILL это записано остаточным риском, принимаю.

### Точность
SKILL, шаг 7 (строка 102) обещает, что хук «всегда спрашивает подтверждение». Для B1 это неверно, и в тестах нет ни одного случая с `2>&1`.

## rework_tz
1. **R1 (обязательно).** Снимать перенаправления вместе с целью (`N>&M`, `N>файл`, `>файл`, `&>файл`, `<файл`) до вызова `positional` у всех сегментов, включая push и gh. Записью в файл считать только перенаправление в реальный файл: не в `/dev/null` и не дублирование дескриптора.
2. **R2 (обязательно).** Тесты: `git push 2>&1 | tail`, `git push > /dev/null 2>&1`, `add/commit/push 2>&1`, `gh pr merge --squash 2>&1`. Плюс тест на отсутствие FP: `pull origin main 2>&1 && push` на чистом main.
3. **R3.** В запасной ветке fail-closed на main любой `git push` должен давать ask.
4. **R4 (желательно).** `cd` или `git -C` в путь вне ROOT перед push считать unknown_ops.
5. **R5.** Привести SKILL шаг 7 в соответствие с поведением после R1.

## Оценка
- **Accuracy 7.5.** Обещание «всегда спрашивает» опровергнуто, текст ask неточен.
- **Actionability 8.0.** Путь go работает, но есть FP на `2>&1`.
- **Insight 8.0.** R1-R5 закрыты по существу, но смена токенизатора сломала распознавание push, и тест это не поймал.
- **Brand fit 8.5.**
- **Risk 7.0.** Самая бытовая форма push обходит гейт.

Расчёт: 7.5×0.25 + 8.0×0.25 + 8.0×0.2 + 8.5×0.15 + 7.0×0.15 = 7.8. JSON отчёта прошёл проверку: «VALID по схеме audit-report». Файл: `/tmp/claude-0/-home-user-turbium/73fa2544-6bbc-5692-96c4-41c825f82fc5/scratchpad/feniks-i6/report.json`.

## Что я изменил
- В `/home/user/t1/traces/2026-09-29/agents.jsonl` дописал одну строку `event: audit`: task_id `feniks-data-guard-iter6-20260929`, verdict return, feniks_score 7.8, audited_hash `c94ac6b9b489db97`. Проверка agent-trace: 96 из 96 строк валидны.
- `git status` в t1 показывает только этот файл, хеш после записи не изменился.
- В t1 выполнил `git fetch -q origin`, сдвинулись только remote-tracking refs.
- Все пробы и push шли только в фикстуру `/tmp/claude-0/-home-user-turbium/73fa2544-6bbc-5692-96c4-41c825f82fc5/scratchpad/feniks-i6/`. Там же `probe.py` и копии хука прошлых итераций (`dg-iter2.py`, `dg-iter4.py`, `dg-iter5.py`) для сравнения.
- Отчёт в `knowledge/episodes/` не писал: по заданию меняю только строку трейса. Копию может закоммитить автор.

## Ключевые пути
- `/home/user/t1/.claude/hooks/data-guard.py`:
  - `_split_ops` 213-232;
  - `positional` 308-318;
  - `merge_targets` 335-406 (строка `writes`, условие `sub != "push"`, разбор refspec push);
  - fail-closed ~600-612.
- `/home/user/t1/.claude/hooks/tests/data-guard-tests.py`: нет тестов с `2>&1`.
- `/home/user/t1/.claude/skills/data-guard/SKILL.md:102`.

AUDITED: c94ac6b9b489db97
VERDICT: return
