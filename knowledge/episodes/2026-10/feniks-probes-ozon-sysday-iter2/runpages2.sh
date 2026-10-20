#!/usr/bin/env bash
# Build katya-tests.html (notice, test-4 stop, plan chips) for data variants on head 10049c0 and main 12808f9.
# Usage: bash runpages2.sh <scratch dir> <revs, comma-separated> [variants...]
# Output only under <scratch dir>/pb/<variant>/out_<rev> and log_<rev>.txt. Code copies from mkcode2.sh.
set -u
S=$1; REVS=$2; shift 2
VARS=${*:-"v0 vZ19 vZ20 vMass vS90 vS89 vW15 vW14 vN50 vN49 vKeep vP vPfix vZfix vReal2b vReal3 vSysWarn vOld vWarnOld"}
for rev in ${REVS//,/ }; do
  CD=$S/code_$rev/analytics-mvp
  for v in $VARS; do
    O=$S/pb/$v/out_$rev; mkdir -p "$O"
    ( cd "$CD" && DATA_DIR=$S/pb/$v/data OUT_DIR=$O FIXTURES_DIR=$CD/fixtures \
        npx tsx src/scripts/build-tests.ts > "$S/pb/$v/log_$rev.txt" 2>&1 )
    echo "$rev $v exit=$? size=$(wc -c < "$O/katya-tests.html" 2>/dev/null) warn=$(grep -c WARNING "$S/pb/$v/log_$rev.txt")"
  done
done
