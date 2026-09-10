# Ростер v3: апгрейд СПАРТАКА, бойцов и ФЕНИКСА до multi-agent уровня (design record)

**Дата:** 2026-09-06 · **Инициатор:** Иван (запрос: «доработать навыки до уровня высшего прогресса мультиагентных систем, для Cowork и апгрейда скиллов Claude Code») · **Исполнитель:** Claude Code (ветка `claude/spartak-roster-phoenix-skills-hgzf45`) · **Гейт:** Step 12.5 ФЕНИКС до PR

## 1. Что было (аудит ростера v2.0, факты)

- [ДАННЫЕ: `.claude/agents/spartak.md` v2.0, строка `tools: Read, Grep, Glob, Bash, Write, Task`] инструмент `Task` переименован платформой в `Agent`; СПАРТАК как subagent не мог делегировать. Подтверждение: эпизод `knowledge/episodes/2026-06/council-dashboard-audit-20260609.md`, «Task-tool недоступен внутри текущего контура … Council проведён в режиме носимых шляп».
- [ДАННЫЕ: `CLAUDE.md` §3, MASTER_SYSTEM_v9 §3.7-3.8] Protocol 14 (traces) и 15 (reflexion) описаны как «Sprint 4 / планируется»; `knowledge/reflexion/` физически отсутствовал; в `traces/` только direct-writes и три ручных json ФЕНИКСА.
- [ДАННЫЕ: `.claude/skills/phoenix-eval/SKILL.md` v2] ни одного калибровочного якоря; при этом в эпизодах 2026 года 11 реальных оценок от 3.7 до 8.9. Итерация 1 стабильно 5-6, итерация 2 стабильно 7.6-8.5 - системный сигнал, нигде не зафиксированный.
- [ДАННЫЕ: `knowledge/episodes/2026-07/agent-timur-activation-20260708.md`] три дыры в гейте найдены только live-атакой ФЕНИКСА (ATTACK A/B), но «пробы» как обязательный шаг в роли ФЕНИКСА отсутствовали.
- [ДАННЫЕ: docs Claude Code, снимок 2026-09-06 через claude-code-guide] Cowork не загружает `.claude/agents` и проектные хуки; skills и plugins - только из аккаунта. Значит ростер v2 в Cowork не существовал вообще.
- [ДАННЫЕ: `.claude/agents/data.md` v2] в списке skills - `cohort-analyzer`, `source-resolver`, которых нет в `.claude/skills/`.
- [ДАННЫЕ: `schemas/smoke-test.py` v1] требовал `pip install jsonschema`, которого нет в контейнере → smoke-test не запускался.

## 2. Что сделано

