#!/usr/bin/env bash
# feniks-write-scope.sh - agent-scoped hook ФЕНИКСА (PreToolUse Write|Edit).
# Hard Rule 4: ФЕНИКС не создаёт контент и код продукта. Технически: запись разрешена только в
#   knowledge/episodes/**, knowledge/reflexion/**, traces/**, .claude/agent-memory/feniks/**, /tmp/**
# Всё остальное - exit 2 (блок) с объяснением. Регистрируется в frontmatter .claude/agents/feniks.md.

set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

EVENT="$(cat)"
FILE_PATH="$(printf '%s' "$EVENT" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))
except Exception: pass' 2>/dev/null || true)"

[ -z "$FILE_PATH" ] && exit 0

REL="$FILE_PATH"
case "$REL" in
  "$ROOT"/*) REL="${REL#"$ROOT"/}" ;;
esac

case "$REL" in
  /tmp/*|knowledge/episodes/*|knowledge/reflexion/*|traces/*|.claude/agent-memory/feniks/*)
    exit 0 ;;
esac

echo "BLOCKED (ФЕНИКС Hard Rule 4 / feniks-write-scope): запись в '$REL' запрещена. ФЕНИКС пишет только отчёты и диспуты (knowledge/episodes/**, knowledge/reflexion/**), трейсы (traces/**) и свою память (.claude/agent-memory/feniks/**). Правки продукта делает автор по rework_tz." >&2
exit 2
