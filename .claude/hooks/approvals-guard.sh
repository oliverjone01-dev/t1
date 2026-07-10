#!/usr/bin/env bash
# approvals-guard.sh - Protocol 6: approval-файлы неподделываемы инструментами агента.
# Fires on PreToolUse для Bash И Write|Edit. Блокирует (exit 2) любое создание,
# изменение или удаление путей .claude/approvals/** и .claude/state/** через
# инструменты агента. Файлы там появляются только рукой человека (терминал вне
# Claude Code / IDE), поэтому существование approval-файла = действие человека.
# Ответ на ATTACK A/B аудита ФЕНИКСА (итерация 2, 2026-07-08).

set -euo pipefail

EVENT="$(cat)"

PARSED="$(printf '%s' "$EVENT" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    inp = d.get("tool_input", {})
    print(inp.get("file_path", ""))
    print(inp.get("command", ""))
except Exception:
    pass
' 2>/dev/null || true)"

FILE_PATH="$(printf '%s' "$PARSED" | sed -n '1p')"
CMD="$(printf '%s' "$PARSED" | sed -n '2,$p')"

GUARDED_RE='\.claude/(approvals|state)(/|$)'

# Write/Edit: file_path в защищённой зоне - блок безусловно
if [[ -n "$FILE_PATH" ]] && printf '%s' "$FILE_PATH" | grep -qE "$GUARDED_RE"; then
    echo "BLOCKED (Protocol 6 / approvals-guard): запись в $FILE_PATH через инструменты агента запрещена. Approval- и state-файлы создаёт только человек вне Claude Code (после явного апрува Ивана)." >&2
    exit 2
fi

# Bash: любое упоминание защищённых путей - блок (включая чтение: cat approval-файла
# агенту не нужен, его читают только сами обёртки изнутри)
if [[ -n "$CMD" ]] && printf '%s' "$CMD" | grep -qE "$GUARDED_RE"; then
    echo "BLOCKED (Protocol 6 / approvals-guard): команда упоминает .claude/approvals или .claude/state - работа с этими путями через инструменты агента запрещена. Файлы там создаёт/меняет только человек." >&2
    exit 2
fi

exit 0
