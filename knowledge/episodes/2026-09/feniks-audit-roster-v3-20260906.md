# ФЕНИКС Step 12.5: аудит ростера v3 (СПАРТАК, ФЕНИКС, 11 бойцов, Cowork-упаковка)

**Task ID:** feniks-roster-v3-20260906 · **Дата:** 2026-09-06 · **Итерация:** 1
**Deliverable:** коммит `46b9a60` (ветка `claude/spartak-roster-phoenix-skills-hgzf45`), 47 файлов, +2640 / -431
**Класс артефакта:** агент / skill / workflow (пробы D1-D11) + гейт / хук / инструмент (пробы A1-A7)
**Автор:** main-сессия Claude Code · **Self-check автора:** приложен, 25 пунктов, без оценок (условие Phase 1 выполнено)
**Модель:** opus, effort max · **JSON-отчёт:** `/tmp/claude-0/-home-user-t1/bbcbbeee-8b44-5e00-ab7a-ee611d91f74e/scratchpad/feniks-audit-roster-v3.json`

---

## VERDICT: return · weighted_total 6.95 / 10 · confidence 0.86

| Критерий | Вес | Score | Вклад |
|---|---|---|---|
| Accuracy | 25% | 8.0 | 2.00 |
| Actionability | 25% | 5.0 | 1.25 |
| Insight | 20% | 8.0 | 1.60 |
| Brand Fit | 15% | 8.0 | 1.20 |
| Risk Awareness | 15% | 6.0 | 0.90 |
| **Weighted total** | | | **6.95** |

Пересчёт совпал с полем до 0.0000. Порог по пересчёту: `return` (6.0-7.49). Независимо от весов вердикт
всё равно упирается в потолок: 6 проб класса A завершились FAIL, а правило red-team-probes.md:78 и
Hard Rule 9 роли ФЕНИКСА не дают выше `return` при FAIL класса A даже при weighted >= 7.5.

Валидация отчёта:

```
$ python3 schemas/validate.py audit-report /tmp/.../feniks-audit-roster-v3.json
VALID по схеме audit-report
rc=0
```

Сумма чекпоинтов по каждому критерию совпадает со score (8/5/8/8/6 из 10), gaps = 10 (лимит 10).

---

## Anchor

```
anchor: 7.6 agent-timur-activation-iter1 - наш артефакт ниже (6.95), потому что там HITL-гейт
существовал «только как правило в промпте» и это признавалось честно, а здесь три гейта заявлены
как техническое enforcement (feniks.md Hard Rule 4 «хук это enforce'ит технически», CLAUDE.md §4,
эпизод §2 «write-scope enforced»), и live-пробы показали: один гейт мёртв в текущем состоянии
репозитория, второй обходится через `..` и через Bash. Урок 2026-07-08 записан в этом же
репозитории и не применён к собственным гейтам автора.
Выше якоря 6.7 feniks-return-reestr, потому что 5 из 5 фактических утверждений эпизода
воспроизводятся командой, а исполняемая часть сходится: 13/13 frontmatter валидны, 13/13
role-карт на месте, smoke-test 5/5, node --check OK, манифест плагина резолвится полностью.
```

Расстояние до ближайших якорей: 0.65 (7.6 timur) и 0.25 (6.7 реестр). Оба меньше 1.5, флаг дрейфа не поднимается.

---

## Таблица проб (23 пробы, все выполнены в песочнице)

