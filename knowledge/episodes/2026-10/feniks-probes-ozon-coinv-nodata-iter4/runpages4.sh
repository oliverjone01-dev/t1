#!/usr/bin/env bash
# Build katya-tests.html (stop of test 4, plan block, bid summary) for every data variant on two code versions.
# Usage: bash runpages4.sh <scratch dir>. Output only under <scratch dir>/pb/<variant>/out_<rev>.
set -u
S=$1
for rev in 0bb36b5 b0096cf; do
  CD=$S/code_$rev/analytics-mvp
  for v in v0 vZ vN vE vU vM; do
    O=$S/pb/$v/out_$rev; mkdir -p "$O"
    ( cd "$CD" && DATA_DIR=$S/pb/$v/data OUT_DIR=$O FIXTURES_DIR=/home/user/t1/analytics-mvp/fixtures \
        npx tsx src/scripts/build-tests.ts > "$S/pb/$v/log_$rev.txt" 2>&1 )
    echo "$rev $v exit=$? size=$(wc -c < "$O/katya-tests.html" 2>/dev/null)"
  done
done