| Блок | Файлы | Механика |
|---|---|---|
| Общий протокол | `.claude/skills/roster-protocol/SKILL.md` (preload во все 13) | RECEIVE → GROUND → WORK → VERIFY → RETURN; структура ответа; evidence; stop conditions; handoff; трейсы; деградированные режимы |
| СПАРТАК v3.0 | `.claude/agents/spartak.md` | `tools: … Agent`; 6 режимов; fan-out одним сообщением; self-check перед ФЕНИКСОМ; пересчёт порогов; `memory: project`; `maxTurns: 80` |
| ФЕНИКС v3.0 | `.claude/agents/feniks.md`, `phoenix-eval/SKILL.md`, `references/calibration-anchors.md`, `references/red-team-probes.md`, хуки `feniks-write-scope.sh` + `feniks-bash-scope.sh` | классификация артефакта; пробы A/B/C/D; якоря 3.7…8.9 (черновик до решения Ивана); evidence ledger; `validate.py` с арифметикой весов; гейт записи в два эшелона (Write/Edit с realpath + Bash-эвристика), project-level по agent_type и agent-scoped; скрипт-посредник эшелоны не видят - это записано как остаточный риск |
| 11 бойцов v3.0 | `.claude/agents/{marco,data,viktor,boris,emma,maks,semyon,timur,krea,roman,trener}.md` | `Operating Contract v3` (lens, intents, выход, evidence, stop, handoff, Council, бюджет, память); frontmatter `skills / maxTurns / color`, у data `memory: project` |
| Cowork | `.claude/skills/council/references/roster-cards.md`, `.claude-plugin/plugin.json`, `marketplace.json`, `agents-v9/COWORK_AND_PLUGIN.md` | role-карты 13 ролей; плагин с agents / skills / workflows / hooks; честные ограничения |
| Skills вместо commands | `.claude/skills/{council,feniks,reality-audit,crisis,reflexion}/SKILL.md`; `.claude/commands/` удалён | каждая - native / workflow / cowork / hats пути |
| Protocol 14 | `.claude/hooks/subagent-trace.sh`, `schemas/agent-trace.json`, `settings.json`, `reflexion/scripts/trace-summary.py` | автоматические трейсы start/stop без содержимого сообщений (репозиторий публичный) |
| Protocol 15 | skill `/reflexion`, `knowledge/reflexion/README.md` | CC-19 по трейсам + эпизодам + памяти |
| Схемы | `schemas/validate.py` (fallback без jsonschema), `smoke-test.py` на 5 схем | executable enforcement P13 / Step 12.5 |
| Workflow | `.claude/workflows/council.js` | детерминированный Council, пороги enforced кодом; только по opt-in |
| Гейт push | `.claude/hooks/deliver-gate.sh` | напоминание о Step 12.5 при push критических артефактов без свежего аудита (не блок) |
| Память | `.claude/agent-memory/{feniks,spartak,data}/MEMORY.md` | seed: калибровка, карта источников, статистика Council |
| Конституция | `CLAUDE.md` v9.1 (§2, §3, §4, §14, новый §16), `agents-v9/README.md` | синхронизация |

## 3. Reality Audit решений (Protocol 9, самопроверка перед ФЕНИКСОМ)

- **Q1 ЦА:** Иван (CMO, 60 лет, не веб-специалист) запускает `/council`, `/feniks` в Claude Code и Cowork; Дмитрий Янчоглов ставит плагин; агенты читают протокол при каждом вызове.
- **Q2 Допущения:** А) вложенная делегация в Claude Code работает (docs 2026-09-06: да; эпизод 2026-06-09: нет, старая версия) - закрыто HATS-fallback; Б) Cowork грузит плагинные skills - [ДАННЫЕ: docs]; В) плагинные хуки в Cowork - [ГИПОТЕЗА], считаем, что их нет.
- **Q3 Данные есть / нет:** есть - docs, эпизоды, трейсы, работающие тесты хуков и валидатора; нет - живая установка плагина, живой Cowork-прогон, стоимость Council v3 в долларах.
- **Q4, второй порядок собственных изменений (по итерации 2):** (а) налог ложных срабатываний гейта - в итерации 2 ФЕНИКС получил 4 ложных блока (`git merge-base`, `grep 'git add'`, текст `>0.05`, идентификатор `stubs.args`) и ушёл в скрипты в /tmp, которых гейт не видит; мера - read-only allow-list и цели только в кавычках, измерение: `grep -c '"outcome": "blocked"' traces/<дата>/agents.jsonl` против числа реальных попыток записи в отчёте ФЕНИКСА; (б) объём gate-событий - 74 из 80 строк трейса за день были `allow`; мера - логировать только блоки (`FENIKS_GATE_TRACE_ALL=1` для полного режима), измерение: `python3 .claude/skills/reflexion/scripts/trace-summary.py <YYYY-MM> | grep gate`.
- **Q4 Downside:** preload `roster-protocol` (~12.8 KB) в каждый вызов агента - рост input-токенов на вызов [ГИПОТЕЗА: +3-4K токенов]; при 20 вызовах в день это заметно, но prompt caching гасит повтор. Если сломается - убрать из `skills:` у Tier 3-4, оставить ссылку. Хук `deliver-gate` может надоедать при частых push дашбордов - он не блокирует, отключается одной строкой в settings.json.
- **Q5 Первый сигнал:** первый `/council` в native после мержа. Числовые критерии: (а) в `traces/<дата>/agents.jsonl` ≥ 4 строки `subagent_start` с `agent` из ростера и разбросом `ts` ≤ 10 секунд (реальный fan-out, не последовательность); (б) 0 строк с `agent: unknown` после сшивки по agent_id; (в) строка `event: audit` с `feniks_score` и `verdict`. Ответственный: Иван (запуск) + Claude (разбор трейса). Срок: 7 рабочих дней после мержа, буфер +50% (итого до 11 рабочих дней). Второй сигнал: `/reflexion 2026-09` до 10 октября 2026 (буфер до 15 октября).
- **Milestone 50%:** после первого `/council` и первого `/feniks` в native (не позже 5-го рабочего дня): критерий «идём дальше» - оба трейса валидны по `agent-trace.json` и гейт write-scope дал хотя бы одну строку `event: gate`; критерий «сворачиваем» - гейт молчит вживую второй раз подряд, тогда `tools` ФЕНИКСА урезаются до read-only до починки.
- **Rollback (полный, < 5 минут):** `git revert` коммитов PR #281 возвращает v2.0 агентов, `.claude/commands/` и settings.json без новых хуков; частичный - удалить строку хука из `settings.json` (deliver-gate, subagent-trace, feniks-*-scope независимы друг от друга) или убрать `skills:` из frontmatter конкретного бойца. Данные не затрагиваются: трейсы и эпизоды остаются.

