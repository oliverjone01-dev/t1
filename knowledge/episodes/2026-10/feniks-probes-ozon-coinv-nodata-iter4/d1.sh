#!/usr/bin/env bash
# D1: v8/fix_nodata_1610.py (iter4 version, history rule) on a main snapshot gives HEAD data byte for byte; 2nd run = 0/0/0.
# Usage: bash d1.sh <scratch dir>. Writes only under <scratch dir>/d1_<base>.
set -u
S=$1
for base in d20a012 52476fc; do
  W=$S/d1_$base; rm -rf "$W"; mkdir -p "$W"
  git -C /home/user/t1 archive "$base" analytics-mvp/data/coinv_daily.ndjson analytics-mvp/data/gap_daily.ndjson analytics-mvp/data/prices_daily.ndjson | tar -x -C "$W"
  echo "== base $base"
  ( cd "$W" && python3 -I /home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v8/fix_nodata_1610.py )
  for f in coinv_daily gap_daily prices_daily; do
    cmp -s "$W/analytics-mvp/data/$f.ndjson" /home/user/t1/analytics-mvp/data/$f.ndjson && echo "   $f: identical to HEAD" || echo "   $f: DIFFERS from HEAD"
  done
  echo "   second run:"; ( cd "$W" && python3 -I /home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v8/fix_nodata_1610.py | tail -1 )
done
