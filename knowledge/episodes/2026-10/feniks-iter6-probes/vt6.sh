#!/bin/bash
# usage: vt6.sh <sandbox> - private node_modules (dir of symlinks, so no cache lands in the repo), tsc --noEmit, vitest run
S=/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6
D="$S/$1/analytics-mvp"
NM=/home/user/t1/analytics-mvp/node_modules
if [ -L "$D/node_modules" ]; then rm "$D/node_modules"; fi
mkdir -p "$D/node_modules"
for e in "$NM"/* "$NM"/.bin; do
  b=$(basename "$e")
  [ -e "$D/node_modules/$b" ] || ln -s "$e" "$D/node_modules/$b"
done
cd "$D" || exit 9
node node_modules/typescript/bin/tsc --noEmit -p . > "$S/$1.tsc.txt" 2>&1
echo "tsc errors: $(grep -c 'error TS' "$S/$1.tsc.txt") md5(sorted err lines w/o paths prefix): $(grep 'error TS' "$S/$1.tsc.txt" | sort | md5sum | cut -c1-8)"
node node_modules/vitest/vitest.mjs run --reporter=dot > "$S/$1.vitest.txt" 2>&1
tail -8 "$S/$1.vitest.txt"
grep -E "FAIL|✗|×" "$S/$1.vitest.txt" | sort -u | head -12
