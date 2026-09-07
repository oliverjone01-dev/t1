#!/usr/bin/env bash
# Anti-Slop checker - fires on PreToolUse for Write/Edit on .md/.html/.txt files.
# Scans the new_string/content for forbidden patterns from CLAUDE.md §7.
# Warns (does not block) by injecting additionalContext.

set -euo pipefail

EVENT="$(cat)"

CONTENT="$(printf '%s' "$EVENT" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    inp = d.get("tool_input", {})
    parts = []
    for k in ("content", "new_string"):
        v = inp.get(k)
        if isinstance(v, str):
            parts.append(v)
    print("\n".join(parts))
except Exception:
    pass
' 2>/dev/null || true)"

FILE_PATH="$(printf '%s' "$EVENT" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input", {}).get("file_path", ""))
except Exception:
    pass
' 2>/dev/null || true)"

# Skip if not a target file type
case "$FILE_PATH" in
  *.md|*.html|*.txt|*.htm) ;;
  *) exit 0 ;;
esac

[ -z "$CONTENT" ] && exit 0

# Forbidden phrases (from CLAUDE.md §7 Anti-Slop Blocklist v2)
PATTERNS=(
  'в мире современного дизайна'
  'не секрет, что'
  'на протяжении веков'
  'является неотъемлемой частью'
  'позволяет создать'
  'высокое качество'
  'опытные специалисты'
  'индивидуальный подход'
  'доступные цены'
  'гармонично вписывается'
  'идеальное решение'
  'квинтэссенция'
  'широкий ассортимент'
  'инновационный'
  'революционный'
  'непревзойдённый'
  'удвоит бизнес'
  'выстрелит'
  'взорвёт рынок'
)

HITS=()
for pat in "${PATTERNS[@]}"; do
  if printf '%s' "$CONTENT" | grep -iqF -- "$pat"; then
    HITS+=("$pat")
  fi
done

# Em dash check (single character, separate rule).
# ВНИМАНИЕ: здесь обязан стоять настоящий U+2014, а не ASCII-дефис. До 09.08.2026
# в шаблоне стоял дефис, поэтому проверка срабатывала на любом тексте с дефисом,
# то есть всегда, и не несла сигнала. Настоящий em dash при этом проходил
# незамеченным среди постоянных ложных тревог: гейт CLAUDE.md §7 был мёртв.
# Нашёл ФЕНИКС при аудите промтов. Правя эту строку, проверяй байты: printf '%s' | xxd.
if printf '%s' "$CONTENT" | grep -q '—'; then
  HITS+=("em dash '—'")
fi

if [ "${#HITS[@]}" -eq 0 ]; then
  exit 0
fi

WARN="Anti-Slop blocklist hit (${#HITS[@]} pattern(s)) in $FILE_PATH:
$(printf '  - %s\n' "${HITS[@]}")
Apply humanizer-ru skill (double final pass) before publish. This is a warning, not a block."

python3 - "$WARN" <<'PY'
import json, sys
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "additionalContext": sys.argv[1]
    }
}))
PY
