#!/usr/bin/env bash
# Build katya-tests.html (notice, test-4 stop, plan chips, build log) for data variants.
# Usage: bash pages_gm.sh <scratch dir> <revs, comma-separated> [variants...]
# Output only under <scratch dir>/pb/<variant>/out_<rev> and log_<rev>.txt. Code copies from mkcode_gm.sh.
set -u
S=$1; REVS=$2; shift 2
VARS=${*:-"v0 vZ20 vZ20m"}
for rev in ${REVS//,/ }; do
  CD=$S/code_$rev/analytics-mvp
  for v in $VARS; do
    O=$S/pb/$v/out_$rev; mkdir -p "$O"
    ( cd "$CD" && DATA_DIR=$S/pb/$v/data OUT_DIR=$O FIXTURES_DIR=$CD/fixtures \
        npx tsx src/scripts/build-tests.ts > "$S/pb/$v/log_$rev.txt" 2>&1 )
    echo "$rev $v exit=$? size=$(wc -c < "$O/katya-tests.html" 2>/dev/null) warn=$(grep -c WARNING "$S/pb/$v/log_$rev.txt") manual=$(grep -c 'ручных снятий' "$S/pb/$v/log_$rev.txt")"
  done
done