## 4. Альтернативы, которые отброшены

- **Оставить commands/, добавить skills рядом** - двойные записи в `/`-меню и два источника правды. Отброшено.
- **Хранить role-карты как копии агентов** - дрейф гарантирован. Выбраны сжатые карты с явным правилом «побеждает файл агента».
- **Блокирующий deliver-gate** - MASTER_SYSTEM_v9 §6.4: блокировка только после 30 дней метрик. Оставлено напоминание.
- **Agent teams (TeamCreate)** - экспериментальная фича по env-переменной, недоступна в headless. Не используется; в roster-protocol не упоминается, чтобы не обещать.
- **Все 40 skills в плагин** - Claude Design Kit (сторонний, лицензия) и kostya-ai (внутренние данные) в плагин ростера не входят.
- **Убрать Bash из `tools` ФЕНИКСА** вместо эвристического гейта - отброшено: без Bash невозможны live-пробы класса A/B/D (запуск хуков на фикстурах, `validate.py`, `node --check`, подсчёты), а именно пробы дали все существенные находки 2026 года. Цена выбора - эвристика с известными классами обхода (шапка `feniks-bash-scope.sh`) и налог ложных срабатываний; компенсация - Stop-хук и `git status --porcelain` в каждом отчёте.

## 4a. Step 12.5 - итерация 1 (2026-09-06)

