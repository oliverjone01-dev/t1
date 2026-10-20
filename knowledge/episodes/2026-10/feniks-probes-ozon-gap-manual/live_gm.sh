#!/usr/bin/env bash
# Live tests of gap-daily.test.ts (they read ./data/gap_daily.ndjson and ./data/gap_manual.ndjson) against variants.
# Usage: bash live_gm.sh <scratch dir> <rev> [variants...]. Code copy <scratch>/lt_<rev> from mkcode_gm.sh.
# The data symlink of the copy is re-pointed per variant; output <scratch>/lt_<rev>_<variant>.txt.
set -u
S=$1; REV=$2; shift 2
VARS=${*:-"v0 v0x vZ20 vZ20m vMiss vBad vNZ vDup vZsib vZsib19 vZsibL vZsib5 vZsibm vW15 vMass vAll3 vKeep5"}
CD=$S/lt_$REV/analytics-mvp
for v in $VARS; do
  python3 -I -c 'import os,sys; p=sys.argv[1]; os.path.lexists(p) and os.remove(p); os.symlink(sys.argv[2], p)' "$CD/data" "$S/pb/$v/data"
  ( cd "$CD" && npx vitest run src/scripts/gap-daily.test.ts > "$S/lt_${REV}_$v.txt" 2>&1 )
  rc=$?
  echo "== $REV $v exit=$rc $(grep -E '^ +Tests ' "$S/lt_${REV}_$v.txt" | tr -s ' ')"
  grep -E '^ +(×|✗|FAIL)|AssertionError|^ +- Expected|^ +\+ Received|^ +[-+] +"' "$S/lt_${REV}_$v.txt" | head -8
done
