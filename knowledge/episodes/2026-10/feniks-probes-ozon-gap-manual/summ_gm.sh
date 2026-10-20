#!/usr/bin/env bash
# Collect probe outputs of the audit of PR #489 into the probes dir (out_*.txt). Reads scratch, writes only <out dir>.
# Usage: bash summ_gm.sh <scratch dir> <out dir>
set -u
S=$1; O=$2; P=$(dirname "$0")
{
  for v in "$S"/pb/*/; do
    v=$(basename "$v"); d=$S/pb/$v/data
    m="absent"; [ -L "$d/gap_manual.ndjson" ] && m="repo file (empty)"; [ -f "$d/gap_manual.ndjson" ] && [ ! -L "$d/gap_manual.ndjson" ] && m="$(grep -c . "$d/gap_manual.ndjson") lines"
    echo "$v gap_daily rows $(grep -c . "$d/gap_daily.ndjson") manual: $m"
  done
} > "$O/out_variants.txt"
for rev in e0aab10a 81764e4; do
  {
    for f in "$S"/lt_${rev}_*.txt; do
      v=${f##*/lt_${rev}_}; v=${v%.txt}
      echo "== $rev $v $(grep -E '^ +Tests ' "$f" | tr -s ' ')"
      grep -E 'AssertionError' "$f" | head -3
      grep -E '^ +× ' "$f" | head -3 | cut -c1-200
    done
  } > "$O/out_live_$rev.txt"
done
python3 -I "$P/anpages_gm.py" "$S" e0aab10a v0 v0x vZ20 vZ20m vZ20m1 vZ19 vZ19m vMiss vBad vNZ vDup vSys13 vSys12 vSysOld vAll3 vAll3old vFut vKeep5 vMass \
  v0:vZ20m vZ20:vZ20m1 vZ20:vMiss v0:vNZ v0:v0x v0:v0@81764e4 vZ20:vZ20@81764e4 > "$O/out_pages_e0aab10a.txt" 2>&1
python3 -I "$P/anpages_gm.py" "$S" 81764e4 v0 vZ20 vZ20m vZ19m vSysOld vAll3 > "$O/out_pages_81764e4.txt" 2>&1
grep -E '^ +(Test Files|Tests) ' "$S/vitest_full_head_v0.txt" > "$O/out_vitest_full.txt"; grep -E 'FAIL|ENOENT' "$S/vitest_full_head_v0.txt" | head -3 >> "$O/out_vitest_full.txt"
echo "-- validate-facts.test.ts with .github present in the copy:" >> "$O/out_vitest_full.txt"; grep -E '^ +(Test Files|Tests) ' "$S/vitest_vf.txt" >> "$O/out_vitest_full.txt"
{ echo "tsc --noEmit on code copy e0aab10a: errors by file"; cat "$S/tsc_head.txt"; } > "$O/out_tsc.txt"
echo done