ФЕНИКС v3.0: **6.95/10, return** (accuracy 8.0 · actionability 5.0 · insight 8.0 · brand 8.0 · risk 6.0), anchor 7.6 timur-iter1.
Отчёт: `knowledge/episodes/2026-09/feniks-audit-roster-v3-20260906.md`. 23 пробы, 10 gaps с evidence, 16 пунктов rework.
Что нашёл (и что закрыто в итерации 2):
1. Agent-scoped хук write-scope вживую не сработал (Write ФЕНИКСА в `schemas/` прошёл) → project-level регистрация по `agent_type` + agent-scoped с абсолютным путём и `--force`; путь нормализуется realpath (обход через `..` закрыт).
2. Bash-вектор (ATTACK B) → новый `feniks-bash-scope.sh`; git-операции записи ФЕНИКСУ запрещены; ограничение эвристики записано честно.
3. deliver-gate мёртв в shallow clone → tree-diff против origin/main без merge-base; матчер покрывает кавычки, полный путь, `-C`, флаги.
4. Якорь 8.15 арифметически 9.35, claim «>9.0 не наблюдалось» ложен (sales-director 9.25/9.45/9.52) → исправлено в якорях и трёх дублях; набор якорей помечен как черновик до решения Ивана.
5. `validate.py` не проверял арифметику → post-check весов ±0.05 и суммы чекпоинтов; пример phoenix-eval и живой отчёт ФЕНИКСА 2026-07-01 стали фикстурами smoke-test; pattern чекпоинтов допускает цифры.
6. `council.js` пропускал отчёт без проб → `probes` обязательны, класс gate/dashboard/agent без проб получает risk ≤ 5.0 и verdict ≤ return (численный «потолок 7.9» из итерации 2 позже убран как несовместимый с арифметикой весов, см. §4b); ростер Ивана в DEBATE не переопределяется P9; правило «>$1 - предупредить» реализовано через budget (тариф [ГИПОТЕЗА]).
7. Трейс терял агента на SubagentStop → сшивка по agent_id, outcome без «success по умолчанию», feniks_score только ФЕНИКСУ; `trace-summary.py` находит корень через CLAUDE_PROJECT_DIR.
8. CLAUDE.md §9: порог stop сведён с порогом вето; память ДАТЫ - числа с путями; эта секция и Q5 - milestone, числовые критерии, буфер, rollback.

## 4b. Step 12.5 - итерация 2 (2026-09-06)

ФЕНИКС v3.0: **8.20/10, return** (accuracy 8.0 · actionability 9.0 · insight 7.0 · brand 9.0 · risk 8.0), дельта +1.25, anchor 8.9 annotate-after-rework.
Отчёт: `knowledge/episodes/2026-09/feniks-audit-roster-v3-iter2-20260906.md`. 14 из 16 пунктов итерации 1 закрыты воспроизводимо, 2 частично.
`return` при 8.20 - по правилу «FAIL пробы класса A»: гейт пропускал `find -delete`, `sort -o`, `perl -i`, `ex`; дыра `1>` существовала на HEAD 41277a8 и закрыта до конца итерации.
Главная находка - противоречие трёх слоёв: схема запрещала `return` при weighted ≥ 7.5, а роль и `council.js` его требуют. Решено (итерация 3): схема разрешает `return` при любом weighted ≥ 6.0, `validate.py` требует для return ≥ 7.5 либо FAIL пробы A/B7, либо `verdict_override_reason`; `council.js` не режет weighted константой, а корректирует risk_awareness и пишет причину. Численный «потолок 7.9» из документов убран: правило теперь только про risk ≤ 5.0 и verdict.
Ещё закрыто: DANGEROUS-команды в bash-scope, read-only allow-list против ложных блоков, цели только в кавычках для write-API, трейс гейта только на block, `artifact_class` вне enum → mixed, пробы считаются только с id класса и evidence.
Открыто для Ивана: источник правды для weighted при поправках (принято решение выше, подтверждено Иваном 2026-09-08, §6) и пометка о расхождении 8.15 / 8.350 / 9.35 в эпизоде master-system iter2 (добавлена как примечание, оценка не менялась).

## 4c. Step 12.5 - итерация 3, последняя по правилу (2026-09-06)

