#!/usr/bin/env bash
# Run a read-only probe .mts from a code copy with ./data pointed at a variant.
# Usage: bash run_ts.sh <scratch dir> <rev> <probe.mts> [variants...]   (lt_<rev> copy from mkcode_gm.sh)
set -u
S=$1; REV=$2; PROBE=$3; shift 3
CD=$S/lt_$REV/analytics-mvp
for v in "$@"; do
  python3 -I -c 'import os,sys; p=sys.argv[1]; os.path.lexists(p) and os.remove(p); os.symlink(sys.argv[2], p)' "$CD/data" "$S/pb/$v/data"
  echo "== $REV $v"
  ( cd "$CD" && CODE=$CD npx tsx "$PROBE" 2>&1 )
done
