#!/bin/bash
# ФЕНИКС iter2 (3810a26). R1b: smoke-гейт деплоя (build-tests.ts + smoke.ts, jsdom) на странице «Тесты» main (c540277) и головы.
# R2: tsc --noEmit, множества ошибок без номеров строк. R3: страница вне блока «План» на main и голове (r_outside.mts).
# data/ - закреплённая копия коммита 4f2409c (= 3810a26 по data/). Пишет только в scratch.
SP=/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p5
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status
DATA=$SP/data_4f2409c/analytics-mvp/data
for rev in c540277 3810a26; do
  cd $SP/tree_$rev/analytics-mvp || exit 1
  out=$SP/out_$rev; rm -rf $out; mkdir -p $out
  DATA_DIR=$DATA OUT_DIR=$out timeout 500 npx tsx src/scripts/build-tests.ts > $SP/build_$rev.log 2>&1; echo "$rev build exit $?"
  DATA_DIR=$DATA OUT_DIR=$out timeout 300 npx tsx src/scripts/smoke.ts > $SP/smoke_$rev.log 2>&1; echo "$rev smoke exit $? | $(tail -2 $SP/smoke_$rev.log | tr '\n' ' ' | cut -c1-300)"
  timeout 400 npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "error TS" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort -u > $SP/tsc_$rev.txt
  echo "$rev tsc: ошибок $(wc -l < $SP/tsc_$rev.txt), в plan-tab $(grep -c plan-tab $SP/tsc_$rev.txt)"
done
echo "tsc новые на голове: $(comm -13 $SP/tsc_c540277.txt $SP/tsc_3810a26.txt | wc -l), ушли: $(comm -23 $SP/tsc_c540277.txt $SP/tsc_3810a26.txt | wc -l)"
cd $SP/tree_3810a26/analytics-mvp && npx tsx $P/r_outside.mts