ФЕНИКС v3.0: **8.05/10, return** (accuracy 8.0 · actionability 9.0 · insight 7.0 · brand 9.0 · risk 7.0), anchor 8.5 timur-activation.
Отчёт: `knowledge/episodes/2026-09/feniks-audit-roster-v3-iter3-20260906.md`. 9 из 9 пунктов итерации 2 отработаны (5 полностью, 4 частично).
`return` - по FAIL пробы A2: моя же правка ложных срабатываний (allow-list read-only команд) внесла регрессию: `env` в списке
пропускал `env cp`, `env rm`, `env find -delete`, `env git push`; цели без расширения (`Makefile`, `.gitignore`) были невидимы;
council.js понижал risk-score, не трогая чекпоинты. Главный процессный вывод ФЕНИКСА: три итерации без регрессионного теста хуков.
Закрыто после итерации 3 (без четвёртого аудита, по правилу трёх итераций - на решение Ивана):
1. `feniks-bash-scope.sh` переписан: обёртки-исполнители (`env`, `command`, `exec`, `time`, `nohup`, `sudo`, `bash -c`, `eval`) снимаются до разбора; явные цели DANGEROUS-команд (`sort -o`, `perl/ruby -i`, `ex/vi`, `find` стартовые пути) без требования расширения; `rm/touch/mkdir/…` - все аргументы; `xargs` с пишущей командой - блок; перенаправления ищутся без строковых литералов (`echo 'k -> v'` не запись); `open("a")` - режим, не путь; одиночный `/` - оператор pathlib.
2. **Регрессионный тест хуков** `.claude/hooks/tests/run-hook-tests.sh` + `scope-cases.tsv`: 112 кейсов (векторы итераций 1-3, read-only и ложные срабатывания, свои зоны, не-ФЕНИКС, write-scope, матчер deliver-gate). Условие любой правки хуков.
3. `council.js`: при понижении risk_awareness режутся и чекпоинты risk_* (сумма ≤ 5) - объект стенда с 25 чекпоинтами проходит `validate.py`; проба чужого класса (C3 для gate) не считается; id пробы без учёта регистра.
4. `validate.py`: id пробы без учёта регистра; схема: `probes[].id` по шаблону буква+цифра. `trace-summary.py`: `share_go` по вердикту, отдельно `share_ge_75` по оценке.
Остаточные риски (задокументированы в шапке хука): скрипт-посредник, интерпретатор без write-API, сборка имени из переменных, редкий бинарник.

## 5. Открытые вопросы Ивану

1. Подтвердить, что `.claude/agent-memory/` коммитится в публичный репозиторий (сейчас там только калибровка и карта источников, числа с путями, без PII). **Решено 2026-09-08: коммитится (§6).**
4. Утвердить набор калибровочных якорей `phoenix-eval/references/calibration-anchors.md` (черновик): пересчёт якоря 8.15 (арифметически 9.35) и статус серии sales-director 9.25-9.52. **Решено 2026-09-08: набор утверждён, якорь пересчитан на 9.35, серия остаётся как наблюдение (§6).**
5. Подтвердить контракт weighted_total при поправках v3: weighted = Σ(score × weight) всегда, понижение живёт в verdict + `verdict_override_reason` (принято в итерации 3, ФЕНИКС просит подтверждения). **Подтверждено 2026-09-08 (§6).**
6. Решение по мержу PR #282 после трёх итераций (8.05, return по регрессии, закрытой после аудита; регрессионный тест 112/112). **Решено 2026-09-08: мерж (§6).**
2. Проверить установку плагина по чек-листу `agents-v9/COWORK_AND_PLUGIN.md` §4 и записать результат.
3. Решить, когда deliver-gate переводится в блокирующий режим (предложение: после 30 дней трейсов, на CC-19 за октябрь).

## 6. Решения Ивана (2026-09-08)

Иван дал четыре решения одной командой («мерж, контракт weighted_total, калибровочные якоря, коммит - делай»):

1. **Мерж PR #282.** Последний вердикт ФЕНИКСА - 8.05 return (итерация 3, регрессия `env`-обёртки закрыта после аудита,
   регрессионный тест хуков 112/112). Мерж при вердикте return - переопределение по правилу трёх итераций, право
   единственного лица (CLAUDE.md §1). Перед мержем повторно прогнаны `run-hook-tests.sh` (112/112), `smoke-test.py`
   (5 схем OK), `validate.py agent-trace` на журналах 06-08.09, `node --check council.js`.
2. **Контракт weighted_total v3 подтверждён:** `weighted_total = Σ(score × weight)` всегда (допуск 0.05 в `validate.py`);
   понижение живёт в `verdict` + `verdict_override_reason` (FAIL пробы A/B7, класс без проб, self-claimed score);
   `council.js` при понижении корректирует risk_awareness и чекпоинты risk_*, а не режет сумму константой.
