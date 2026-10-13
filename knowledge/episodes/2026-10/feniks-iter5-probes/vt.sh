#!/bin/bash
# usage: vt.sh <sandbox>  - vitest run inside the sandbox with a private node_modules of symlinks (no cache writes into the repo)
S=/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad
D="$S/$1/analytics-mvp"
NM=/home/user/t1/analytics-mvp/node_modules
mkdir -p "$D/node_modules"
for e in "$NM"/* "$NM"/.bin; do
  b=$(basename "$e")
  [ -e "$D/node_modules/$b" ] || ln -s "$e" "$D/node_modules/$b"
done
cd "$D" || exit 9
node node_modules/vitest/vitest.mjs run --reporter=dot 2>&1 | tail -25
