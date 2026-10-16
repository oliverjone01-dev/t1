#!/bin/bash
# run fx8_rows.mjs for given sandboxes in parallel; outputs rows_<sb>.jsonl
S=/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8
cd "$S/pw" || exit 9
for sb in "$@"; do
  node "$S/pw/fx8_rows.mjs" "$sb" "$S/fzperiods8.json" > "$S/rows_$sb.jsonl" 2> "$S/rows_$sb.err" &
done
wait
for sb in "$@"; do echo "$sb $(wc -l < "$S/rows_$sb.jsonl") lines, err: $(head -c 200 "$S/rows_$sb.err")"; done
