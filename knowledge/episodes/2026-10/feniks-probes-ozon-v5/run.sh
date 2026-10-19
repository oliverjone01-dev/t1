#!/usr/bin/env bash
# Пробы ФЕНИКСА к OZON v5 @ 1455233 (аудит 13.10, отчёт feniks-audit-ozon-v5-v1-vs-v2-20261013.json).
# Предусловие: конвейер автора прогнан (cd /tmp; python3 -I .../v5/list26.py <xlsx>; python3 -I .../v5/forecast.py;
# python3 -I .../v5/doc_data.py <xlsx>) - выходы в /tmp/ozon-v5, модель P20 в /tmp/feniks-floor.
# Только чтение analytics-mvp/data и public/katya-report.html; промежуточные файлы - /tmp/feniks-floor, /tmp/feniks-ozon-v5.
# Запуск из любого каталога: bash run.sh
set -euo pipefail
H=$(cd "$(dirname "$0")" && pwd)
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-price-floor
mkdir -p /tmp/feniks-ozon-v5
cd /tmp
echo "== «Отчет» по периодам (p7, p7b из проб 12.10)"; node "$P/p7_report.js" | tail -1; node "$P/p7b_periods.js"
for p in p1_test4_cards p3_model p4_elastic_split p5_surfaces p6_bridge_patched p6b_periods p7_confound p8_dedup; do
  echo "== $p"; python3 -B -I "$H/$p.py" 2>&1 | grep -v Warning
done
