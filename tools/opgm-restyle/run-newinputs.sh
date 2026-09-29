#!/bin/bash
# Тот же метод на другом наборе входов: seed 4242, выгрузка 29.09.2026, 900 чатов.
cd "$(dirname "$0")"; OP=../opgm/op-gm-automation; FX='{"seed":4242,"export":"2026-09-29T09:00:00+03:00","n":900}'
for v in base same mutant hero rename skin; do s=$([ $v = base ] && echo "" || echo "--src variants/$v"); node numsnap.cjs snap --op $OP $s --out out/n-$v.json --fx "$FX" | tail -1 | cut -c1-150; done
for p in "same empty" "mutant empty" "hero w2-hero" "rename rename-s5" "skin empty"; do set -- $p; out=$(node numsnap.cjs diff out/n-base.json out/n-$1.json --manifest manifests/$2.json --show 2); echo "n-base -> n-$1 [$2]: $(echo "$out" | grep -E 'НЕОБЪЯСН' | tr -s ' ') | $(echo "$out" | grep ИТОГ)"; done
