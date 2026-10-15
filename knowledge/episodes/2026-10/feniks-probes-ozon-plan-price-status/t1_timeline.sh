#!/bin/bash
# ФЕНИКС, раздел 5 «Цена». T1: одна и та же выгрузка (срез цен 15.10, 05:53 UTC = 08:53 МСК) на разных датах сборки.
# Сборка страницы идёт и до утреннего среза: deploy-pages.yml:57-58 workflow_run после «GEO-monster harvest»
# (harvest.yml:10, 00:00 UTC = 03:00 МСК), TODAY = дата по МСК (build-tests.ts:56). Значит, с 03:00 до ~09:00 МСК
# 16.10 страница строится с today=16.10 и ценами на утро 15.10. Пропуск среза (prices_daily 22.09 нет) - тот же случай на дни.
# head = 4f2409c, base = c540277 (main). Печать: плашки цены после клиента и счёт статусов по тексту чипа.
SP=/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p5
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status
DD=$SP/data_4f2409c/analytics-mvp/data
for rev in 4f2409c c540277; do
  for today in 2026-10-15 2026-10-16 2026-10-22 2026-10-23; do
    (cd $SP/tree_$rev/analytics-mvp && npx tsx $P/render5.mts $SP/tree_$rev/analytics-mvp $DD $today $SP/r_${rev}_$today.json 2>&1) \
      | grep -E '^\[|плашки:|статусы по тексту:' | sed -e "s/^/$rev $today | /"
  done
done
