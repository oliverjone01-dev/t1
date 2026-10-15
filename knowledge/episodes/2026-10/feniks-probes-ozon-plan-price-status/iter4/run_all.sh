#!/bin/bash
# ФЕНИКС iter4, PR #481 @ ba5b560 (audit_hash fe21110678075a4b, 5 путей поверх main b55e514): GO 7.80,
# отчёт feniks-audit-ozon-plan-price-status-iter4-20261015.md / .json. Итерация 3 (e063381) остановлена до вердикта, пробы в ../iter3.
# Запись только в scratch. Код - из коммитов (git archive), data/ - копия коммита 4f2409c (= ba5b560 по data/).
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status/iter4
SC=/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad
DD=$SC/p5/data_4f2409c/analytics-mvp/data
T=$SC/p7/tree_ba5b560/analytics-mvp
cd /home/user/t1 || exit 1
python3 -B .claude/skills/data-guard/scripts/audit_hash.py --rev ba5b560                       # fe21110678075a4b
python3 -I $P/setup_iter4.py                                                                     # дерево головы; main = p5/tree_3810a26
(cd $T && npx vitest run src/scripts/plan-tab.test.ts)                                           # R1: 79/79
bash $P/r_gate4.sh                                                                               # R1b смоук exit 0 оба; R2 tsc 15 = 15; R3 вне блока байт-в-байт
python3 -I $P/s4_gauges.py $DD                                                                   # B1: 170/104, 219,5/151, 14,76/10,35, 812 862/453 018, факта нет
python3 -I $P/g1_fixture.py && (cd $T && npx tsx $P/render8.mts $T $SC/p7/g1.jsonl $(cat $SC/p7/g1_pairs.txt))   # G1 / W6 фикстуры
(cd $T && npx tsx $P/render8.mts $T $SC/p7/b4.jsonl $(cat $SC/p6/b4_pairs.txt) $SC/p5/fx_below1:2026-10-29 $SC/p5/fx_exact:2026-10-29 $SC/p5/fx_nov:2026-11-04)   # W5 / B2 / W3
python3 -I $P/g1_summary.py $SC/p7/g1.jsonl $SC/p7/b4.jsonl                                     # G1: 62 из 111 расходятся; W5: 37 из 37 = таблица 1
grep -o "Спидометры - за месяц, с 1-го числа[^<]*" $SC/p7/out_ba5b560/katya-tests.html | cut -c1-120   # B4: «Как считаем» по v5
python3 -I $P/f1_period.py $DD                                                                   # F1: ровно в план 51-54% зелёных дней, 2,2 смены
python3 -I $P/m7_mutants.py                                                                      # T4 / M5: живы 23 из 33
python3 -I $P/c7_slop.py $SC/p7/slop_ev.json && bash .claude/hooks/anti-slop-checker.sh < $SC/p7/slop_ev.json   # C3 0, C4 0, D1 0
python3 -I $P/c7_slop.py $SC/p7/slop_ctl.json control && bash .claude/hooks/anti-slop-checker.sh < $SC/p7/slop_ctl.json   # контроль срабатывает