3. **Набор калибровочных якорей утверждён.** Якорь MASTER_SYSTEM_v9 итерация 2 пересчитан 8.15 → 9.35 по контракту
   из п. 2 (июньский отчёт не редактируется, в нём примечание); серия sales-director 9.25-9.52 остаётся в наборе как
   наблюдение без пересмотра. Якоря с этой даты применяются как линейка, новые - только по решению Ивана.
4. **`.claude/agent-memory/` коммитится** в публичный репозиторий: только калибровка и карта источников, числа с путями,
   без PII и без содержимого сообщений.

Сделано после решения: версия плагина 3.0.3 (агент ФЕНИКСА, хуки, схемы, якоря, workflow), выгрузка в ветку `plugin`
скриптом `.claude-plugin/export-plugin.sh --push`. Дубли skills в аккаунте claude.ai (10 `gengroup-*`, список в
`agents-v9/COWORK_AND_PLUGIN.md` §5) из облачной сессии не отключаются - это Customize → Skills руками Ивана;
в репозитории дублей skills нет (`agents/` - копия 13 агентов для загрузчика плагина, дрейф ловит `sync-agents.sh --check`).

## 7. Установка в Desktop: замер 2026-09-10, зеркало понижено до плана Б

Иван: «создай его скорее» (репозиторий-зеркало `oliverjone01-dev/gengroup-roster`). Создать нельзя: `POST /user/repos`
через интеграцию отдаёт 403 «Resource not accessible by integration» (повтор 2026-09-08 и 2026-09-10, `get_me` при этом
работает). Создание репозитория под личным аккаунтом требует пользовательского токена, приложению оно не делегируется.

Вместо этого проверена форма источника с явной веткой [ДАННЫЕ 2026-09-10]:

| Команда | Результат |
|---|---|
| `claude plugin marketplace add oliverjone01-dev/t1@plugin` | клон только ref `plugin`, 2.0 с, чекаут 1.3 МБ |
| `claude plugin install gengroup-roster@gengroup` | 880 КБ в `~/.claude/plugins/cache/gengroup/gengroup-roster/3.0.3` |
| `claude plugin list` | `gengroup-roster@gengroup` 3.0.3 enabled |

Вывод: причина «нужен отдельный репозиторий» (сервер клонирует ветку по умолчанию, main 465 МБ) к форме с `@` не
относится. Desktop отверг только формы без ветки и с разделителем `#`: `t1` и `t1.git#plugin` - «Marketplace sync
failed», `t1#plugin` - «Marketplace source format is invalid». Строка `oliverjone01-dev/t1@plugin` именно в поле
Desktop остаётся [ГИПОТЕЗА] до проверки Иваном: CLI и Desktop делят подсистему плагинов, но поле ввода не проверялось.
Прежний текст `agents-v9/COWORK_AND_PLUGIN.md` утверждал «`t1@plugin` не проходит» без замера, это опровергнуто.

Step 12.5 на коммит a2de0e9 не гонялся: изменена инструкция по установке, а не гейт, дашборд, агент или контент
наружу. Цена ошибки - одна неудачная строка в поле Desktop и возврат к плану Б. Хук `deliver-gate.sh` напомнил про
аудит при push (9 критических файлов в диффе ветки), 8 из них аудированы 2026-09-08 (итерация 2, go 7.95) и с тех
пор не менялись.

Что делает Иван: вводит `oliverjone01-dev/t1@plugin` в Customize → Plugins → Add marketplace. Если поле не примет `@` -
создаёт `gengroup-roster` (New repository, Public, без README) и говорит сюда, зеркало заливается скриптом за минуту.
Отдельно остаётся отключить 10 дублей `gengroup-*` в Customize → Skills (§5 `agents-v9/COWORK_AND_PLUGIN.md`).
