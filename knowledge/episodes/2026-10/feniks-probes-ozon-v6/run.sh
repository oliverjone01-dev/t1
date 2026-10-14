#!/usr/bin/env bash
# ФЕНИКС 14.10, аудит OZON v6. Воспроизведение проб: bash run.sh [доставленная xlsx]
# 1) снимок страницы «Отчет» из коммита ветки 39a3e3e и из origin/main рендерится в /tmp/feniks-v6/{branch,main};
# 2) probes_v6.py - реплика модели и пробы; 3) с путём xlsx: p_text.py (тексты книги) и rebuild.py (пересборка и сравнение).
set -euo pipefail
H=$(cd "$(dirname "$0")" && pwd); R=/home/user/t1; W=/tmp/feniks-v6
mkdir -p "$W/branch" "$W/main"
git -C "$R" show 39a3e3e:analytics-mvp/public/katya-report.html > "$W/branch/katya-report.html"
git -C "$R" show origin/main:analytics-mvp/public/katya-report.html > "$W/main/katya-report.html"
node "$H/page_text.js" "$W/branch/katya-report.html" "$W/branch" 2026-06 2026-07 2026-08 2026-09 2026-10
node "$H/page_text.js" "$W/main/katya-report.html" "$W/main" 2026-09 2026-10
echo "== B6: сентябрь в снимке 12.10 (main) против 11.10 (ветка), строки блока 3:"
diff <(grep -A17 '^Статья.март 2026' "$W/branch/rp_2026-09.txt") <(grep -A17 '^Статья.март 2026' "$W/main/rp_2026-09.txt") && echo "блок 3 сентября совпадает"
FV6="$W/branch/" python3 -I -B "$H/probes_v6.py"
if [ "${1:-}" != "" ]; then
  python3 -I -B "$H/p_text.py" "$1"
  python3 -I -B "$H/rebuild.py" "$W/branch" "$1" /root/.claude/skills/synced/7cb27221-5718-4fc3-bc16-76561189fcae_0fffcc3c-f3a6-44d7-8da9-74f689d08934/xlsx/scripts/recalc.py
fi