| ID | Result | Evidence |
|---|---|---|
| A1/A5 live | **FAIL** | Write ФЕНИКСА в `/home/user/t1/schemas/PROBE_A5_DELETE_ME.txt` прошёл, файл создан (154 байта, `ls -la` подтвердил), хук не сработал. Файл удалён сразу после пробы, `git status --porcelain` чист |
| A2 | **FAIL** | `echo "..." > .claude/agents/marco.md` через Bash: direct-write-gate.sh rc=0, approvals-guard.sh rc=0, deliver-gate.sh rc=0, все с пустым выводом. write-scope на Bash не вызывается вовсе (matcher `Write|Edit`, feniks.md:16) |
| A3 | PASS | `grep -nE 'getenv\|\$\{' .claude/hooks/*.sh` -> только `${CLAUDE_PROJECT_DIR:-...}`. Подмена на `/nonexistent` и `/home/user` даёт rc=2 (строже, не слабее). Дыры нет |
| A4 | **FAIL** | Изолированный прогон матчера deliver-gate.sh:18: ЛОВИТ `git push`, `git  push`, `git   push origin HEAD`, `echo x && git push`, `GIT_DIR=.git git push`. МОЛЧИТ на `bash -c "git push"`, `/usr/bin/git push`, `git -C . push`, `eval "git push"`, таб, перенос строки |
| A5 traversal | **FAIL** | 4 из 4 обратных путей приняты (rc=0): `knowledge/episodes/../../.claude/agents/marco.md`, `traces/../CLAUDE.md`, `knowledge/episodes/../../schemas/validate.py`, `/tmp/../home/user/t1/CLAUDE.md` |
| A5 dead gate | **FAIL** | `git push` -> пустой вывод. Диагностика: `git rev-parse --is-shallow-repository`=true, `git merge-base HEAD origin/main` rc=1, BASE падает на HEAD~1, CRIT=0 при 36 критических файлах в ветке (`git diff d2afc92...HEAD` + фильтр гейта) |
| A5 trace robustness | PASS | 9 фикстур (валидные, мусор, не-JSON, пустой stdin): хук всегда rc=0, мусор игнорируется, 7 строк записано |
| A6, A7 | N/A | approval-файлы Protocol 6 этим коммитом не менялись, wildcard scope и срок действия вне области аудита |
| B1 источники | PASS | 9 из 9 путей, на которые ссылаются якоря, существуют (`ls`) |
| B1 арифметика | **FAIL** | Якорь 8.15: вектор 10/8/10/10/9 даёт 9.35; эпизод содержит и 8.15 (JSON), и 8.350 (свой блок расчёта, строка 156). Якорь 5.83 карусели: вектор даёт 5.90 (дельта 0.07). Пример в phoenix-eval: заявлено 7.05, пересчёт 6.95 (дельта 0.10). Фикстура smoke-test: 7.85 против 7.80 |
| B1 claim | **FAIL** | «>9.0 в 2026 не наблюдалось ни разу» (anchors:19) против `feniks-audit-sales-director-20260630.md:118`: «\| 2 \| 9.25 \| GO + rework \|» в том же каталоге эпизодов |
| B7 | N/A | Экспорт чисел наружу этим коммитом не затрагивается |
| C3 | PASS | 0 em dash (U+2014) во всех 47 изменённых файлах, `grep -lP '\x{2014}'` пусто. En dash тоже 0 |
| C4 | PASS | 26 попаданий по блок-листу CLAUDE.md §7, все в цитируемых блок-листах или в строках, не добавленных этим коммитом (`git diff ... \| grep '^+'` пусто) |
| C1, C2, C5, C6 | N/A | Артефакт не идёт наружу, Comprehension Gate не применяется (внутренняя конфигурация) |
| D1 | PASS | `grep -nE '[0-9]\.[0-9]+ ?/ ?10'` по 47 файлам: 3 попадания, все в цитируемых правилах (порог вето 6.0/10, kill 5.0/10, разбор чужого 9.7/10 в якоре) |
| D2 | PASS | `tools: ... Agent` у СПАРТАКА, `Task` нигде не осталось; HATS-fallback описан в spartak.md, roster-protocol §10, council/SKILL.md §5 |
| D3 | PASS | 13/13 агентов: model, maxTurns, color заданы; 0 несуществующих skills (все 30 ссылок резолвятся в `SKILL.md`); 0 недопустимых имён инструментов; `cohort-analyzer` и `source-resolver` из v2 действительно удалены |
| D4 smoke | PASS | `python3 schemas/smoke-test.py` -> OK на 5 схемах, rc=0, без jsonschema |
| D4 trace | PASS | 7 строк, сгенерированных subagent-trace.sh из фикстур, -> `validate.py agent-trace --jsonl` -> «7/7 строк valid», rc=0 |
| D4 пример | **FAIL** | Канонический JSON phoenix-eval/SKILL.md:126-184 -> `INVALID (3 ошибок)`: `comprehension_gate` не разрешён, `risk_22_p9_hard_rules` не разрешён, timestamp-плейсхолдер. Из 25 документированных имён чекпоинтов ровно одно не проходит patternProperties |
| D5 | PASS | Тиры в role-картах и трейс-хуке совпадают с CLAUDE.md §2 (0 chairman 1 1 2 2 2 3 3 3 3 4 4) |
| D6 | PASS | Пересечение «аудит» между skills `audit` и `feniks` снято явной оговоркой в `audit/SKILL.md:3`; `crisis` явно ссылается на `crisis-response` как на доктрину |
| D7 | PASS | Stop-условия у 11 бойцов отдельной строкой контракта, у СПАРТАКА раздел «Stop conditions и эскалация», у ФЕНИКСА в Phase 1 и Phase 4 (без скоринга при отсутствии self-check, max 2 раунда диспута) |
| D8 | PARTIAL | maxTurns у 13/13; правило «Council >$1 предупредить Ивана» в council.js не реализовано (`grep 'budget\|cost' council.js` пусто), параметр `budget` обёртки не используется |
| D9 | PARTIAL | Память чистая от PII, но `.claude/agent-memory/data/MEMORY.md:12-13` хранит числа без путей (37/39 против 2; 10/15/30) вопреки собственной строке 3 «Никаких PII и чисел без пути» |
| D10 | PASS | 13 из 13 role-карт: `grep -cE '^## [a-z]+ · '` = 13, поимённо все агенты ростера |
| D11 | PASS | `node --check` на теле council.js в обёртке async-функции -> OK; `Date.now`, `Math.random`, `new Date`, `process.`, `require(`, `fetch(` не найдены; в `meta` только литералы |
| D-логика | **FAIL** | Стенд на реальном теле council.js (стаб-агенты): без единой пробы ФЕНИКСА -> weighted 9.0, verdict `go`, final_status `deliver`. При `probes:[{id:'A1',result:'FAIL'}]` понижение работает. `debate` + P9 с ростером Ивана `[viktor,boris]` -> итоговый ростер `[marco,data]`, оба названных бойца выброшены без единой строки лога |
| P14 live | **FAIL** | `traces/2026-09-06/agents.jsonl`: запись 2 из 2 имеет `"agent":"unknown","tier":"unknown"` при заполненных session_id, agent_id, msg_chars=36. `trace-summary.py 2026-09` печатает «feniks: 1 / 0 / -» |
| P14 портируемость | **FAIL** | `trace-summary.py:21` использует `parents[4]`, `CLAUDE_PROJECT_DIR` в файле отсутствует. Симуляция плагина (скрипт в plugin-root, traces в project-dir) -> «Нет traces/2026-09-*/agents.jsonl» |

