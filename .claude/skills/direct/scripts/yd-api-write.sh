#!/usr/bin/env bash
# yd-api-write.sh — Yandex Direct API v5 MUTATING wrapper (Protocol 6 HITL gate)
#
# Выполняет мутирующие методы (add/update/delete/suspend/resume/setBids/...)
# ТОЛЬКО при наличии approval-файла с сегодняшней датой И whitelist'ом методов:
#   .claude/approvals/direct-write.ok
# Формат (одна строка, создаётся ЧЕЛОВЕКОМ вне Claude Code после апрува Ивана):
#   2026-07-08 approved-by: ivan methods: add,update <контекст>
# Wildcard в methods не поддерживается - каждый метод перечисляется явно.
# Файл в .gitignore (не наследуется через git) и защищён хуком approvals-guard.sh
# (инструменты агента не могут его создать/изменить - ответ на ATTACK A/B ФЕНИКСА).
# Путь захардкожен: env-override был бы вектором подделки (YD_APPROVAL_FILE=/tmp/fake).
#
# Пока существует .claude/state/p0-attribution.open - мутации заблокированы
# независимо от апрува (Hard Rule #2 агента timur, enforced в коде).
#
# Каждый вызов логируется в traces/YYYY-MM-DD/direct-writes.jsonl (Protocol 14).
#
# Usage: ./yd-api-write.sh <service> <method> <json_params>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
APPROVAL_FILE="${REPO_ROOT}/.claude/approvals/direct-write.ok"
P0_FLAG="${REPO_ROOT}/.claude/state/p0-attribution.open"
API_BASE="https://api.direct.yandex.com/json/v5"

SERVICE="${1:?Usage: yd-api-write.sh <service> <method> <json_params>}"
METHOD="${2:?Usage: yd-api-write.sh <service> <method> <json_params>}"
PARAMS="${3:?json_params обязателен для мутирующего вызова}"

# --- P0 gate: при открытом разрыве атрибуции мутации запрещены даже с апрувом ---
if [[ -f "$P0_FLAG" ]]; then
    echo "BLOCKED (Hard Rule #2): открыта P0 атрибуции - мутации кабинета запрещены даже с апрувом." >&2
    echo "Детали: $P0_FLAG. Закрытие P0 - решение Ивана, файл удаляет человек вне Claude Code." >&2
    exit 3
fi

# --- HITL gate (Protocol 6): дата + явный whitelist методов ---
TODAY="$(date +%Y-%m-%d)"
if [[ ! -f "$APPROVAL_FILE" ]] || ! grep -q "$TODAY" "$APPROVAL_FILE"; then
    echo "BLOCKED (Protocol 6): нет действующего апрува Ивана на мутации кабинета." >&2
    echo "После явного апрува человек (вне Claude Code) создаёт файл, действующий до конца дня:" >&2
    echo "  echo \"$TODAY approved-by: ivan methods: <method1,method2> <контекст>\" > $APPROVAL_FILE" >&2
    exit 3
fi
APPROVED_METHODS="$(grep "$TODAY" "$APPROVAL_FILE" | sed -n 's/.*methods:[[:space:]]*\([a-zA-Z,]*\).*/\1/p' | head -1)"
if [[ -z "$APPROVED_METHODS" ]] || ! printf '%s' ",$APPROVED_METHODS," | grep -qi ",$METHOD,"; then
    echo "BLOCKED (Protocol 6): метод '$METHOD' не входит в whitelist апрува (methods: ${APPROVED_METHODS:-не указан})." >&2
    echo "Каждый метод перечисляется в approval-файле явно, wildcard не поддерживается." >&2
    exit 3
fi

# --- Amount-cap (CLAUDE.md §9): мутация с деньгами >100K ₽ требует отдельного апрува ---
# Денежные поля API Директа заданы в микрорублях (x1e6): Amount, Bid, StrategyMaximumClickBid,
# AverageCpc/AverageCpa/AverageCrr, WeeklySpendLimit, BudgetLimit и т.п.
MAX_MICROS="$(printf '%s' "$PARAMS" | jq '[.. | objects | to_entries[]
    | select(.key | test("Amount|Bid|AverageCp[ac]|AverageCrr|SpendLimit|BudgetLimit"; "i"))
    | .value | numbers] | max // 0')"
MAX_RUB="$(printf '%s' "$MAX_MICROS" | jq '. / 1000000')"
AMOUNT_CAP_RUB=100000
if [[ "$(printf '%s' "$MAX_RUB" | jq "if . > $AMOUNT_CAP_RUB then 1 else 0 end")" == "1" ]]; then
    if ! grep "$TODAY" "$APPROVAL_FILE" | grep -qi "large-ok:[[:space:]]*.*$METHOD"; then
        echo "BLOCKED (Protocol 6 / §9): в params сумма ~${MAX_RUB} ₽ (>${AMOUNT_CAP_RUB}) - нужен отдельный апрув." >&2
        echo "Иван добавляет в approval-файл строку: \"$TODAY large-ok: $METHOD <сумма> <контекст>\"." >&2
        exit 3
    fi
fi

# Resolve OAUTH_TOKEN / CLIENT_LOGIN (env → yandex-direct/.env → ~/.secrets)
source "${SCRIPT_DIR}/yd-creds.sh"

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
    --argjson max_rub "$MAX_RUB" \
    --arg approval "$(head -1 "$APPROVAL_FILE")" \
    '{ts: $ts, tool: "yd-api-write", service: $service, method: $method, max_amount_rub: $max_rub, params: $params, approval: $approval}' \
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
