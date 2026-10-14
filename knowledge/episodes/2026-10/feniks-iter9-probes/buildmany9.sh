#!/bin/bash
# usage: buildmany9.sh <sb>...   builds sandboxes, 5 in parallel; summary per sandbox in <sb>.sum
S=/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9
n=0
for sb in "$@"; do
  bash "$S/build9.sh" "$sb" > "$S/$sb.sum" 2>&1 &
  n=$((n+1))
  if [ $((n % 5)) -eq 0 ]; then wait; fi
done
wait
for sb in "$@"; do echo "######## $sb"; cat "$S/$sb.sum"; done
