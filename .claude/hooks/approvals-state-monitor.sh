#!/usr/bin/env bash
# approvals-state-monitor.sh - детективный контроль (Stop hook, non-blocking).
# На каждой остановке агента диффит защищённые каталоги (approvals, state)
# против git и алертит при любом дрейфе, возникшем внутри сессии.
# Ответ на script-indirection риск (ФЕНИКС, итерация 3, non-blocking ТЗ #2):
# превентивный guard обходим записью скрипта, детекция - нет.

set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"

ALERTS=""

# 1. Незакоммиченные изменения/новые файлы в защищённых зонах
DRIFT="$(git status --porcelain -- .claude/state/ 2>/dev/null || true)"
if [[ -n "$DRIFT" ]]; then
    ALERTS="${ALERTS}[ALERT] Дрейф в state-каталоге против git:\n${DRIFT}\n"
fi

# 2. Approval-файлы (gitignored, git их не видит) - фиксируем сам факт существования
if compgen -G ".claude/approvals/*" > /dev/null 2>&1; then
    FILES="$(ls -la .claude/approvals/ | tail -n +2)"
    ALERTS="${ALERTS}[INFO] Существуют approval-файлы (проверь, что созданы человеком):\n${FILES}\n"
fi

if [[ -n "$ALERTS" ]]; then
    TRACE_DIR="traces/$(date +%Y-%m-%d)"
    mkdir -p "$TRACE_DIR"
    printf '{"ts":"%s","tool":"approvals-state-monitor","alert":%s}\n' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        "$(printf '%b' "$ALERTS" | jq -Rs .)" >> "${TRACE_DIR}/governance-alerts.jsonl"
    printf '%b' "APPROVALS-STATE MONITOR:\n${ALERTS}Проверь traces/governance-alerts.jsonl. Если изменение не делал человек - это инцидент Protocol 6.\n" >&2
fi

exit 0
