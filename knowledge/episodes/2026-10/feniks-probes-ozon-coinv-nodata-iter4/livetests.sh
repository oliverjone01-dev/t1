#!/usr/bin/env bash
# L3: the live-file tests of gap-daily.test.ts (HEAD code 0bb36b5) against data variants.
# Question: do legitimate future states under Ivan's 19.10 rule turn CI red?
#   v0 - data as is (control), vZ - honest zero at mature cards (rule: stays 0), vU - new-card zeros as the mac writes
#   them, without the no_site label (rule: «нет данных» at read).
# Usage: bash livetests.sh <scratch dir>. Writes only under <scratch dir> (a «data» symlink inside the code copy).
set -u
S=$1
CD=$S/code_0bb36b5/analytics-mvp
for v in v0 vZ vU; do
  python3 -I -c 'import os,sys; p=sys.argv[1]; os.path.lexists(p) and os.remove(p); os.symlink(sys.argv[2], p)' "$CD/data" "$S/pb/$v/data"
  ( cd "$CD" && npx vitest run src/scripts/gap-daily.test.ts -t "живой файл" > "$S/lt_$v.txt" 2>&1 )
  echo "== $v exit=$?"
  grep -E "✓|×|FAIL|AssertionError|Tests  |expected|\+ |\- " "$S/lt_$v.txt" | grep -v "^ *$" | head -30
done
