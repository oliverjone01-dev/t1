#!/usr/bin/env bash
# sync-agents.sh - копии агентов ростера для плагина.
# Почему копии: загрузчик плагинов Claude Code (2.1.263, проверено 2026-09-06 на локальном маркетплейсе) видит агентов
# только в каталоге `agents/` в корне плагина; поле `agents` со списком файлов проходит validate, но даёт Agents (0);
# симлинки на файлы не читаются; симлинк на каталог работает, но ненадёжен на Windows-чекаутах. Источник правды -
# `.claude/agents/<name>.md` (проектная конфигурация); `agents/<name>.md` - копия для плагина.
# В agents/ не должно быть ничего, кроме 13 файлов ростера: любой .md там становится агентом (README тоже).
# Usage: bash .claude-plugin/sync-agents.sh          # синхронизировать
#        bash .claude-plugin/sync-agents.sh --check  # только проверить дрейф (exit 1 при расхождении)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROSTER="spartak feniks marco data viktor boris emma maks semyon timur krea roman trener"
mode="${1:-sync}"
rc=0
mkdir -p "$ROOT/agents"
for a in $ROSTER; do
  src="$ROOT/.claude/agents/$a.md"; dst="$ROOT/agents/$a.md"
  if [ ! -f "$src" ]; then echo "нет источника: $src"; rc=1; continue; fi
  if [ "$mode" = "--check" ]; then
    if ! cmp -s "$src" "$dst"; then echo "ДРЕЙФ: agents/$a.md отличается от .claude/agents/$a.md (запусти bash .claude-plugin/sync-agents.sh)"; rc=1; fi
  else
    cp "$src" "$dst"
  fi
done
for f in "$ROOT"/agents/*.md; do
  b="$(basename "$f" .md)"
  case " $ROSTER " in *" $b "*) ;; *) echo "лишний файл в agents/: $b.md (не в ростере)"; rc=1 ;; esac
done
[ "$mode" = "--check" ] && { [ $rc -eq 0 ] && echo "agents/ синхронизирован с .claude/agents/ (13 файлов)"; } || true
exit $rc
