#!/usr/bin/env bash
# Build katya-tests.html (test 4 stop, plan block) for data variants on PR code 30abf83 and main ada2e83.
# Usage: bash runpages_sd.sh <scratch dir> [variants...]. Output only under <scratch dir>/pb/<variant>/out_<rev>.
set -u
S=$1; shift
VARS=${*:-"v0 vZ vU vMass vS90 vS89 vKeep vN50 vN49 vP vPfix vZfix"}
for rev in 30abf83 ada2e83; do
  CD=$S/code_$rev/analytics-mvp
  for v in $VARS; do
    O=$S/pb/$v/out_$rev; mkdir -p "$O"
    ( cd "$CD" && DATA_DIR=$S/pb/$v/data OUT_DIR=$O FIXTURES_DIR=/home/user/t1/analytics-mvp/fixtures \
        npx tsx src/scripts/build-tests.ts > "$S/pb/$v/log_$rev.txt" 2>&1 )
    echo "$rev $v exit=$? size=$(wc -c < "$O/katya-tests.html" 2>/dev/null) warn=$(grep -c WARNING "$S/pb/$v/log_$rev.txt")"
  done
done
