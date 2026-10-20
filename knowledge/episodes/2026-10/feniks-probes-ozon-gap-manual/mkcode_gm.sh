#!/usr/bin/env bash
# Code copies for the audit of PR #489: head e0aab10a and base 81764e4 (main = squash #488).
# Out of git (git archive), not from the worktree; node_modules is a symlink; data/ is not copied (every run points
# DATA_DIR at a variant, live tests get a data symlink). Writes only under <scratch dir>. No rm -rf: fresh dirs only.
# Usage: bash mkcode_gm.sh <scratch dir> [revs...]
set -eu
S=$1; shift
REVS=${*:-"e0aab10a 81764e4"}
for rev in $REVS; do
  for kind in code lt; do
    D=$S/${kind}_$rev
    if [ -d "$D/analytics-mvp/src" ]; then echo "$D exists"; continue; fi
    mkdir -p "$D"
    git -C /home/user/t1 archive "$rev" analytics-mvp | tar -x -C "$D" --exclude='analytics-mvp/data/*' --exclude='analytics-mvp/out/*'
    [ -d "$D/analytics-mvp/data" ] && rmdir "$D/analytics-mvp/data" 2>/dev/null || true
    python3 -I -c 'import os,sys; os.symlink("/home/user/t1/analytics-mvp/node_modules", sys.argv[1])' "$D/analytics-mvp/node_modules"
    echo "$rev -> $D/analytics-mvp ($(find "$D/analytics-mvp/src" -name '*.ts' | wc -l) ts files, data: $(ls -d "$D/analytics-mvp/data" 2>/dev/null || echo none))"
  done
done
