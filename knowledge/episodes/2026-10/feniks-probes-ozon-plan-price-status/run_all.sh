#!/bin/bash
# ФЕНИКС: PR #480, ветка claude/amazing-hawking-0trncq. Итерация 1 @ 4f2409c (раздел 5 «Цена», 28451191e5dcfc21) прервана
# координатором до вердикта. Итерация 2 @ 3810a26 (26fc0bdba53a48a9 = 4f2409c + ab2997f спидометры за месяц + 3810a26 подпись):
# GO 7.85, отчёт feniks-audit-ozon-plan-price-status-iter2-20261015.md / .json.
# Запись только в scratch (SP). Код - из коммитов (git archive), data/ - копия коммита 4f2409c (= 3810a26 по data/).
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status
SP=/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p5
DD=$SP/data_4f2409c/analytics-mvp/data
cd /home/user/t1 || exit 1
for r in 4f2409c ab2997f 3810a26; do echo "$r $(python3 -B .claude/skills/data-guard/scripts/audit_hash.py --rev $r)"; done
python3 -I $P/setup_trees.py 4f2409c c540277 3810a26                                   # деревья, data/ коммита
# R1: vitest (3810a26: plan-tab 73/73, три файла 122/122)
(cd $SP/tree_3810a26/analytics-mvp && npx vitest run src/scripts/plan-tab.test.ts src/scripts/gap-daily.test.ts src/scripts/funnel-tests.test.ts)
# R1b / R2 / R3: смоук-гейт деплоя, tsc, страница вне блока - main c540277 против головы
bash $P/r_gate.sh
# U3 + раздел 5: jsdom, плашки и таблица цены; B1 - независимый пересчёт (25 из 25)
(cd $SP/tree_3810a26/analytics-mvp && npx tsx $P/render5.mts $SP/tree_3810a26/analytics-mvp $DD 2026-10-15 $SP/r_3810a26_2026-10-15.json)
python3 -I $P/b1_indep.py $DD 2026-10-15 $SP/r_3810a26_2026-10-15.json
# S1 / T1: срезы цен, шум акций; статусы на датах сборки 15/16/22/23.10 (t1_timeline.sh - 4f2409c против main; на 3810a26 цена та же)
python3 -I $P/s1_snapshots.py $DD && bash $P/t1_timeline.sh
# U3 + W1 / W2: спидометры в jsdom и независимым кодом, финотчёт; W5 / W3 - фикстуры 29.10 и 04.11; F1 - мигание
(cd $SP/tree_3810a26/analytics-mvp && npx tsx $P/render6.mts $SP/tree_3810a26/analytics-mvp $DD 2026-10-15)
python3 -I $P/s2_gauges.py $DD
python3 -I $P/w5_fixture.py && bash $P/w5_run.sh
python3 -I $P/f1_flicker.py $DD
# M5: мутанты (живы 17 из 27)
python3 -I $P/m5_mutants.py
# C3 / C4: em dash и anti-slop с контролем
python3 -I $P/c5_slop.py $SP/slop_ev.json && bash .claude/hooks/anti-slop-checker.sh < $SP/slop_ev.json
python3 -I $P/c5_slop.py $SP/slop_ctl.json control && bash .claude/hooks/anti-slop-checker.sh < $SP/slop_ctl.json
