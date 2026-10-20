#!/usr/bin/env bash
# Full vitest of PR #489 head code (git archive <rev>, not the worktree) on live data (variant v0 = repo data/ with
# the empty repo gap_manual.ndjson). Own copy full_<rev> so live_gm.sh can re-point lt_<rev>/data in parallel.
# .github is archived next to analytics-mvp: ym/validate-facts.test.ts reads ../.github/workflows/ym-snapshots.yml.
# Writes only under <scratch dir>. Usage: bash run_full_iter2.sh <scratch dir> <rev>
set -u
S=$1; REV=$2
D=$S/full_$REV
if [ ! -d "$D/analytics-mvp/src" ]; then
  mkdir -p "$D"
  git -C /home/user/t1 archive "$REV" analytics-mvp .github | tar -x -C "$D" --exclude='analytics-mvp/data/*' --exclude='analytics-mvp/out/*'
  [ -d "$D/analytics-mvp/data" ] && rmdir "$D/analytics-mvp/data" 2>/dev/null || true
  python3 -I -c 'import os,sys; os.symlink(sys.argv[2], sys.argv[1])' "$D/analytics-mvp/node_modules" /home/user/t1/analytics-mvp/node_modules
  python3 -I -c 'import os,sys; os.symlink(sys.argv[2], sys.argv[1])' "$D/analytics-mvp/data" "$S/pb/v0/data"
fi
cd "$D/analytics-mvp" || exit 1
START=$(date +%s)
npx vitest run > "$S/vitest_full_$REV.txt" 2>&1
RC=$?
echo "rev $REV exit=$RC seconds=$(( $(date +%s) - START ))" >> "$S/vitest_full_$REV.txt"
grep -E '^ +(Test Files|Tests) |FAIL|exit=' "$S/vitest_full_$REV.txt" | head -12
