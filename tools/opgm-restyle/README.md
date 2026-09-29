# Инструменты приёмки рестайлинга ОП ГМ

Синтетический стенд и проверки из плана v3 (`knowledge/episodes/2026-09/opgm-restyle-plan-v2-20260929.md`).
Данные только вымышленные (`harness/gen.cjs`). Папки `out/` и `variants/<имя>/` не коммитить.

Корень op-gm: `--op <op-gm-automation>`, переменная `OP` или папка выше `tools/` (после переезда в `op-gm-automation/tools/`, коммит Д0, правка путей не нужна).
`.gitignore` этой папки исключает `out/` и `variants/*/`: переносится в op-gm вместе с инструментами.

Запуск: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers bash run-acceptance.sh --op <op>`, второй набор входов `run-newinputs.sh --op <op>`,
мутанты ФЕНИКСА iter2 `run-feniks-mutants.sh --op <op> --v <папка make-variants.py>`.

Реальные данные (план v3 §3.7): только сессия Д-пакета, `numsnap snap --data <папка вне репозитория>`; D живёт в памяти,
выходы внутри git-репозитория запрещены (код 2), `diff` на реальных данных не печатает значения.
