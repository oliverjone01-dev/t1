# Инструменты приёмки рестайлинга ОП ГМ

Синтетический стенд и проверки из плана v2 (`knowledge/episodes/2026-09/opgm-restyle-plan-v2-20260929.md`).
Данные только вымышленные (`harness/gen.cjs`). Папки `out/` и `variants/<имя>/` не коммитить.

Пути по умолчанию `../opgm/op-gm-automation` указывают на рабочую копию ветки op-gm-automation-v1 рядом с этой папкой;
переопределяются аргументом `--op`. При переезде в `op-gm-automation/tools/` (первый коммит Д-пакета) заменить их.

Запуск: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers bash run-acceptance.sh`, второй набор входов `run-newinputs.sh`.
