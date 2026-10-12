#!/usr/bin/env bash
# Пробы ФЕНИКСА к b5d3190 (тест 4, грязные тестовые товары). Всё собирается во временной папке,
# репозиторий и public/ не трогаются. Запуск: bash run.sh (из любой папки).
set -euo pipefail
REPO=/home/user/t1
P="$(cd "$(dirname "$0")" && pwd)"
W="$(mktemp -d /tmp/feniks-t4-XXXX)"
TSX="$REPO/analytics-mvp/node_modules/.bin/tsx"
tree() { mkdir -p "$W/$1"; git -C "$REPO" archive "$2" analytics-mvp | tar -x -C "$W/$1"; }
build() { (cd "$W/$1/analytics-mvp" && OUT_DIR="$W/out-$1" "$TSX" src/scripts/build-tests.ts | tail -1); }

# R1 регрессия тестов 1-3: родитель против коммита (секции 1-3 должны совпасть побайтно)
tree parent 73c265e; tree child b5d3190; build parent; build child
# F1 fail-open: fx1 - два товара с рекламой убраны из «исключены» (билдер должен поймать сам);
#               fx2 - то же + ads_sku_daily обрезан на 28.09 (встал синк). Ожидание FAIL: «держит», 5 из 10.
tree fx1 b5d3190; python3 -I "$P/mkfx.py" "$W/fx1/analytics-mvp" unexclude_cpc; build fx1
tree fx2 b5d3190; python3 -I "$P/mkfx.py" "$W/fx2/analytics-mvp" unexclude_cpc_stale_ads; build fx2
# B2 закрытое окно: fx3 - итог «держит» на 27.10; fx4 - то же + реклама 24.10 (после конца окна 21.10)
tree fx3 b5d3190; python3 -I "$P/mkfx2.py" "$W/fx3/analytics-mvp" s0; build fx3
tree fx4 b5d3190; python3 -I "$P/mkfx2.py" "$W/fx4/analytics-mvp" s1; build fx4
python3 -I "$P/card.py" "$W"/out-{child,fx1,fx2,fx3,fx4}/katya-tests.html | grep -v '^STOP'
# P1 популяция показов (страница: 7,23 ‰, +13% по 10 товарам)
python3 -I "$P/views.py" "$REPO/analytics-mvp"
# B1 причины исключения против сырья
python3 -I "$P/b1.py" "$W/child/analytics-mvp" | tail -12
# T2 мутация: ассерт «порог 3 из 4» не различает наличие skip
cp "$P/feniks-mut.ts" "$W/child/analytics-mvp/src/scripts/" && (cd "$W/child/analytics-mvp" && "$TSX" src/scripts/feniks-mut.ts)
# T3 no-pii: «+7 740 ₽» ловится регуляркой телефона и до коммита
python3 -I "$P/pii.py" "$W/out-parent/katya-tests.html" "$W/out-child/katya-tests.html"
echo "workdir: $W"