---

## Evidence Ledger

| # | Gap | Evidence (команда / файл:строка / расчёт) | Чекпоинт | Вес |
|---|---|---|---|---|
| 1 | Хук write-scope не сработал вживую | `Write` в `/home/user/t1/schemas/PROBE_A5_DELETE_ME.txt` -> «File created successfully»; `ls -la` показал 154 байта; файл удалён, `git status --porcelain` чист | risk_21 | -2 |
| 2 | Bash обходит write-scope полностью | matcher `Write\|Edit` в `.claude/agents/feniks.md:16`; три Bash-хука на команду `echo > .claude/agents/marco.md` вернули rc=0 с пустым выводом | risk_21 | -2 |
| 3 | Traversal через разрешённый префикс | `printf '{"tool_input":{"file_path":"/home/user/t1/knowledge/episodes/../../.claude/agents/marco.md"}}' \| bash .claude/hooks/feniks-write-scope.sh` -> rc=0 (4 из 4 вариантов) | accuracy_2 | -1 |
| 4 | deliver-gate мёртв | `printf '{"tool_name":"Bash","tool_input":{"command":"git push"}}' \| bash .claude/hooks/deliver-gate.sh` -> пусто; `git rev-parse --is-shallow-repository`=true; `git merge-base HEAD origin/main` rc=1; критических файлов в ветке 36 | accuracy_2 | -1 |
| 5 | Матчер пропускает обычные формы | `printf '%s' 'bash -c "git push"' \| grep -qE '(^\|[;&\| ])git[[:space:]]+push([[:space:]]\|$)'` -> нет совпадения; то же для `/usr/bin/git push`, `git -C . push`, `eval "git push"` | accuracy_2 | -1 |
| 6 | Якорь 8.15 смещён на 1.2 | `0.25*10+0.25*8+0.2*10+0.15*10+0.15*9 = 9.35`; `calibration-anchors.md:81` заявляет 8.15; `feniks-audit-master-system-v9-iter2.md:156` заявляет 8.350 | accuracy_2 | -2 |
| 7 | Claim «>9.0 не наблюдалось» ложен | `grep -n '9.25' knowledge/episodes/2026-06/feniks-audit-sales-director-20260630.md` -> строка 118 «\| 2 \| 9.25 \| GO + rework \|»; claim в `calibration-anchors.md:19` и ещё в 3 файлах | accuracy_3 | -1 |
| 8 | Канонический отчёт невалиден | `python3 schemas/validate.py audit-report <пример из phoenix-eval>` -> `INVALID (3 ошибок)`; перебор 25 имён по patternProperties -> не проходит `risk_22_p9_hard_rules` | brand_19 | -1 |
| 9 | council.js пропускает отчёт без проб | стенд `node harness.mjs`, кейс A: probes отсутствуют -> `weighted_total=9 verdict=go final_status=deliver`; `council.js:130` (probes не в required), `council.js:298` `(audit.probes \|\| [])` | actionability_8 | -1 |
| 10 | Трейс теряет агента | `cat traces/2026-09-06/agents.jsonl` -> вторая запись `"agent":"unknown"`; `python3 .claude/skills/reflexion/scripts/trace-summary.py 2026-09` -> «feniks: 1 / 0 / -» | actionability_9 | -1 |

