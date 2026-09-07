# Ростер v3 в Claude Code и в Cowork: установка и ограничения

Дата: 2026-09-06. Источник фактов о платформе: официальные docs Claude Code (sub-agents, skills, hooks, plugins,
plugin-marketplaces, desktop, workflows), проверены 2026-09-06 через claude-code-guide. Всё, что помечено
[ГИПОТЕЗА], на живой установке не проверялось.

## 1. Claude Code (CLI, Desktop → вкладка Code, claude.ai/code)

Ничего устанавливать не нужно: репозиторий сам является проектной конфигурацией.
- Агенты: `.claude/agents/*.md` (13 ростера + 2 технических). [ДАННЫЕ: ls .claude/agents]
- Skills: `.claude/skills/*/SKILL.md`; user-invocable: `/council`, `/feniks`, `/reality-audit`, `/crisis`, `/reflexion`.
- Хуки: `.claude/settings.json` (P6 approvals-guard / direct-write-gate, P9 detector, Anti-Slop, P14 subagent-trace, deliver-gate).
- Workflow: `.claude/workflows/council.js` - запуск по имени `council` только при явном opt-in Ивана.
- Проверка: `python3 schemas/smoke-test.py` (5 схем + 2 живые фикстуры), `bash .claude/hooks/tests/run-hook-tests.sh` (гейты, 112 кейсов), `bash .claude-plugin/sync-agents.sh --check` (копии агентов плагина), `bash -n .claude/hooks/*.sh`.

## 2. Как плагин (другой репозиторий, другой человек, тот же ростер)

```
/plugin marketplace add oliverjone01-dev/t1
/plugin install gengroup-roster@gengroup
```
Манифесты: `.claude-plugin/plugin.json` (agents, skills, workflows, hooks), `.claude-plugin/marketplace.json`
(репозиторий = маркетплейс с одним плагином, `source: "./"`). Skills в плагине именуются `gengroup-roster:<skill>`.
[ДАННЫЕ: `claude plugin validate` и локальный маркетплейс, 2.1.263, 2026-09-06] загрузчик плагинов видит агентов ТОЛЬКО
в каталоге `agents/` в корне плагина (без поля `agents` в манифесте): каталог в поле отклоняется валидатором, явный список
файлов проходит валидацию, но даёт Agents (0), симлинки на файлы не читаются, симлинк на каталог работает, но ненадёжен
на Windows. Поэтому с 3.0.2 в репозитории лежат копии 13 агентов ростера в `agents/` (источник правды - `.claude/agents/`),
синхронизация `bash .claude-plugin/sync-agents.sh`, проверка дрейфа `--check` (deliver-gate напоминает при push).
В `agents/` не может быть других .md: любой файл там становится агентом. Технические агенты accessibility-auditor и
ui-migration-architect в плагин не входят. Headless-установка с GitHub: `marketplace add` и `install` проходят,
`claude plugin details gengroup-roster@gengroup` показывает Skills (19), Agents (13), Hooks (5); обновление 3.0.1 → 3.0.2
через `claude plugin marketplace update gengroup` + `claude plugin update gengroup-roster@gengroup` проверено 2026-09-06 21:18 UTC.
Эта установка действует только в Claude Code на той машине (CLI и вкладка Code); в Cowork и облачные сессии она не попадает (§3, §5).

Автоподключение маркетплейса на всех машинах (`~/.claude/settings.json`), по docs settings-reference:
```json
{
  "extraKnownMarketplaces": { "gengroup": { "source": { "source": "github", "repo": "oliverjone01-dev/t1" }, "autoUpdate": true } },
  "enabledPlugins": { "gengroup-roster@gengroup": true }
}
```
[ДАННЫЕ: docs discover-plugins, 2026-09-06] `enabledPlugins` для внешнего источника не устанавливает плагин сам (trust gate):
один раз на машине нужен `claude plugin install gengroup-roster@gengroup`, дальше он включён.

## 3. Cowork (Desktop → вкладка Cowork)

Cowork берёт skills и plugins из настроек аккаунта claude.ai (Customize), а НЕ из `.claude/` проекта.
[ДАННЫЕ: docs desktop.md, skills.md §Skills in Cowork, снимок 2026-09-06]

Что это значит для ростера:

