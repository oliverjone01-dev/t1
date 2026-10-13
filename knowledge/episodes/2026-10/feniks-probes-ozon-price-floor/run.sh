#!/usr/bin/env bash
# Пробы ФЕНИКСА к ozon-price-floor @ e4988f5 (аудит 12.10, файлы модели не менялись до 18f699c). Только чтение data/ и
# public/katya-report.html; промежуточные файлы - в /tmp/feniks-floor. Запуск из любого каталога: bash run.sh
set -euo pipefail
H=$(cd "$(dirname "$0")" && pwd); mkdir -p /tmp/feniks-floor
echo "== p0: воспроизводимость floor.py @ HEAD"
git -C /home/user/t1 show HEAD:knowledge/episodes/2026-10/ozon-price-floor/floor.py \
  | sed "s#/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json#/tmp/feniks-floor/rows_head.json#" > /tmp/feniks-floor/floor_head.py
python3 -I /tmp/feniks-floor/floor_head.py > /tmp/feniks-floor/out_head.txt
diff /tmp/feniks-floor/out_head.txt /home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_out.txt && echo "floor_out.txt воспроизведён до байта"
cmp <(python3 -c "import json;print(json.dumps(json.load(open('/tmp/feniks-floor/rows_head.json')),sort_keys=True))") \
    <(python3 -c "import json;print(json.dumps(json.load(open('/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json')),sort_keys=True))") && echo "floor_rows.json совпадает"
for p in p1_data p2_trend p3_prices p10_keys p11_promo_comm p16_exit p18_ads; do echo "== $p"; python3 -I "$H/$p.py"; done
echo "== p7 «Отчет» из katya-report.html"; node "$H/p7_report.js"; node "$H/p7b_periods.js"; node "$H/p19_clip.js"
for p in p8_bridge p8b_periods p9_variants p12_need p13b p15_full p17_v5 p20_patch_check p21_table_patched p22_strategy_numbers; do echo "== $p"; python3 -I "$H/$p.py"; done
