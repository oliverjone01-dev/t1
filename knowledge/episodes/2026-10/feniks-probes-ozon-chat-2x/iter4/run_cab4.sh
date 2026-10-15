#!/bin/bash
# ФЕНИКС iter4: фикстуры сверки с кабинетом -> рендер головы da0a36b. Пишет только в scratch.
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-chat-2x/iter4
SP=/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad
cd $SP/tree_da0a36b/analytics-mvp || exit 1
for s in cab4ok cab4hole cab4short cab4shortnots cab4tsru cab4stale cab4wd cab4today; do
  python3 -I $P/cab4_fixture.py $s
  today=2026-10-22; [ $s = cab4stale ] && today=2026-10-29
  npx tsx $P/render4.mts head $SP/c4/fx_$s $today | grep -E 'W:|Сверка|плашка' | cut -c1-330
done
