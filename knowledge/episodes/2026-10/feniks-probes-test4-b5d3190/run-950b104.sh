#!/usr/bin/env bash
# Пробы ФЕНИКСА, итерация 2 (950b104). Всё во временной папке, репозиторий и public/ не трогаются.
# Запуск: bash run-950b104.sh [rev]   (по умолчанию 950b104)
set -uo pipefail
REPO=/home/user/t1
P="$(cd "$(dirname "$0")" && pwd)"
REV="${1:-950b104}"
W="$(mktemp -d /tmp/feniks-t4b-XXXX)"
TSX="$REPO/analytics-mvp/node_modules/.bin/tsx"
tree() { mkdir -p "$W/$1"; git -C "$REPO" archive "$REV" analytics-mvp | tar -x -C "$W/$1"; }
build() { mkdir -p "$W/out-$1"; echo "== build $1"; (cd "$W/$1/analytics-mvp" && OUT_DIR="$W/out-$1" "$TSX" src/scripts/build-tests.ts 2>&1 | grep -v '^\s*at ' | grep -E 'katya-tests|Error' | head -2); }
tree new; build new
tree fx1; python3 -I "$P/mkfx.py" "$W/fx1/analytics-mvp" unexclude_cpc; build fx1             # автодетект рекламы
tree fx2; python3 -I "$P/mkfx.py" "$W/fx2/analytics-mvp" unexclude_cpc_stale_ads; build fx2   # синк рекламы встал 28.09
tree fx3; python3 -I "$P/mkfx3.py" "$W/fx3/analytics-mvp" s0n; build fx3                      # окно закрыто, покрытие до 24.10
tree fx4; python3 -I "$P/mkfx3.py" "$W/fx4/analytics-mvp" s1; build fx4                       # то же + реклама 24.10 после окна
tree fx6; python3 -I "$P/mkfx3.py" "$W/fx6/analytics-mvp" s0; build fx6                       # окно закрыто, реклама по 10.10
tree fx5; python3 -I "$P/mkfx3.py" "$W/fx5/analytics-mvp" allexcl; build fx5                  # 0 чистых
tree fx7; python3 -I "$P/mkfx3.py" "$W/fx7/analytics-mvp" typo; build fx7                     # опечатка в «исключены»: ждём ошибку
python3 -I "$P/card2.py" "$W" new fx1 fx2 fx3 fx4 fx6 fx5 | grep -v '^    GG'
python3 -I "$P/lag.py" "$REPO"   # лаг рекламы к разрыву по последним снимкам данных
echo "workdir: $W"
