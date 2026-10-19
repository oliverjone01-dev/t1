#!/bin/bash
# ФЕНИКС iter4. Проба R2: tsc --noEmit на main (5c4f053) и голове (da0a36b). В iter3 было N/A (нет @types/node);
# в scratch зависимости поставлены npm ci --ignore-scripts. Сравниваю множества ошибок без номеров строк.
SP=/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad
for rev in 5c4f053 da0a36b; do
  cd $SP/tree_$rev/analytics-mvp || exit 1
  timeout 300 npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "error TS" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort -u > $SP/tsc_$rev.txt
  echo "$rev: ошибок tsc $(wc -l < $SP/tsc_$rev.txt), из них в plan-tab $(grep -c plan-tab $SP/tsc_$rev.txt)"
done
echo "новые на голове:"; comm -13 $SP/tsc_5c4f053.txt $SP/tsc_da0a36b.txt | head -10
echo "ушли на голове:"; comm -23 $SP/tsc_5c4f053.txt $SP/tsc_da0a36b.txt | head -10
