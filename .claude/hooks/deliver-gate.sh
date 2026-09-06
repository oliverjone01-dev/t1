#!/usr/bin/env bash
# deliver-gate.sh - Step 12.5 reminder (Protocol 6, non-blocking).
# Fires on PreToolUse(Bash). Если команда - `git push` и в ветке относительно origin/main изменены
# критические артефакты (агенты, skills, конституция, knowledge, публичные HTML), а за сегодня нет
# ни одного трейса ФЕНИКСА (event=audit в traces/<today>/agents.jsonl или файл feniks-* в эпизодах),
# инжектит напоминание через additionalContext. Не блокирует: по MASTER_SYSTEM_v9 §6.4 хуки сначала
# напоминают, блокировка - после 30 дней метрик.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || true

EVENT="$(cat)"
CMD="$(printf '%s' "$EVENT" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception: pass' 2>/dev/null || true)"

[ -z "$CMD" ] && exit 0
# Матчер: любые формы вызова push - кавычки, полный путь, `-C <dir>`, `--flag`, таб, перенос строки (проба A4, 2026-09-06)
printf '%s' "$CMD" | grep -qE "(^|[^A-Za-z0-9_/.-])([^[:space:]'\"]*/)?git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+push([^A-Za-z0-9_-]|$)" || exit 0

TODAY="$(date +%Y-%m-%d)"
MONTH="$(date +%Y-%m)"

# Есть ли свежий аудит ФЕНИКСА
HAS_AUDIT=0
if [ -f "traces/${TODAY}/agents.jsonl" ] && grep -q '"event": *"audit"' "traces/${TODAY}/agents.jsonl" 2>/dev/null; then
  HAS_AUDIT=1
fi
if compgen -G "knowledge/episodes/${MONTH}/feniks-*${TODAY//-/}*" > /dev/null 2>&1; then
  HAS_AUDIT=1
fi
if compgen -G "traces/${TODAY}/feniks-*" > /dev/null 2>&1; then
  HAS_AUDIT=1
fi
[ "$HAS_AUDIT" -eq 1 ] && exit 0

# Изменены ли критические артефакты. Порядок (проба A5 dead gate, 2026-09-06: в shallow clone merge-base падает):
#   1) merge-base с origin/main есть -> diff от него;
#   2) origin/main есть, merge-base нет (shallow) -> diff деревьев origin/main..HEAD (не требует общей истории);
#   3) origin/main нет -> файлы последних 20 коммитов.
# Плюс staged-изменения. Если диапазон определить нельзя - напоминаем всё равно, молча не выходим.
BASE="$(git merge-base HEAD origin/main 2>/dev/null || true)"
if [ -n "$BASE" ]; then
  CHANGED="$(git diff --name-only "$BASE" HEAD 2>/dev/null)"
elif git rev-parse --verify -q origin/main >/dev/null 2>&1; then
  CHANGED="$(git diff --name-only origin/main HEAD 2>/dev/null)"
else
  CHANGED="$(git log --name-only --pretty=format: -n 20 HEAD 2>/dev/null)"
fi
CHANGED="${CHANGED}
$(git diff --name-only --cached 2>/dev/null)"
if [ -z "$(printf '%s' "$CHANGED" | tr -d '[:space:]')" ]; then
  CHANGED="<диапазон изменений определить не удалось: проверь вручную>"
fi
CRIT="$(printf '%s\n' "$CHANGED" | grep -E '^(<диапазон|CLAUDE\.md|\.claude/(agents|skills|hooks|workflows|settings\.json)|\.claude-plugin/|schemas/|knowledge/semantic/|agents-v9/|smm/public/|analytics-mvp/public/|.*\.html$)' | sort -u | head -15 || true)"
[ -z "$CRIT" ] && exit 0

N="$(printf '%s\n' "$CRIT" | grep -c . || true)"
MSG="Step 12.5 reminder (deliver-gate): git push затрагивает ${N} критических артефакт(ов), а за ${TODAY} нет трейса аудита ФЕНИКСА (event=audit в traces/${TODAY}/agents.jsonl или feniks-* в knowledge/episodes/${MONTH}/).
$(printf '%s\n' "$CRIT" | sed 's/^/  - /')
По CLAUDE.md §4 критический артефакт не деливерится без вердикта ФЕНИКСА. Прогони /feniks на diff до push или явно зафиксируй в коммите/PR, почему аудит не нужен (не критика). Это напоминание, не блок."

python3 - "$MSG" <<'PY'
import json, sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": sys.argv[1]}}, ensure_ascii=False))
PY
exit 0
