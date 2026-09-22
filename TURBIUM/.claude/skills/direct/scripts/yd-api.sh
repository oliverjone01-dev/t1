#!/usr/bin/env bash
# yd-api.sh — Generic Yandex Direct API v5 wrapper
# Usage: ./yd-api.sh <service> <method> [json_params]
# Example: ./yd-api.sh campaigns get '{"SelectionCriteria":{},"FieldNames":["Id","Name","Status"]}'

set -euo pipefail

API_BASE="https://api.direct.yandex.com/json/v5"

# Resolve OAUTH_TOKEN / CLIENT_LOGIN (env → yandex-direct/.env → ~/.secrets)
source "$(dirname "${BASH_SOURCE[0]}")/yd-creds.sh"

SERVICE="${1:?Usage: yd-api.sh <service> <method> [json_params]}"
METHOD="${2:?Usage: yd-api.sh <service> <method> [json_params]}"

# Protocol 6 (Trust by Design): этот wrapper - READ-ONLY.
# Любая мутация кабинета (add/update/delete/suspend/resume/setBids/...) идёт
# только через yd-api-write.sh, который требует HITL-апрув Ивана (approval-файл).
if [[ "$METHOD" != "get" ]]; then
    echo "BLOCKED: yd-api.sh - read-only wrapper, метод '$METHOD' запрещён." >&2
    echo "Мутации кабинета - через yd-api-write.sh после HITL-апрува Ивана (Protocol 6)." >&2
    exit 3
fi
# Note: do NOT write ${3:-{}} — bash closes the expansion on the first "}",
# leaving a stray "}" appended to $3 and breaking jq --argjson.
PARAMS="${3:-}"
[[ -z "$PARAMS" ]] && PARAMS='{}'

# Build request body
REQUEST_BODY=$(jq -n \
    --arg method "$METHOD" \
    --argjson params "$PARAMS" \
    '{method: $method, params: $params}')

# Make API call
RESPONSE=$(curl -s -X POST \
    "${API_BASE}/${SERVICE}" \
    -H "Authorization: Bearer ${OAUTH_TOKEN}" \
    ${CLIENT_LOGIN:+-H "Client-Login: ${CLIENT_LOGIN}"} \
    -H "Content-Type: application/json; charset=utf-8" \
    -H "Accept-Language: ru" \
    -d "$REQUEST_BODY")

# Check for errors
if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo "API ERROR:" >&2
    echo "$RESPONSE" | jq '.error' >&2
    exit 1
fi

echo "$RESPONSE" | jq '.'
