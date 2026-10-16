#!/bin/bash
# iter3: рендер всех фикстур на двух реализациях (new = d27ad7b рабочее дерево, base = 57f05d8 из git show)
SP=/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/it3
cd /home/user/t1/analytics-mvp || exit 1
for pair in day1:2026-10-16 mid2:2026-10-18 nov:2026-11-03 msk_t:2026-10-21 msk_not:2026-10-21 wipe:2026-10-18 mid3:2026-10-18 wipep:2026-10-18 wipe3:2026-10-18 msk_r:2026-10-21 msk_r_not:2026-10-21; do
  sc=${pair%%:*}; td=${pair##*:}
  for impl in new base; do
    timeout 200 npx tsx $SP/p3_render.mts fx $impl $SP/fx_$sc $td > $SP/r_${impl}_${sc}.txt 2>&1
    echo "$impl $sc exit $?"
  done
done