| Компонент | В Cowork | Как компенсировано |
|---|---|---|
| `.claude/agents/*.md` проекта | не загружаются | **из плагина, включённого для аккаунта claude.ai, агенты загружаются** (как `<name>@synced`, доступны через @ и Agent tool) [ДАННЫЕ: docs plugins-reference «Agents and Hooks in Cowork/Cloud Sessions», 2026-09-06]. Без плагина: role-карты 13 ролей в `.claude/skills/council/references/roster-cards.md`; skills `/council`, `/feniks`, `/reality-audit`, `/crisis` имеют раздел «Cowork path» (general-purpose subagents с инлайн-картой, иначе HATS) |
| Проектные хуки `.claude/settings.json` | не применяются (только `~/.claude/settings.json`) | **хуки плагина (`hooks.json`) в Cowork исполняются** [ДАННЫЕ: те же docs] - P9-детектор, Anti-Slop, P14-трейсы, гейты ФЕНИКСА; без плагина - roster-protocol §7 и §10 вручную |
| Approval-файлы Protocol 6 | недоступны | любая мутация внешних систем = `HITL: Иван`, только подготовка |
| `memory: project` агентов | недоступна | калибровка ФЕНИКСА читается из `phoenix-eval/references/calibration-anchors.md` (в плагине) |
| Workflow `council.js` | [ГИПОТЕЗА] недоступен | native path / HATS |

Установка в Cowork. Поправка 2026-09-06 (вечер): синхронизация ОДНОСТОРОННЯЯ, из аккаунта claude.ai вниз в Cowork и в
облачные сессии. `claude plugin marketplace add` и `claude plugin install` на машине пишут только в `~/.claude` этой машины
и в Cowork НЕ попадают; прежняя формулировка этого абзаца («выполнить две команды, затем плагин виден в Customize») была
неверной. [ДАННЫЕ: docs desktop.md «Extend Claude Code»: Cowork берёт skills, plugins и connectors из Customize, «which syncs
through your claude.ai account, not from the CLI's ~/.claude directory»; docs plugins-reference «Plugins synced from
claude.ai»: облачная сессия скачивает плагины, включённые для аккаунта, в `~/.claude/plugins/synced/` и грузит их как
`<name>@synced`, без маркетплейса и записи об установке.]

Практический путь:
1. Desktop → боковая панель **Customize** → Plugins → включить `gengroup-roster` для аккаунта. [ГИПОТЕЗА] Можно ли там
   указать сторонний маркетплейс `oliverjone01-dev/t1` (не официальный) - в docs Claude Code не описано, а claude.com/docs и
   support.claude.com из облачной сессии недоступны (egress blocked); проверяет первый, кто откроет Customize. Если сторонний
   маркетплейс в Customize добавить нельзя, Cowork остаётся в режиме «skills + role-карты» (таблица выше).
2. Проверка: в Cowork или в новой облачной сессии `claude plugin list` показывает плагин под заголовком
   `Synced from claude.ai`; `/agents` содержит spartak, feniks и бойцов как `<name>@synced`.
3. Выключить дубли: старые account-навыки с теми же триггерами (список в §5), иначе один запрос будит две версии.

Правило конфликта имён [ДАННЫЕ: docs plugins-reference, то же место]: если плагин с тем же именем установлен из
маркетплейса или подключён через `--plugin-dir`, грузится он, а synced-копия помечается как не загруженная; чтобы
работала копия из аккаунта, свою отключить: `claude plugin disable gengroup-roster@gengroup`. Отключить synced-копию в
одной сессии: `claude plugin disable gengroup-roster@synced`; в одном проекте навсегда: `"gengroup-roster@synced": false`
в `enabledPlugins` его `.claude/settings.json`.

Честная оценка: без плагина в Cowork ростер работает как «skills + карты», без независимого субагента-ФЕНИКСА и без
технических гейтов; с плагином, по docs, агенты и хуки доступны, но это [ГИПОТЕЗА] до живой проверки по чек-листу §4. Поэтому аудит ФЕНИКСА, полученный в Cowork без Bash, для гейтов, дашбордов и агентов считается
аудитом без проб (risk_awareness ≤ 5.0, verdict не выше return; phoenix-eval, поправки v3), а критические артефакты (CLAUDE.md §4) проходят повторный
`/feniks` в Claude Code до deliver.

## 4. Что проверить на первой установке (чек-лист Ивана / Дмитрия)

