#!/usr/bin/env bash
# traces-flush.sh - переносит буфер трейсов P14 (traces/.pending/<дата>/agents.jsonl, пишет
# subagent-trace.sh) в traces/<дата>/agents.jsonl. Запускать в конце задачи и при переезде (pereezd),
# потом один коммит «traces: P14 [skip ci]». Буфер в .gitignore; если контейнер закрыт без сброса,
# строки буфера теряются.
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"
shopt -s nullglob
n=0
for f in traces/.pending/*/agents.jsonl; do
  day="$(basename "$(dirname "$f")")"
  mkdir -p "traces/$day"
  cat "$f" >> "traces/$day/agents.jsonl"
  n=$((n + $(wc -l < "$f")))
  rm -f "$f"
  rmdir "traces/.pending/$day" 2>/dev/null || true
done
echo "traces-flush: перенесено строк ${n}"
