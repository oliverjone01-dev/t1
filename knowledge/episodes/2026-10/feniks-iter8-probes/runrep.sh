#!/bin/bash
# run fx8_report.mjs for given sandboxes in parallel; outputs rep_<sb>.json
S=/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8
cd "$S/pw" || exit 9
for sb in "$@"; do
  node "$S/pw/fx8_report.mjs" "$sb" > "$S/rep_$sb.json" 2> "$S/rep_$sb.err" &
done
wait
for sb in "$@"; do echo "$sb $(wc -c < "$S/rep_$sb.json") bytes, err: $(head -c 200 "$S/rep_$sb.err")"; done
