#!/bin/bash
# ФЕНИКС iter3: новый набор входов Φ3 и новые мутанты против numsnap 2.0 (копия инструментов автора, байт в байт).
# Всё пишется в scratchpad, репозиторий и op-gm не трогаются.
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
SP=/tmp/claude-0/-home-user-t1/16fce438-701e-5124-a7d4-75100c05e8b9/scratchpad
T=$SP/feniks-iter3/tools; O=$SP/feniks-iter3/out; V=$SP/feniks-iter3/v; V2=$SP/feniks-iter2/v
export OP=$SP/opgm/op-gm-automation
export FX3='{"seed":31337,"export":"2026-10-01T08:05:00+03:00","start":"2026-05-10T00:00:00+03:00","n":650,"expCab":{"OLD-G":"2026-10-01T08:05:00+03:00","NEW-B":"2026-09-30T19:40:00+03:00"}}'
mkdir -p "$O"
cd "$T" || exit 2
date +%T
{ echo "base-a $OP/src"; echo "base-b $OP/src"
  for v in f3-vis f3-cellswap f3-filter-ctx f3-chart-swap f3-drill-click f3-today-now f3-err; do echo "$v $V/$v"; done
  for v in f-hide-css f-tip-swap2 f-filter-dead f-chart-x10; do echo "$v $V2/$v"; done; } \
 | xargs -P 4 -L 1 sh -c 'node numsnap.cjs snap --op "$OP" --src "$1" --out '"$O"'/$0.json --fx "$FX3" > '"$O"'/$0.snap.log 2>&1; echo "снимок $0: код $?"'
date +%T
sed 's/^/  /' "$O/base-a.snap.log"
for v in base-b f3-vis f3-cellswap f3-filter-ctx f3-chart-swap f3-drill-click f3-today-now f3-err f-hide-css f-tip-swap2 f-filter-dead f-chart-x10; do
  echo "=== base-a -> $v"
  node numsnap.cjs diff "$O/base-a.json" "$O/$v.json" --manifest manifests/empty.json --show 3 2>&1 | grep -E 'СРАВНЕНИЕ|режим|НЕОБЪЯСН|по видам|СТОП|ИТОГ|^    ' | cut -c1-230
  echo "  код diff: ${PIPESTATUS[0]}"
done
date +%T
