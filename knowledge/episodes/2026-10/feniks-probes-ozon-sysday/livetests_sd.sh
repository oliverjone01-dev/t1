#!/usr/bin/env bash
# L3: gap-daily.test.ts of PR code 30abf83 (live-file tests read ./data/gap_daily.ndjson) against data variants.
# Question: which legitimate future states turn vitest red on main (the mac pushes data/ to main, CI runs vitest)?
# Usage: bash livetests_sd.sh <scratch dir> [rev] [variants...]. Separate code copy <scratch>/lt_<rev>; writes only there.
set -u
S=$1; REV=${2:-30abf83}; shift 2 2>/dev/null || shift 1
VARS=${*:-"v0 vZ vU vW vMass vS90 vS89 vN50 vPfix vZfix"}
CD=$S/lt_$REV/analytics-mvp
if [ ! -d "$CD/src" ]; then
  mkdir -p "$S/lt_$REV"
  git -C /home/user/t1 archive "$REV" analytics-mvp | tar -x -C "$S/lt_$REV" --exclude='analytics-mvp/data' --exclude='analytics-mvp/data/*'
  rm -rf "$CD/data"
  python3 -I -c 'import os,sys; os.symlink("/home/user/t1/analytics-mvp/node_modules", sys.argv[1])' "$CD/node_modules"
fi
for v in $VARS; do
  python3 -I -c 'import os,sys; p=sys.argv[1]; os.path.lexists(p) and os.remove(p); os.symlink(sys.argv[2], p)' "$CD/data" "$S/pb/$v/data"
  ( cd "$CD" && npx vitest run src/scripts/gap-daily.test.ts > "$S/lt_${REV}_$v.txt" 2>&1 )
  rc=$?
  echo "== $REV $v exit=$rc $(grep -E '^ +Tests ' "$S/lt_${REV}_$v.txt" | tr -s ' ')"
  grep -E '^ +(×|✗|FAIL)|AssertionError|^ +- Expected|^ +\+ Received|^ +[-+] +"' "$S/lt_${REV}_$v.txt" | head -14
done
