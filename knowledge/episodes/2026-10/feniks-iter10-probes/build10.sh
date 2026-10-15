#!/bin/bash
# usage: build10.sh <sandbox>   builds OZON katya pages inside the sandbox (no writes to the repo); rc of the build is printed
set -u
S=/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f10
D="$S/$1/analytics-mvp"
cd "$D" || exit 9
LOG="$S/$1.build.log"
{
  echo "== ozon $(date -u +%T)"
  node node_modules/tsx/dist/cli.mjs src/scripts/build-katya.ts
  echo "rc_ozon=$?"
  echo "== done $(date -u +%T)"
} > "$LOG" 2>&1
grep -E "kartochki|report|rc_ozon|::error::|Error" "$LOG" | cut -c1-400 | tail -14
