#!/bin/bash
# usage: render9.sh <sb>...  runs fx9_report.mjs and fx9_rows.mjs for each sandbox (4 at a time); outputs rep_<sb>.json, rows_<sb>.jsonl
S=/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9
cd "$S/pw" || exit 9
n=0
for sb in "$@"; do
  ( node "$S/pw/fx9_report.mjs" "$sb" > "$S/rep_$sb.json" 2> "$S/rep_$sb.err"; node "$S/pw/fx9_rows.mjs" "$sb" "$S/pw/periods9.json" > "$S/rows_$sb.jsonl" 2> "$S/rows_$sb.err" ) &
  n=$((n+1))
  if [ $((n % 4)) -eq 0 ]; then wait; fi
done
wait
for sb in "$@"; do echo "$sb rep $(wc -c < "$S/rep_$sb.json") bytes err: $(head -c 150 "$S/rep_$sb.err") | rows $(wc -l < "$S/rows_$sb.jsonl") err: $(head -c 150 "$S/rows_$sb.err")"; done
