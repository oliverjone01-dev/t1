#!/usr/bin/env bash
# Build katya-tests.html for each data variant with HEAD code and iter2 (7ab055d) code. Output only to scratch.
set -u
S=/tmp/claude-0/-home-user-t1/feadf20c-8819-5ff1-a553-d442fce0f391/scratchpad
for code in head iter2; do
  if [ "$code" = head ]; then CD=/home/user/t1/analytics-mvp; else CD=$S/iter2code/analytics-mvp; fi
  for v in v0 vZ vN; do
    mkdir -p $S/pb/$v/out_$code
    ( cd $CD && DATA_DIR=$S/pb/$v/data OUT_DIR=$S/pb/$v/out_$code FIXTURES_DIR=/home/user/t1/analytics-mvp/fixtures \
        npx tsx src/scripts/build-tests.ts > $S/pb/$v/log_$code.txt 2>&1 ); echo "$code $v exit=$? size=$(wc -c < $S/pb/$v/out_$code/katya-tests.html 2>/dev/null)"
  done
done