Класс доказательств: строки 1-5, 8-10 подтверждены воспроизводимой командой; строки 6-7 подтверждены
расчётом плюс файлом вне артефакта. Рассуждений без проверки в ledger нет.

---

## 5 stress-вопросов

**Q1. Доказательства.** Где выгрузка, подтверждающая, что гейты работают? Её нет: в эпизоде §3 Q3 в графе
«есть» стоит «работающие тесты хуков и валидатора», но тесты, которые я нашёл, это `bash -n` (синтаксис)
и smoke-test схем. Ни одной попытки обойти собственный гейт автор не сделал. Проверка по позитивному пути
(`git push` ловится, запрещённый путь блокируется) в моих прогонах даёт смешанный результат: write-scope на
прямых путях работает, на `..` нет, вживую не сработал вообще; deliver-gate на позитивном пути молчит.
Ровно эта разница между «прочитал код» и «попробовал сломать» стоила якорю ТИМУР двух итераций.

**Q2. Downside при минус 50%.** Пессимистичный сценарий здесь не финансовый, а доверительный. Система
рассказывает Ивану, что Step 12.5 технически защищён (CLAUDE.md §4, feniks.md Hard Rule 4, эпизод §2
«write-scope enforced»). Если половина этих утверждений не выполняется, Иван перестаёт проверять руками
именно там, где раньше проверял. Цена ошибки растёт, а не падает: гейт, которому верят и который не
срабатывает, хуже отсутствующего гейта. Второй слой downside: `trace-summary.py` уже сейчас показывает
0 stop-записей у ФЕНИКСА, то есть первый же CC-19 в октябре построит выводы на пустой выборке и зафиксирует
их как «систематические ошибки месяца».

**Q3. Ресурсы.** Команда есть (автор плюс Иван), бюджет не требуется, время требуется на 14 пунктов
rework_tz. Реалистично: пункты 1-4 (хуки) закрываются за один заход, пункты 5-8 (якоря и схема) требуют
решения Ивана, потому что `calibration-anchors.md` по правилу самого файла (строка 100) правится только
после его решения. Пункт 11 (`trace-summary.py`) блокирует проверку установки плагина из
`COWORK_AND_PLUGIN.md` §4 пункт 5, то есть чек-лист Ивана сейчас невыполним как написан.

