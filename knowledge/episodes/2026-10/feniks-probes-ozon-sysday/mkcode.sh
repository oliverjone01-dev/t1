#!/usr/bin/env bash
# Code copies for differential page probes: main ada2e83 (#487 squash = audited iter4 0bb36b5) and PR code 30abf83.
# Taken out of git (git archive), not from the worktree. node_modules is a symlink.
# Usage: bash mkcode.sh <scratch dir>. Writes only under <scratch dir>.
set -eu
S=$1
for rev in ada2e83 30abf83; do
  D=$S/code_$rev
  rm -rf "$D"; mkdir -p "$D"
  git -C /home/user/t1 archive "$rev" analytics-mvp | tar -x -C "$D" --exclude='analytics-mvp/data' --exclude='analytics-mvp/data/*'
  rm -rf "$D/analytics-mvp/data" "$D/analytics-mvp/out"
  python3 -I -c 'import os,sys; os.symlink("/home/user/t1/analytics-mvp/node_modules", sys.argv[1])' "$D/analytics-mvp/node_modules"
  echo "$rev -> $D/analytics-mvp ($(find "$D/analytics-mvp/src" -name '*.ts' | wc -l) ts files)"
done
