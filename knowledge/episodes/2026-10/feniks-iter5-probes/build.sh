#!/bin/bash
# usage: build.sh <sandbox>   builds OZON katya pages inside the sandbox (no writes to the repo)
set -u
S=/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad
D="$S/$1/analytics-mvp"
cd "$D" || exit 9
LOG="$S/$1.build.log"
{
  echo "== ozon $(date -u +%T)"
  node node_modules/tsx/dist/cli.mjs src/scripts/build-katya.ts
  echo "rc_ozon=$?"
  echo "== done $(date -u +%T)"
} > "$LOG" 2>&1
grep -E "kartochki|rc_ozon|==" "$LOG" | tail -6
