#!/bin/bash
# ФЕНИКС iter4. Проба R1b: smoke-гейт деплоя (src/scripts/smoke.ts, jsdom, рантайм-ошибка = FAIL) на странице «Тесты»
# кода 753bf11 (запрос аудита) и da0a36b (голова после Codex P1). Пишет только в scratch.
# CI на PR (analytics-tests.yml) build-tests.ts не собирает - страница «Тесты» в смоук PR не попадает; deploy-pages.yml собирает (npm run katya).
SP=/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad
DATA=$SP/data_753bf11/analytics-mvp/data
for rev in 753bf11 da0a36b; do
  cd $SP/tree_$rev/analytics-mvp || exit 1
  out=$SP/smoke_$rev; rm -rf $out; mkdir -p $out
  DATA_DIR=$DATA OUT_DIR=$out npx tsx src/scripts/build-tests.ts > $SP/smoke_build_$rev.log 2>&1; echo "$rev build exit $?"
  DATA_DIR=$DATA OUT_DIR=$out npx tsx src/scripts/smoke.ts 2>&1 | tail -4; echo "$rev smoke exit ${PIPESTATUS[0]}"
done
grep -n -E "build-tests|katya" /home/user/t1/.github/workflows/analytics-tests.yml | head -5
