#!/bin/bash
# ФЕНИКС iter5 (381f11d5). R1b: смоук-гейт деплоя (build-tests.ts + smoke.ts) на странице «Тесты» main 9a3a212 и головы.
# R2: tsc --noEmit, множества ошибок без номеров строк. R3: страница вне блока «План» на main и голове (r_outside5.mts).
# data/ - архив коммита 381f11d5 (= 9a3a212 по data/). Пишет только в scratch.
SC=/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad
SP=$SC/p8
P=$SC/out/iter5
DATA=$SP/data_381f11d5/analytics-mvp/data
for rev in 9a3a212 381f11d5; do
  tree=$SP/tree_$rev
  cd $tree/analytics-mvp || exit 1
  out=$SP/out_$rev; rm -rf $out; mkdir -p $out
  DATA_DIR=$DATA OUT_DIR=$out timeout 500 npx tsx src/scripts/build-tests.ts > $SP/build_$rev.log 2>&1; echo "$rev build exit $?"
  DATA_DIR=$DATA OUT_DIR=$out timeout 300 npx tsx src/scripts/smoke.ts > $SP/smoke_$rev.log 2>&1; echo "$rev smoke exit $? | $(tail -2 $SP/smoke_$rev.log | tr '\n' ' ' | cut -c1-300)"
  timeout 400 npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "error TS" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort -u > $SP/tsc_$rev.txt
  echo "$rev tsc: ошибок $(wc -l < $SP/tsc_$rev.txt), в plan-tab $(grep -c plan-tab $SP/tsc_$rev.txt)"
done
echo "tsc новые на голове: $(comm -13 $SP/tsc_9a3a212.txt $SP/tsc_381f11d5.txt | wc -l), ушли: $(comm -23 $SP/tsc_9a3a212.txt $SP/tsc_381f11d5.txt | wc -l)"
cd $SP/tree_381f11d5/analytics-mvp && npx tsx $P/r_outside5.mts
