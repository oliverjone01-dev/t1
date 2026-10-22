#!/usr/bin/env bash
# install.sh - ставит data-guard в репозиторий Claude Code: bash install.sh /путь/к/репо
# Копирует repo/ в целевой репо: скилл, хук data-guard.py и его тесты перезаписывает; .claude/data-guard.json и реестр
# knowledge/errors/ не трогает, если уже есть. Дописывает хуки в .claude/settings.json без дублей.
# Требует python3; ничего не удаляет.
set -euo pipefail
DST="${1:?путь к целевому репозиторию}"
SRC="$(cd "$(dirname "$0")" && pwd)/repo"
mkdir -p "$DST/.claude/skills/data-guard" "$DST/.claude/hooks/tests" "$DST/knowledge/errors"
cp -r "$SRC/.claude/skills/data-guard/." "$DST/.claude/skills/data-guard/"
cp "$SRC/.claude/hooks/data-guard.py" "$DST/.claude/hooks/data-guard.py"
cp "$SRC/.claude/hooks/tests/data-guard-tests.py" "$DST/.claude/hooks/tests/data-guard-tests.py"
[ -f "$DST/.claude/data-guard.json" ] || cp "$SRC/.claude/data-guard.json" "$DST/.claude/data-guard.json"
[ -f "$DST/knowledge/errors/registry.jsonl" ] || cp "$SRC/knowledge/errors/registry.jsonl" "$DST/knowledge/errors/registry.jsonl"
[ -f "$DST/knowledge/errors/README.md" ] || cp "$SRC/knowledge/errors/README.md" "$DST/knowledge/errors/README.md"
python3 -I "$SRC/../merge_hooks.py" "$DST/.claude/settings.json" "$SRC/.claude/data-guard.hooks.json"
echo "Готово. Проверка: cd $DST && python3 .claude/hooks/tests/data-guard-tests.py -v"
echo "Дальше: поправь globs в .claude/data-guard.json под папки целевого репо (см. README.md)."
