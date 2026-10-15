#!/bin/bash
# ФЕНИКС, раздел 5 «Цена» блока «План» (ветка claude/amazing-hawking-0trncq @ 4f2409c, audit_hash 28451191e5dcfc21, 5 путей).
# АУДИТ ПРЕРВАН координатором 15.10 до вердикта (новые решения Ивана по спидометрам меняют plan-tab.ts и client.js
# на той же ветке). Вердикта и AUDITED нет. Пробы ниже готовы и переиспользуются в следующем запросе.
# Запись только в scratch (SP). Код - из коммитов (git archive), data/ - копия коммита 4f2409c.
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status
SP=/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p5
DD=$SP/data_4f2409c/analytics-mvp/data
cd /home/user/t1 || exit 1
python3 -B .claude/skills/data-guard/scripts/audit_hash.py --rev 4f2409c        # 28451191e5dcfc21
python3 -I $P/setup_trees.py 4f2409c c540277                                      # деревья head и main, data/ коммита
# R1: vitest (сделано: plan-tab 74/74, три файла 123/123)
(cd $SP/tree_4f2409c/analytics-mvp && npx vitest run src/scripts/plan-tab.test.ts src/scripts/gap-daily.test.ts src/scripts/funnel-tests.test.ts)
# U3: клиент в jsdom (сделано: 0 ошибок, 0 пустых из 20, клики работают, плашки 1/11/13/0/0)
(cd $SP/tree_4f2409c/analytics-mvp && npx tsx $P/render5.mts $SP/tree_4f2409c/analytics-mvp $DD 2026-10-15 $SP/r_head_1015.json)
# B1: независимый пересчёт статусов и скидки OZON (сделано: 25 из 25 = страница; price_now = prices_daily 14.10 у 25 из 25)
python3 -I $P/b1_indep.py $DD 2026-10-15 $SP/r_head_1015.json
# S1: пропуски срезов и смены цены без плана (сделано: prices_daily нет 22.09; 21.09 и 23.09 цена сменилась у 25 из 25)
python3 -I $P/s1_snapshots.py $DD
# T1: те же данные на датах сборки 15/16/22/23.10, head против main (сделано: 16.10 «не снижена» 4; 23.10 - 13 против «ждём» 10 на main)
bash $P/t1_timeline.sh
# НЕ СДЕЛАНО (в следующий запрос): smoke.ts страницы «Тесты», tsc, страница вне блока байт-в-байт (R3),
# мутанты priceStatus / классов чипа / ключей плашек клиента / фильтра gap_pct null, C3/C4 по диффу и decisions.md.
