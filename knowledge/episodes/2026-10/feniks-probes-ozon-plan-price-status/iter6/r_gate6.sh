#!/bin/bash
# ФЕНИКС iter6 (db5ede19). R1b: build-tests.ts + smoke.ts на main 9a3a212 и голове db5ede19 в один день; R2: tsc против main
# (tsc_9a3a212.txt из iter5, код main тот же); R3: страница вне блока «План» (r_outside6.mts); U3: рендер всех фикстур iter5 в jsdom.
SC=/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad
SP=$SC/p9
DATA=$SC/p8/data_381f11d5/analytics-mvp/data
for pair in 9a3a212:$SC/p8/tree_9a3a212 db5ede19:$SP/tree_db5ede19; do
  rev=${pair%%:*}; tree=${pair#*:}
  cd $tree/analytics-mvp || exit 1
  out=$SP/out_$rev; rm -rf $out; mkdir -p $out
  DATA_DIR=$DATA OUT_DIR=$out timeout 500 npx tsx src/scripts/build-tests.ts > $SP/build_$rev.log 2>&1; echo "$rev build exit $?"
  DATA_DIR=$DATA OUT_DIR=$out timeout 300 npx tsx src/scripts/smoke.ts > $SP/smoke_$rev.log 2>&1; echo "$rev smoke exit $? | $(tail -2 $SP/smoke_$rev.log | tr '\n' ' ' | cut -c1-200)"
done
T=$SP/tree_db5ede19/analytics-mvp
cd $T || exit 1
timeout 400 npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "error TS" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort -u > $SP/tsc.txt
echo "tsc: ошибок $(wc -l < $SP/tsc.txt), в plan-tab $(grep -c plan-tab $SP/tsc.txt); новые против main: $(comm -13 $SC/p8/tsc_9a3a212.txt $SP/tsc.txt | wc -l)"
npx tsx $SC/out/iter6/r_outside6.mts
for k in g1 b4 w5 early; do timeout 900 npx tsx $SC/out/iter5/render9.mts $T $SP/r9_$k.jsonl $(cat $SC/p8/pairs_$k.txt) > $SP/r9_$k.log 2>&1; echo "render $k exit $?"; done
