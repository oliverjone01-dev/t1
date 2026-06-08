#!/usr/bin/env bash
# Protocol 9 trigger detector — fires on UserPromptSubmit.
# Reads JSON event from stdin, scans user prompt for P9 triggers,
# injects additionalContext if any found.
# Exit 0 = continue. Never blocks; only nudges.

set -euo pipefail

EVENT="$(cat)"
PROMPT="$(printf '%s' "$EVENT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("prompt",""))' 2>/dev/null || true)"

if [ -z "$PROMPT" ]; then
  exit 0
fi

# Trigger patterns (Russian, case-insensitive). Keep grep portable.
PATTERNS=(
  'эффект на выручку'
  'удвоит'
  'выстрелит'
  'взорв(ёт|ет) рынок'
  'уникальн(ый|ая|ое) актив'
  'никто в (РФ|России)'
  'просто надо подключить'
  'база уже есть'
  'монопольн(ая|ой) позиц'
  '\+[[:space:]]*[0-9]+[[:space:]]*(млн|мил)'
  '\bROMI[[:space:]]*>[[:space:]]*[0-9]+'
  '\bICE[[:space:]]*[0-9]'
  'к 31\.[0-9]+ будет готово'
  'стратегическая ставка'
  '\bудвоен'
)

HITS=()
for pat in "${PATTERNS[@]}"; do
  if printf '%s' "$PROMPT" | grep -iqE -- "$pat"; then
    HITS+=("$pat")
  fi
done

if [ "${#HITS[@]}" -eq 0 ]; then
  exit 0
fi

REMINDER="Protocol 9 trigger(s) detected in your prompt: ${HITS[*]}.
Before proceeding with planning or commitments, run /reality-audit on the relevant claim — tag every figure as [ДАННЫЕ] or [ГИПОТЕЗА], answer the 5 questions, and apply hard rules. See CLAUDE.md §5."

python3 - "$REMINDER" <<'PY'
import json, sys
msg = sys.argv[1]
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": msg
    }
}))
PY
