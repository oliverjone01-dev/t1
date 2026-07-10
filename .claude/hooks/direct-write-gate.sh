#!/usr/bin/env bash
# direct-write-gate.sh - Protocol 6 enforcement для Яндекс.Директ.
# Fires on PreToolUse для Bash. Блокирует (exit 2) мутирующие вызовы API Директа
# (add/update/delete/suspend/resume/setBids/setAutoBids/archive/unarchive/moderate),
# если нет действующего approval-файла с сегодняшней датой:
#   .claude/approvals/direct-write.ok
# Read-вызовы (method get, reports) пропускает молча.
# Второй эшелон после read-only yd-api.sh: ловит сырой curl и yd-api-write.sh.

set -euo pipefail

EVENT="$(cat)"

CMD="$(printf '%s' "$EVENT" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input", {}).get("command", ""))
except Exception:
    pass
' 2>/dev/null || true)"

[[ -z "$CMD" ]] && exit 0

# Касается ли команда API Директа вообще
if ! printf '%s' "$CMD" | grep -qiE 'api\.direct\.yandex\.com|yd-api(-write)?\.sh'; then
    exit 0
fi

MUT_METHODS='add|update|delete|suspend|resume|archive|unarchive|moderate|setBids|setAutoBids'

IS_MUTATION=0
# 1) JSON-тело: "method":"add" и т.п. (сырой curl). Кавычки могут быть
#    экранированы бэкслешем внутри командной строки - \"method\":\"add\".
if printf '%s' "$CMD" | grep -qiE '\\?"method\\?"[[:space:]]*:[[:space:]]*\\?"('"$MUT_METHODS"')\\?"'; then
    IS_MUTATION=1
fi
# 2) CLI-форма: yd-api.sh <service> <mut_method> / yd-api-write.sh <service> <mut_method>
if printf '%s' "$CMD" | grep -qiE 'yd-api(-write)?\.sh[[:space:]]+[a-z]+[[:space:]]+('"$MUT_METHODS"')([[:space:]]|$|'"'"')'; then
    IS_MUTATION=1
fi
# 3) Вызов write-обёртки с аргументами (<service> <method>) - мутация по определению.
#    Именно форма вызова, а не любое упоминание файла: cp/chmod/bash -n не блокируем.
#    Главный контроль всё равно внутри yd-api-write.sh (approval-файл) - хук лишь второй эшелон.
if printf '%s' "$CMD" | grep -qE 'yd-api-write\.sh[[:space:]]+[a-z]+[[:space:]]+[a-zA-Z]+'; then
    IS_MUTATION=1
fi

[[ "$IS_MUTATION" -eq 0 ]] && exit 0

APPROVAL_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/approvals/direct-write.ok"
TODAY="$(date +%Y-%m-%d)"
if [[ -f "$APPROVAL_FILE" ]] && grep -q "$TODAY" "$APPROVAL_FILE"; then
    exit 0
fi

echo "BLOCKED (Protocol 6 / direct-write-gate): мутация рекламного кабинета Директ требует HITL-апрува Ивана. После явного апрува: echo \"$TODAY approved-by: ivan <контекст>\" > $APPROVAL_FILE (действует до конца дня, файл в .gitignore)." >&2
exit 2
