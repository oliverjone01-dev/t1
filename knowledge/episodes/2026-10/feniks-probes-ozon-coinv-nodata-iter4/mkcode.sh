#!/usr/bin/env bash
# Code copies for the differential page probes: iter3 (b0096cf, go 8.20) and HEAD (0bb36b5) out of git, not the worktree.
# Usage: bash mkcode.sh <scratch dir>. Writes only under <scratch dir>; node_modules is a symlink (made by python, see below).
set -eu
S=$1
for rev in b0096cf 0bb36b5; do
  D=$S/code_$rev
  rm -rf "$D"; mkdir -p "$D"
  git -C /home/user/t1 archive "$rev" analytics-mvp/src analytics-mvp/tools analytics-mvp/package.json analytics-mvp/tsconfig.json | tar -x -C "$D"
  python3 -I -c 'import os,sys; os.symlink("/home/user/t1/analytics-mvp/node_modules", sys.argv[1])' "$D/analytics-mvp/node_modules"
  echo "$rev -> $D/analytics-mvp ($(find "$D/analytics-mvp/src" -name '*.ts' | wc -l) ts files)"
done
