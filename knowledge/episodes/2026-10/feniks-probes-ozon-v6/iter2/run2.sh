#!/usr/bin/env bash
# ФЕНИКС 14.10, итерация 2 (76d8244). bash run2.sh [доставленная xlsx]
# Рендер страницы «Отчет» снимка ветки за март-октябрь, независимая реплика модели, проба U1, пересборка и сравнение.
set -euo pipefail
H=$(cd "$(dirname "$0")" && pwd); R=/home/user/t1; W=/tmp/feniks-v6
mkdir -p "$W/branch"
git -C "$R" show 76d8244:analytics-mvp/public/katya-report.html > "$W/branch/katya-report.html"
node "$H/../page_text.js" "$W/branch/katya-report.html" "$W/branch" 2026-03 2026-04 2026-05 2026-06 2026-07 2026-08 2026-09 2026-10
FV6="$W/branch/" python3 -I -B "$H/replica2.py"
python3 -I -B "$H/p_units.py"
if [ "${1:-}" != "" ]; then
  python3 -I -B "$H/../p_text.py" "$1" | head -12
  python3 -I -B "$H/rebuild2.py" "$W/branch" "$1" /root/.claude/skills/synced/7cb27221-5718-4fc3-bc16-76561189fcae_0fffcc3c-f3a6-44d7-8da9-74f689d08934/xlsx/scripts/recalc.py
fi
