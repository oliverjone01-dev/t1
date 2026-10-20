#!/usr/bin/env bash
# Collect iter2 probe outputs of the audit of PR #489 (code e1c3a62) into <out dir>/out_*_iter2.txt.
# Reads scratch (copies from mkcode_gm.sh, variants from mkvar_gm.py + mkvar_gm_iter2.py, live runs from live_gm.sh,
# pages from pages_gm.sh, full vitest from run_full_iter2.sh); re-runs the read-only tsx probes. Writes only <out dir>.
# Usage: bash summ_gm_iter2.sh <scratch dir> <out dir>
set -u
S=$1; O=$2; P=$(cd "$(dirname "$0")" && pwd)
{
  for v in "$S"/pb/*/; do
    v=$(basename "$v"); d=$S/pb/$v/data
    m="absent"; [ -L "$d/gap_manual.ndjson" ] && m="repo file (empty)"; [ -f "$d/gap_manual.ndjson" ] && [ ! -L "$d/gap_manual.ndjson" ] && m="$(grep -c . "$d/gap_manual.ndjson") lines"
    echo "$v gap_daily rows $(grep -c . "$d/gap_daily.ndjson") manual: $m"
  done
} > "$O/out_variants_iter2.txt"
for rev in e1c3a62 e0aab10a 81764e4; do
  {
    for f in "$S"/lt_${rev}_*.txt; do
      [ -e "$f" ] || continue
      v=${f##*/lt_${rev}_}; v=${v%.txt}
      echo "== $rev $v $(grep -E '^ +Tests ' "$f" | tr -s ' ')"
      grep -E 'AssertionError' "$f" | head -2
      grep -E '^ +× ' "$f" | head -2 | cut -c1-220
    done
  } > "$O/out_live_${rev}_iter2.txt"
done
python3 -I "$P/anpages_gm.py" "$S" e1c3a62 v0 v0x vZ20 vZ20m vZ20m1 vZ19m vNZ vKeep5 vM13 vM12 vM5 vSnap vSnapR vSys13 vSys12 vMass vMiss vBad vDup vZsibm \
  v0:v0x v0:vNZ vZ20:vZ20m v0:vM12 > "$O/out_pages_e1c3a62_iter2.txt" 2>&1
{
  python3 -I "$P/anpages_gm.py" "$S" e0aab10a v0 vNZ vKeep5 vZ20m
  python3 -I "$P/anpages_gm.py" "$S" 81764e4 v0 vZ20m
  echo "-- full differing segments (anpages truncates):"
  python3 -I "$P/segdiff_iter2.py" "$S" v0@e1c3a62:v0@e0aab10a v0@e1c3a62:v0x@e1c3a62 v0@e1c3a62:vNZ@e1c3a62 vNZ@e0aab10a:vNZ@e1c3a62 \
    v0@e1c3a62:vSnap@e1c3a62 v0@e1c3a62:vSnapR@e1c3a62 vKeep5@e0aab10a:vKeep5@e1c3a62 vZ20m@81764e4:vZ20m@e1c3a62
} > "$O/out_pages_cmp_iter2.txt" 2>&1
{
  for rev in e1c3a62 e0aab10a 81764e4; do bash "$P/run_code.sh" "$S" $rev "$P/probe_coinv_gm.mts"; done
} > "$O/out_coinv_iter2.txt" 2>&1
bash "$P/run_ts.sh" "$S" e1c3a62 "$P/placebo_why_iter2.mts" v0 vZsib vZsib19 vW15 vZsib5 vZsibL > "$O/out_placebo_why_iter2.txt" 2>&1
{ grep -E '^ +(Test Files|Tests) |exit=' "$S/vitest_full_e1c3a62.txt"; grep -E '(gap-daily|coinv-merge-nosite|validate-facts)\.test\.ts \(' "$S/vitest_full_e1c3a62.txt"; } > "$O/out_vitest_full_iter2.txt"
python3 -I "$P/inspect_gm_iter2.py" /home/user/t1/analytics-mvp/data > "$O/out_inspect_iter2.txt" 2>&1
bash "$P/misc_gm_iter2.sh" "$S" > "$O/out_misc_iter2.txt" 2>&1
{ echo "tsc --noEmit on code copy e1c3a62: errors by file (PR files: gap-daily.ts, gap-daily.test.ts, build-tests.ts, plan-tab.ts, ozon/coinv-merge*.ts)"; cat "$S/tsc_e1c3a62.txt"; echo "total errors: $(awk '{s+=$1} END {print s}' "$S/tsc_e1c3a62.txt")"; } > "$O/out_tsc_iter2.txt"
gh api repos/oliverjone01-dev/t1/pulls/489/ccr/review_threads 2>&1 | python3 -I -c 'import json,sys; [print("review thread: resolved=%s outdated=%s %s:%s" % (t.get("resolved"), t.get("outdated"), t.get("path"), t.get("line"))) for t in json.loads(sys.stdin.read())]' >> "$O/out_misc_iter2.txt"
echo done