1. `/plugin install gengroup-roster@gengroup` в чистом репозитории → `/agents` показывает spartak, feniks и бойцов.
2. `/council тест: план на 2 абзаца` в Claude Code → в `traces/<дата>/agents.jsonl` появились строки subagent_start/stop.
3. В Cowork: `/council` → первая строка эпизода `MODE: cowork`, роли из карт.
4. Попытка записать файл в `.claude/agents/` от имени ФЕНИКСА → блок хука `feniks-write-scope.sh`.
5. `python3 .claude/skills/reflexion/scripts/trace-summary.py <YYYY-MM>` даёт сводку без ошибок.
6. `bash .claude/hooks/tests/run-hook-tests.sh` - регрессионный тест гейтов ФЕНИКСА и deliver-gate: все кейсы passed (обязателен после любой правки `.claude/hooks/`).
Результаты - в `knowledge/episodes/<YYYY-MM>/roster-v3-install-check.md`.

## 5. Что выполнимо из облачной сессии Claude Code, а что только руками Ивана

Проверено 2026-09-06 21:20 UTC в облачной сессии claude.ai/code этого репозитория:
- `~/.claude/plugins/synced/` пуст: в аккаунте claude.ai ни один плагин не включён. [ДАННЫЕ: ls]
- `~/.claude/skills/synced/<bucket>/manifest.json`: 27 account-навыков, среди них 10 дублей ростера (таблица ниже). [ДАННЫЕ]
- Канала записи «вверх» в аккаунт нет: `claude plugin` (2.1.263) не имеет команды синхронизации, account-навыки из Claude
  Code не отключаются; `syncClaudeAiSkills: false` в `~/.claude/settings.json` машины лишь выключает подтягивание всех
  навыков сразу. [ДАННЫЕ: `claude plugin --help`; docs settings, plugins-reference]
- Локальные сессии на машине Ивана из облака не видны (ListAgents пуст), поэтому команды на его машине отсюда не выполнить.
- В облачной сессии этого репозитория дубли уже видны: проектные `geo-aeo`, `phoenix-eval` и т.д. и account-версии
  `gengroup-*` загружены одновременно; шаг C ниже убирает дубли и здесь.

Только руками (Desktop / claude.ai):

| Шаг | Где | Действие |
|---|---|---|
| A | Терминал на машине | `claude plugin marketplace add oliverjone01-dev/t1` + `claude plugin install gengroup-roster@gengroup`: ростер в Claude Code CLI и во вкладке Code для ДРУГИХ репозиториев. В этом репозитории не нужно (§1). |
| B | Desktop → Customize → Plugins | включить `gengroup-roster` для аккаунта: Cowork и облачные сессии получают `<name>@synced` (13 агентов, 19 skills, 5 хуков). См. [ГИПОТЕЗА] о стороннем маркетплейсе в §3. |
| C | Desktop → Customize → Skills | выключить дубли: `gengroup-geo-aeo`, `gengroup-phoenix-eval`, `gengroup-reality-audit`, `gengroup-humanizer-ru`, `gengroup-crisis-response`, `gengroup-competitor-intel`, `gengroup-cross-sell`, `gengroup-encyclopedia`, `gengroup-content-factory`, `gengroup-brand` (в плагине те же навыки под именами без префикса, версии v3). |
| D | там же | оставить: `gengroup-aio-recon`, `gengroup-seo-manual`, `gengroup-seo-pipeline`, `gengroup-content-expert`, `gengroup-print-design`, `bogdan-persona`, `avu-persona`, `valonti-brand` (аналогов в плагине нет). Остальные account-навыки (docx, pdf, pptx, xlsx, humanizer, skill-creator, import-memory, morning, turbium-webdis-v1) ростера не касаются. |

Облачные сессии ДРУГОГО репозитория без шага B: объявить в его `.claude/settings.json` `extraKnownMarketplaces` +
`enabledPlugins` (сниппет §2); плагин ставится при старте сессии из маркетплейса, нужен сетевой доступ к GitHub.
[ДАННЫЕ: docs cloud-environments «What carries over from your setup»]. В этом репозитории так делать не нужно: проект уже
содержит те же агенты, skills и хуки, плагин их продублирует (в контейнере он выключен: `"gengroup-roster@gengroup": false`).

Проверка после шага B, доступная из облака: новая облачная сессия → `claude plugin list` показывает
`gengroup-roster` под `Synced from claude.ai`, `/agents` показывает 13 ролей `@synced`. Результат в
`knowledge/episodes/<YYYY-MM>/roster-v3-install-check.md` (§4).
