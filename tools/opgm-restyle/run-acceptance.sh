#!/bin/bash
# Приёмка метода снимка по Р8 на синтетическом стенде: снимки базы и вариантов, затем сравнения.
# Запуск: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers ./run-acceptance.sh [--no-snap]
cd "$(dirname "$0")"; OP=../opgm/op-gm-automation
if [ "$1" != "--no-snap" ]; then
  ./variants/make.sh >/dev/null
  node numsnap.cjs snap --op $OP --out out/base-1.json | sed 's/^/  /'
  node numsnap.cjs snap --op $OP --out out/base-2.json >/dev/null
  for v in same mutant hero hero-bad rename skin; do node numsnap.cjs snap --op $OP --src variants/$v --out out/v-$v.json >/dev/null || echo "снимок $v: ошибка"; done
fi
check(){ want=$1; shift; out=$(node numsnap.cjs diff "$@" --show 4 2>&1); code=$?
  echo "\$ numsnap diff ${*#out/}"; echo "$out" | grep -E 'НЕОБЪЯСН|объяснено|ИТОГ|СТОП|^    ' | cut -c1-200
  [ "$code" = "$want" ] && echo "  ожидали код $want, получили $code: ок" || { echo "  ожидали код $want, получили $code: ПРОВАЛ ПРИЁМКИ"; FAIL=1; }; echo; }
FAIL=0
check 0 out/base-1.json out/base-2.json
check 0 out/base-1.json out/v-same.json
check 1 out/base-1.json out/v-mutant.json --manifest manifests/empty.json
check 0 out/base-1.json out/v-hero.json --manifest manifests/w2-hero.json
check 1 out/base-1.json out/v-hero.json
check 1 out/base-1.json out/v-hero-bad.json --manifest manifests/w2-hero.json
check 0 out/base-1.json out/v-rename.json --manifest manifests/rename-s5.json
check 1 out/base-1.json out/v-rename.json
check 0 out/base-1.json out/v-skin.json --manifest manifests/empty.json
check 1 out/base-1.json out/v-skin.json --manifest manifests/w2-hero.json
echo "ПРИЁМКА МЕТОДА: $([ $FAIL = 0 ] && echo PASS || echo FAIL)"; exit $FAIL
