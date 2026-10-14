#!/bin/bash
# Сборка страниц Маркета в песочнице: $1 - каталог analytics-mvp, $2 - каталог данных (абсолютный), $3 - OUT
set -u
cd "$1" || exit 2
mkdir -p "$3"
DATA_DIR="$2" OUT_DIR="$3" PLATFORM=ym /root/.npm/_npx/fd45a72a545557e9/node_modules/.bin/tsx src/scripts/build-katya.ts > "$3/build.log" 2>&1
echo "build exit=$?"
tail -5 "$3/build.log"
ls -la "$3" | head -40
