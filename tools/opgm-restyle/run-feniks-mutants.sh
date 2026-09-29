#!/bin/bash
# Итерация 3: мутанты ФЕНИКСА iter2 (feniks-probes-iter2/make-variants.py) против инструментов v2. Исходники op-gm только копируются.
# Запуск: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers ./run-feniks-mutants.sh --op <op-gm-automation> --v <папка вариантов make-variants.py>
cd "$(dirname "$0")"
while [ $# -gt 0 ]; do case $1 in --op) OP=$2; shift 2;; --v) V=$2; shift 2;; *) shift;; esac; done
OP=${OP:-..}; export OP
[ -f "$OP/src/opgm.js" ] && [ -d "$V" ] || { echo "ОШИБКА: нужны --op <op-gm-automation> и --v <папка вариантов>"; exit 2; }
mkdir -p out/fm; FAIL=0
if [ "$NO_SNAP" != 1 ]; then
  { echo "base $OP/src"; for v in f-same f-cabswap-src f-tip-swap f-tip-swap2 f-hide-css f-filter-dead f-chart-x10 f-drawer1 f-share-floor f-hero-src f-cab-class; do echo "$v $V/$v"; done; } \
    | xargs -P 4 -L 1 sh -c 'node numsnap.cjs snap --op "$OP" --src "$1" --out out/fm/$0.json > out/fm/$0.snap.log 2>&1 || echo "снимок $0: код $?"'
  node numsnap.cjs snap --op "$OP" --out out/fm/p-base.json --views today --no-drawers > /dev/null 2>&1
  node numsnap.cjs snap --op "$OP" --src "$V/a-mutant" --out out/fm/p-mutant.json --views today --no-drawers > /dev/null 2>&1
fi
ex(){ want=$1; shift; out=$("$@" 2>&1); c=$?; echo "\$ ${*/#node /}" | sed "s|$V/||g; s|$OP|<op>|g" | cut -c1-160
  echo "$out" | grep -E 'НЕОБЪЯСН|по видам|СТОП|ИТОГ|ПОВЕРХНОСТЕЙ|ПРОВАЛ|^FAIL  6' | cut -c1-210 | head -6
  [ $c = $want ] && echo "  код $c, ждали $want: ок" || { echo "  код $c, ждали $want: ПРОВАЛ"; FAIL=1; }; echo; }
ex 0 node numsnap.cjs diff out/fm/base.json out/fm/f-same.json --manifest manifests/empty.json
for v in f-cabswap-src f-tip-swap f-tip-swap2 f-hide-css f-filter-dead f-chart-x10 f-drawer1 f-share-floor f-hero-src f-cab-class; do ex 1 node numsnap.cjs diff out/fm/base.json out/fm/$v.json --manifest manifests/empty.json --show 0; done
ex 2 node numsnap.cjs diff out/fm/p-base.json out/fm/p-mutant.json --manifest manifests/empty.json
# тот же мутант на частичном снимке с явным флагом проходит 0: поэтому частичный снимок без флага = код 2
ex 0 node numsnap.cjs diff out/fm/p-base.json out/fm/p-mutant.json --manifest manifests/empty.json --allow-partial --show 0
ex 2 node numsnap.cjs diff out/fm/base.json out/fm/p-mutant.json --manifest manifests/empty.json --allow-partial
ex 0 node cabname-check.cjs --op "$OP"
ex 1 node cabname-check.cjs --op "$OP" --src "$V/f-cab-class"
ex 1 node cabname-check.cjs --op "$OP" --src "$V/a-dotonly"
ex 1 node d1check.cjs --op "$OP"
ex 1 node d1check.cjs --op "$OP" --src "$V/f-d1hard"
ex 0 node d1check.cjs --op "$OP" --src "$V/a-d1fix"
echo "МУТАНТЫ ФЕНИКСА iter2: $([ $FAIL = 0 ] && echo 'PASS (каждый пойман, контроли чистые)' || echo FAIL)"; exit $FAIL
