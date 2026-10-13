#!/bin/bash
# usage: feniks-build.sh <sandbox-name>   builds OZON and YM katya pages inside the sandbox
set -u
S=/tmp/claude-0/-home-user-t1/ab784862-23d6-55b0-ac5d-13cc753c25dd/scratchpad
D="$S/$1/analytics-mvp"
cd "$D" || exit 9
LOG="$S/$1.build.log"
{
  echo "== ozon $(date -u +%T)"
  node node_modules/tsx/dist/cli.mjs src/scripts/build-katya.ts
  echo "rc_ozon=$?"
  echo "== ym $(date -u +%T)"
  mkdir -p public/market
  DATA_DIR=data-ym OUT_DIR=public/market PLATFORM=ym node node_modules/tsx/dist/cli.mjs src/scripts/build-katya.ts
  echo "rc_ym=$?"
  echo "== done $(date -u +%T)"
} > "$LOG" 2>&1
tail -3 "$LOG"
