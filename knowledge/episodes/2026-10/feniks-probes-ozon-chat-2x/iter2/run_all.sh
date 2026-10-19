#!/bin/bash
# ФЕНИКС iter2, PR #477 @ 3121423. Воспроизведение проб iter2 (фикстуры iter1 из ../ переиспользуются).
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-chat-2x
SP=/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad
cd /home/user/t1/analytics-mvp || exit 1
npx vitest run src/scripts/plan-tab.test.ts src/scripts/funnel-tests.test.ts src/scripts/gap-daily.test.ts   # 98/98
python3 -I $P/iter2/g_fixture.py            # G1b: замороженная выборка = все строки окон c1cff23
npx tsx $P/iter2/r2_regress.mts             # R2 база/голова + P1-P9
python3 -I $P/iter2/b3_check.py             # B3b пересчёт строки «день не закрыт» + ключи инструкции v4 (I1b)
for s in eve contra eve2; do python3 -I $P/c5_fixture.py $s; done
for s in live eve contra eve2; do
  D=$SP/fx_$s; [ $s = live ] && D=data
  mkdir -p $SP/out2_$s; DATA_DIR=$D OUT_DIR=$SP/out2_$s npx tsx src/scripts/build-tests.ts > $SP/build2_$s.log 2>&1; echo "$s exit $?"
done
for s in cab2ok cab2off cab2cov cab2edge1 cab2edge2; do
  python3 -I $P/iter2/cab_fixture.py $s; npx tsx $P/c7_render.mts new $SP/fxc_$s 2026-10-21 | grep -E 'warnings|Сверка'
done
for s in dec27 dec28; do python3 -I $P/c6_fixture_plan.py $s; npx tsx $P/c7_render.mts new $SP/fxp_$s 2026-10-29; done   # Z1
python3 -I $P/c8_fixture_iter3.py wipe3 && npx tsx $P/c7_render.mts new $SP/fx_wipe3 2026-10-18                         # N7
