#!/bin/bash
# usage: vt9.sh <sandbox> - private node_modules (dir of symlinks, no cache lands in the repo), tsc --noEmit, vitest run
S=/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11
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
grep 'error TS' "$S/$1.tsc.txt" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort > "$S/$1.tsc.norm"
echo "tsc errors: $(grep -c 'error TS' "$S/$1.tsc.txt") md5(sorted, no line numbers): $(md5sum < "$S/$1.tsc.norm" | cut -c1-8)"
node node_modules/vitest/vitest.mjs run --reporter=dot > "$S/$1.vitest.txt" 2>&1
echo "vitest rc=$?"
tail -6 "$S/$1.vitest.txt"
grep -E "FAIL" "$S/$1.vitest.txt" | sed -E 's/\x1b\[[0-9;]*m//g' | sort -u | head -12
node node_modules/vitest/vitest.mjs run src/scripts/cpo-orders-rev.test.ts > "$S/$1.vitest-cpo.txt" 2>&1
echo "cpo-orders-rev.test.ts rc=$?"
sed -E 's/\x1b\[[0-9;]*m//g' "$S/$1.vitest-cpo.txt" | grep -E "Tests|passed|failed" | head -4
