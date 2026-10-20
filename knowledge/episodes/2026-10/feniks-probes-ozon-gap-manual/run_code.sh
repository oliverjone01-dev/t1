#!/usr/bin/env bash
# Run a read-only probe .mts from the code copy <scratch>/code_<rev> (no data needed).
# Usage: bash run_code.sh <scratch dir> <rev> <probe.mts>
set -u
S=$1; REV=$2; PROBE=$3
CD=$S/code_$REV/analytics-mvp
echo "== $REV $(basename "$PROBE")"
( cd "$CD" && CODE=$CD npx tsx "$PROBE" 2>&1 )
