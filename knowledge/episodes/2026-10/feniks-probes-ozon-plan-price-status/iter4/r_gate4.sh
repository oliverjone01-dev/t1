#!/bin/bash
# ФЕНИКС iter4 (ba5b560). R1b: smoke-гейт деплоя (build-tests.ts + smoke.ts) на странице «Тесты» main (b55e514 = 3810a26 по analytics-mvp)
# и головы. R2: tsc --noEmit, множества ошибок без номеров строк. R3: страница вне блока «План» на main и голове (r_outside3.mts).
# data/ - закреплённая копия коммита 4f2409c (= ba5b560 по data/). Пишет только в scratch.
SC=/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad
SP=$SC/p7
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status/iter4
DATA=$SC/p5/data_4f2409c/analytics-mvp/data
for pair in main:$SC/p5/tree_3810a26 ba5b560:$SP/tree_ba5b560; do
  rev=${pair%%:*}; tree=${pair#*:}
  cd $tree/analytics-mvp || exit 1
  out=$SP/out_$rev; rm -rf $out; mkdir -p $out
  DATA_DIR=$DATA OUT_DIR=$out timeout 500 npx tsx src/scripts/build-tests.ts > $SP/build_$rev.log 2>&1; echo "$rev build exit $?"
  DATA_DIR=$DATA OUT_DIR=$out timeout 300 npx tsx src/scripts/smoke.ts > $SP/smoke_$rev.log 2>&1; echo "$rev smoke exit $? | $(tail -2 $SP/smoke_$rev.log | tr '\n' ' ' | cut -c1-300)"
  timeout 400 npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "error TS" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort -u > $SP/tsc_$rev.txt
  echo "$rev tsc: ошибок $(wc -l < $SP/tsc_$rev.txt), в plan-tab $(grep -c plan-tab $SP/tsc_$rev.txt)"
done
echo "tsc новые на голове: $(comm -13 $SP/tsc_main.txt $SP/tsc_ba5b560.txt | wc -l), ушли: $(comm -23 $SP/tsc_main.txt $SP/tsc_ba5b560.txt | wc -l)"
cd $SP/tree_ba5b560/analytics-mvp && npx tsx $P/r_outside4.mts