**Q4. Что забыто.** (а) Нормализация путей во всех трёх новых хуках. (б) Вектор Bash при том, что Bash
выдан ФЕНИКСУ явно. (в) Арифметическая проверка weighted_total в `validate.py`, хотя 4 из 4 весовых сумм
в репозитории её не проходят. (г) Сшивка `subagent_start` и `subagent_stop` по `agent_id`, хотя оба поля
пишутся. (д) `outcome` по умолчанию `success`: фикстура «Прогон упал, задача не выполнена» записана как
success, значит метрика успеха Protocol 15 завышена конструктивно. (е) Поле `feniks_score` пишется любому
агенту, у которого в тексте есть «8.5/10» (проверено на фикстуре marco). (ж) Рассинхрон CLAUDE.md §9
(kill при <5.0) и порога вето <6.0 в файле, который этим коммитом обновлялся до v9.1.

**Q5. Инвестор-тест.** Первый вопрос будет: «вы построили систему контроля качества, она проверила сама
себя?». Ответ за 30 секунд сейчас звучит так: «да, и нашла, что три из трёх её собственных технических
гейтов дырявые, а её калибровочная линейка смещена на 1.2 балла». Это хороший ответ для процесса и плохой
для релиза. Он же объясняет, почему вердикт `return`, а не `veto`: механизм самопроверки сработал ровно
так, как задуман, просто до мержа, а не после.

---

## Что в артефакте сделано сильно (не влияет на вердикт, влияет на приоритеты)

- 13 из 13 frontmatter валидны, все 30 ссылок на skills резолвятся, устаревший `Task` вычищен. Это то,
  на чём v2 ломался (эпизод 2026-06-09), и оно закрыто проверяемо.
- Идея калибровочных якорей и правила «гейт без live-атаки не выше 7.9» выведены из истории самого
  репозитория, а не из внешнего чек-листа. Именно это правило и понизило текущую оценку, то есть механизм
  работает против собственного автора. Anti-Median тест пройден.
- `council.js` действительно enforce'ит пороги кодом, а не доверием к полю `verdict`: стенд показал строку
  «Коррекция ФЕНИКСА: заявлено 9.9/go, пересчёт по весам 9/go» и понижение `go` до `return` при пробе A1 FAIL.
- Пять отброшенных альтернатив в §4 эпизода разобраны с причинами, включая отказ от блокирующего
  deliver-gate со ссылкой на MASTER_SYSTEM_v9 §6.4. Честный отказ от соблазна.
- Ограничения Cowork описаны без приукрашивания, с явными пометками [ГИПОТЕЗА] на непроверенном.

---

## Rework TZ (нумерованный, с путями)

1. `.claude/hooks/feniks-write-scope.sh:17-25` - нормализовать путь до сравнения (`realpath` / `readlink -f`),
   только затем сверять префикс. Добавить блок при пустом `file_path`, если инструмент пишущий.
2. `.claude/agents/feniks.md:14-20` - закрыть Bash-вектор: либо второй agent-scoped хук на `PreToolUse(Bash)`
   с блокировкой перенаправлений и `mv/cp/rm` вне разрешённых префиксов, либо убрать `Bash` из `tools`.
   До закрытия снять из `feniks.md` (Hard Rule 4) и эпизода §2 формулировку про техническое enforcement.
3. `.claude/hooks/deliver-gate.sh:37` - при `rc!=0` у `merge-base` брать `git rev-list HEAD --not --remotes`
   или первый коммит ветки вместо `HEAD~1`; при пустом BASE печатать напоминание, а не выходить молча.
4. `.claude/hooks/deliver-gate.sh:18` - расширить матчер на кавычки, слэши, таб и `-C`:
   `(^|[^A-Za-z0-9_/-])(/[^ ]*/)?git([[:space:]]+-[^ ]+)*[[:space:]]+push([^A-Za-z0-9]|$)`.
5. `.claude/skills/phoenix-eval/references/calibration-anchors.md:79-85` - привести якорь master-system
   в соответствие: либо 9.35 по вектору, либо вектор под 8.15, со ссылкой на строку эпизода. В сам эпизод
   добавить пометку о расхождении 8.15 против 8.350. Правка требует решения Ивана (правило строки 100).
