#!/usr/bin/env bash
# Макет шага «Промежуточный коммит» + гейта «OZON байт-в-байт» из ym-snapshots.yml.
set -uo pipefail
W=$(mktemp -d); cd "$W"
git init -q --bare remote.git
git clone -q remote.git a && git clone -q remote.git b
for r in a b; do git -C $r config user.email t@t; git -C $r config user.name t; done
mkdir -p a/analytics-mvp/public a/analytics-mvp/data a/analytics-mvp/data-ym
echo h1 > a/analytics-mvp/public/index.html; echo o1 > a/analytics-mvp/data/orders_daily.ndjson; echo c1 > a/analytics-mvp/data/competitors.json; echo y1 > a/analytics-mvp/data-ym/orders.ndjson
git -C a add -A && git -C a commit -qm base && git -C a push -q origin HEAD:main
git -C b pull -q origin main
# --- прогон (клон a на коммите запуска): слепок на checkout
OB=$W/ozon-before; mkdir -p $OB
( cd a/analytics-mvp && md5sum public/*.html > $OB/public.md5 && { md5sum data/* 2>/dev/null | grep -v "data/competitors" > $OB/data.md5 || true; } )
# --- чужой OZON-коммит в main за время сбора
echo o2 > b/analytics-mvp/data/orders_daily.ndjson; git -C b commit -qam "ozon" && git -C b push -q origin HEAD:main
# --- продьюсеры: наш факт-слой
echo y2 > a/analytics-mvp/data-ym/orders.ndjson
cd a; git add -A analytics-mvp/data-ym; git commit -qm "data-ym промежуточный"
MODE=${1:-fixed}
for i in 1; do
  if git push -q origin HEAD:main 2>/dev/null; then echo "push прошёл сразу (не должен)"; exit 2; fi
  git fetch -q origin main
  rm -rf /tmp/ym-keep-sim && mkdir -p /tmp/ym-keep-sim && cp -r analytics-mvp/data-ym /tmp/ym-keep-sim/
  git reset -q --hard origin/main
  if [ "$MODE" != broken ]; then  # fixed и negative переснимают слепок; broken - как было до фикса
    ( cd analytics-mvp && md5sum public/*.html > $OB/public.md5 && { md5sum data/* 2>/dev/null | grep -v "data/competitors" > $OB/data.md5 || true; } )
  fi
  cp -r /tmp/ym-keep-sim/data-ym/. analytics-mvp/data-ym/
  git add -A analytics-mvp/data-ym; git commit -qm "data-ym промежуточный 2"; git push -q origin HEAD:main || { echo "второй push упал"; exit 2; }
done
[ "$MODE" = negative ] && echo h-hacked > analytics-mvp/public/index.html
# --- гейт
cd analytics-mvp
ok=1; md5sum -c --quiet $OB/public.md5 || ok=0; md5sum -c --quiet $OB/data.md5 || ok=0
if [ $ok = 1 ]; then echo "ГЕЙТ: пройден ($MODE)"; else echo "ГЕЙТ: упал ($MODE)"; fi
grep -c orders_daily $OB/data.md5 >/dev/null && grep -q competitors $OB/data.md5 && echo "ошибка: competitors в слепке"
echo "data-ym на main: $(git show origin/main:analytics-mvp/data-ym/orders.ndjson), OZON на main: $(git show origin/main:analytics-mvp/data/orders_daily.ndjson)"
