#!/bin/bash
# Приёмка метода снимка по Р8 на синтетическом стенде: снимки базы и вариантов, затем сравнения.
# Запуск: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers ./run-acceptance.sh [--op <op-gm-automation>] [--no-snap]  (без --op: OP из окружения или папка выше tools/)
cd "$(dirname "$0")"; [ "$1" = "--op" ] && { OP=$2; shift 2; }; OP=${OP:-..}; export OP
[ -f "$OP/src/opgm.js" ] || { echo "ОШИБКА: укажите --op <op-gm-automation> (нет $OP/src/opgm.js)"; exit 2; }
if [ "$1" != "--no-snap" ]; then
  ./variants/make.sh >/dev/null || exit 2; mkdir -p out
  # снимки параллельно (по 4): каждый полный, 1280 и 390, панели, фильтры «Все диалоги»
  printf '%s\n' "base-1 $OP/src" "base-2 $OP/src" "v-same variants/same" "v-mutant variants/mutant" "v-hero variants/hero" "v-hero-bad variants/hero-bad" "v-rename variants/rename" "v-skin variants/skin" \
    | xargs -P 4 -L 1 sh -c 'node numsnap.cjs snap --op "$OP" --src "$1" --out out/$0.json > out/$0.snap.log 2>&1 || echo "снимок $0: код $?"'
  sed 's/^/  /' out/base-1.snap.log
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
