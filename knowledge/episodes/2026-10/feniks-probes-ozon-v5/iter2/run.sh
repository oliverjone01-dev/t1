#!/usr/bin/env bash
# Пробы ФЕНИКСА к OZON v5 @ 6a8dd1c (итерация 2, отчёт feniks-audit-ozon-v5-v1-vs-v2-iter2-20261013.json).
# Предусловие: конвейер автора прогнан (list26.py <xlsx>, forecast.py, pilot.py, doc_data.py <xlsx>) - выходы в /tmp/ozon-v5,
# модель пола цены в /tmp/ozon-floor. Только чтение. Запуск из любого каталога: bash run.sh
set -euo pipefail
H=$(cd "$(dirname "$0")" && pwd)
cd /tmp
for p in q2_click_by_campaign q5_iter2 q6_runrate; do echo "== $p"; python3 -B -I "$H/$p.py"; done
