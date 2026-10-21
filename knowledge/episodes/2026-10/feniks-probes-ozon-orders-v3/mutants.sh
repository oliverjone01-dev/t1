#!/usr/bin/env bash
# ФЕНИКС, аудит PR #492 (2026-10-20): мутанты M1/M2 - вернуть баг E093 (цена-объект читается как число)
# и проверить, падает ли хоть один тест. Работает только во временной копии, репозиторий не трогает.
#   M1: ozon-seller.ts mapP   price: moneyOf(it.price)        -> price: Number(it.price ?? 0)
#   M2: orders-daily.ts paid  moneyOf(x?.customer_price)      -> (Number(x?.customer_price) || 0)
# Запуск из корня репо: bash knowledge/episodes/2026-10/feniks-probes-ozon-orders-v3/mutants.sh [rev]
# Ожидание для защищённого фикса: тесты красные. Факт 2026-10-20: 30/30 зелёные (мутанты выжили).
set -euo pipefail
REV="${1:-5af708906c20474c82c5429080ad5ae6bb7c9160}"
T="$(mktemp -d /tmp/feniks-mut-XXXX)"
git archive "$REV" analytics-mvp/src analytics-mvp/package.json analytics-mvp/tsconfig.json | tar -x -C "$T"
cp -r analytics-mvp/node_modules "$T/analytics-mvp/"
sed -i 's/price: moneyOf(it.price),/price: Number(it.price ?? 0),/' "$T/analytics-mvp/src/connector/ozon-seller.ts"
sed -i 's/moneyOf(x?.customer_price)/(Number(x?.customer_price) || 0)/' "$T/analytics-mvp/src/scripts/ozon/orders-daily.ts"
grep -c "price: Number(it.price ?? 0)" "$T/analytics-mvp/src/connector/ozon-seller.ts"
grep -c "(Number(x?.customer_price) || 0)" "$T/analytics-mvp/src/scripts/ozon/orders-daily.ts"
cd "$T/analytics-mvp"
./node_modules/.bin/vitest run src/connector/ src/scripts/ozon/orders-daily.test.ts src/scripts/ozon/prices-daily.test.ts || echo "MUTANT KILLED (тесты упали) - фикс защищён"