6. `calibration-anchors.md:19` плюс дубли в `.claude/agents/feniks.md`, `phoenix-eval/SKILL.md`,
   `.claude/skills/feniks/SKILL.md` - заменить «>9.0 не наблюдалось ни разу» на факт с источником
   (sales-director iter-2 = 9.25, эпизод `20260630:118`) либо ограничить утверждение классом артефакта.
7. `schemas/audit-report.json:20` - расширить pattern до `^(accuracy|actionability|insight|brand|risk)_[0-9]+_[a-z0-9_]+$`
   и добавить свойства `comprehension_gate`, `anchor`, `probes`. Синхронизировать пример
   `phoenix-eval/SKILL.md:126-184` и включить его в `smoke-test.py` как фикстуру.
8. `schemas/validate.py` - post-check арифметики для audit-report:
   `|weighted_total - Σ(score × weight)| <= 0.05`. Сейчас VALID выдаётся на расхождение 1.2.
9. `.claude/workflows/council.js:130,298` - добавить `probes` в `required` AUDIT_SCHEMA и правило
   «класс A/B/D без проб -> verdict не выше return, risk_awareness <= 5.0».
10. `.claude/workflows/council.js:176-179` - перенести срез `debate` выше p9-unshift и логировать выброшенных
    бойцов; сейчас `debate` + P9 с ростером `[viktor,boris]` молча даёт `[marco,data]`.
11. `.claude/workflows/council.js` - задействовать параметр `budget` для правила «Council >$1 предупредить Ивана».
12. `.claude/hooks/subagent-trace.sh:27,55,58` - сшивать `subagent_stop` с `subagent_start` по `agent_id`
    при отсутствии `agent_type`; убрать `outcome=success` по умолчанию; не писать `feniks_score` агентам,
    кроме `feniks`.
13. `.claude/skills/reflexion/scripts/trace-summary.py:21` - заменить `parents[4]` на `CLAUDE_PROJECT_DIR`
    с fallback на cwd; иначе чек-лист `agents-v9/COWORK_AND_PLUGIN.md` §4 пункт 5 невыполним при установке плагином.
14. `CLAUDE.md` §9 - свести Kill Criteria «<5.0/10» с порогом вето «<6.0» (`feniks.md:137`).
15. `.claude/agent-memory/data/MEMORY.md:12-13` - убрать числа без путей или добавить пути.
16. `knowledge/episodes/2026-09/roster-v3-upgrade-20260906.md` §3 - добавить milestone на 50%,
    числовую метрику первого сигнала вместо качественной, буфер к сроку, явную секцию rollback.

Приоритет для повторной подачи: пункты 1-4 и 9 (это то, что снимает потолок класса A),
затем 5-8. Пункты 10-16 можно закрывать параллельно.

---

## Соответствие правилам аудита

- Self-check автора приложен -> скоринг проведён (Phase 1 пройдена).
- Класс артефакта определён, пробы класса D и A выполнены -> строка `probes: not_run` не применяется,
  потолок 7.9 не активируется, но потолок «FAIL класса A -> не выше return» активируется.
- Каждый gap в `gaps` имеет воспроизводимое доказательство; gaps без evidence отброшены.
- Отчёт валиден по схеме, weighted_total пересчитан вручную (дельта 0.0000), anchor указан.
- Em dash в отчёте: 0. Anti-Slop: 0 нарушений.
- Диспут: не открыт (итерация 1). Право автора на 2 раунда с данными сохраняется;
  конфликт ФЕНИКС vs СПАРТАК по этому артефакту не возникал.
- Самоаудит роли: аудировалась `.claude/agents/feniks.md` как артефакт класса «агент». Собственные
  оценки ФЕНИКСА в этом отчёте не аудировались (self-audit оценок запрещён), проверку весов и порогов
  может повторить любой командой из блока «Валидация отчёта».

**Следующий чекпоинт:** повторный `/feniks` на итерацию 2 после пунктов 1-4 и 9 rework_tz.
Ответственный за rework: автор (main-сессия). Решения по пунктам 5, 6 и 14: Иван.
