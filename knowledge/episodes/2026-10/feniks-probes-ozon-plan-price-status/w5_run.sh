#!/bin/bash
# ФЕНИКС iter2 (3810a26). W5 / W3: сценарии w5_fixture.py на живом коде головы.
#   below1 @ 29.10: в окне у каждой карточки порог - 1 -> по правилу 29.10 откат 10 из 10. Что говорит «Карточки на пути»?
#   exact  @ 29.10: ровно порог -> прошли 10 из 10.
#   nov    @ 04.11: окно = порог, 29.10-03.11 темп порог/14 -> ноябрь 01-03.11, план порог/14 у всех 10.
SP=/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p5
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status
cd $SP/tree_3810a26/analytics-mvp || exit 1
for s in below1:2026-10-29 exact:2026-10-29 nov:2026-11-04; do
  n=${s%%:*}; d=${s#*:}; echo "=== $n @ $d"
  npx tsx $P/render6.mts $SP/tree_3810a26/analytics-mvp $SP/fx_$n $d $SP/g_$n.json 2>&1 | grep -v -E "плашки цены|ads_month" | cut -c1-700
done
