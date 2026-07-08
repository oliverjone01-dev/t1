#!/usr/bin/env bash
# yd-api-write.sh — Yandex Direct API v5 MUTATING wrapper (Protocol 6 HITL gate)
#
# Выполняет мутирующие методы (add/update/delete/suspend/resume/setBids/...)
# ТОЛЬКО при наличии approval-файла с сегодняшней датой:
#   .claude/approvals/direct-write.ok
# Файл создаётся вручную ПОСЛЕ явного апрува Ивана и действует один день:
#   echo "2026-07-08 approved-by: ivan <контекст>" > .claude/approvals/direct-write.ok
# Файл в .gitignore - апрув не наследуется между сессиями через git.
#
# Каждый вызов логируется в traces/YYYY-MM-DD/direct-writes.jsonl (Protocol 14).
#
# Usage: ./yd-api-write.sh <service> <method> <json_params>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
APPROVAL_FILE="${YD_APPROVAL_FILE:-${REPO_ROOT}/.claude/approvals/direct-write.ok}"
API_BASE="https://api.direct.yandex.com/json/v5"

# --- HITL gate (Protocol 6) ---
TODAY="$(date +%Y-%m-%d)"
if [[ ! -f "$APPROVAL_FILE" ]] || ! grep -q "$TODAY" "$APPROVAL_FILE"; then
    echo "BLOCKED (Protocol 6): нет действующего апрува Ивана на мутации кабинета." >&2
    echo "После явного апрува создайте файл (действует до конца дня):" >&2
    echo "  echo \"$TODAY approved-by: ivan <контекст>\" > $APPROVAL_FILE" >&2
    exit 3
fi

# Resolve OAUTH_TOKEN / CLIENT_LOGIN (env → yandex-direct/.env → ~/.secrets)
source "${SCRIPT_DIR}/yd-creds.sh"

SERVICE="${1:?Usage: yd-api-write.sh <service> <method> <json_params>}"
METHOD="${2:?Usage: yd-api-write.sh <service> <method> <json_params>}"
PARAMS="${3:?json_params обязателен для мутирующего вызова}"

REQUEST_BODY=$(jq -n \
    --arg method "$METHOD" \
    --argjson params "$PARAMS" \
    '{method: $method, params: $params}')

# --- Trace log (Protocol 14) - до вызова, чтобы след оставался даже при падении ---
TRACE_DIR="${REPO_ROOT}/traces/${TODAY}"
mkdir -p "$TRACE_DIR"
jq -nc \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg service "$SERVICE" --arg method "$METHOD" \
    --argjson params "$PARAMS" \
    --arg approval "$(head -1 "$APPROVAL_FILE")" \
    '{ts: $ts, tool: "yd-api-write", service: $service, method: $method, params: $params, approval: $approval}' \
    >> "${TRACE_DIR}/direct-writes.jsonl"

RESPONSE=$(curl -s -X POST \
    "${API_BASE}/${SERVICE}" \
    -H "Authorization: Bearer ${OAUTH_TOKEN}" \
    ${CLIENT_LOGIN:+-H "Client-Login: ${CLIENT_LOGIN}"} \
    -H "Content-Type: application/json; charset=utf-8" \
    -H "Accept-Language: ru" \
    -d "$REQUEST_BODY")

if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo "API ERROR:" >&2
    echo "$RESPONSE" | jq '.error' >&2
    exit 1
fi

echo "$RESPONSE" | jq '.'
