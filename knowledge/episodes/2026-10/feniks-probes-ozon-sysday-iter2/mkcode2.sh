#!/usr/bin/env bash
# Code copies for iter2 probes of PR #488: head 10049c0, main 12808f9 (merge-base), iter1 PR code 30abf83.
# Taken out of git (git archive), not from the worktree. node_modules is a symlink. data/ and out/ are not copied:
# every run points DATA_DIR / OUT_DIR (pages) or a data symlink (live tests) at a variant in scratch.
# Usage: bash mkcode2.sh <scratch dir> [revs...]. Writes only under <scratch dir>.
set -eu
S=$1; shift
REVS=${*:-"10049c0 12808f9 30abf83"}
for rev in $REVS; do
  D=$S/code_$rev
  rm -rf "$D"; mkdir -p "$D"
  git -C /home/user/t1 archive "$rev" analytics-mvp | tar -x -C "$D" --exclude='analytics-mvp/data' --exclude='analytics-mvp/data/*'
  rm -rf "$D/analytics-mvp/data" "$D/analytics-mvp/out"
  python3 -I -c 'import os,sys; os.symlink("/home/user/t1/analytics-mvp/node_modules", sys.argv[1])' "$D/analytics-mvp/node_modules"
  echo "$rev -> $D/analytics-mvp ($(find "$D/analytics-mvp/src" -name '*.ts' | wc -l) ts files)"
done
