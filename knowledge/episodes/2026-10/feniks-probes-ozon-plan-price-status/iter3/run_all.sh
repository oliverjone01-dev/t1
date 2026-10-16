#!/bin/bash
# ФЕНИКС iter3, ветка claude/amazing-hawking-0trncq @ e063381 (audit_hash 44662f80704eb119, 5 путей поверх main b55e514).
# АУДИТ ОСТАНОВЛЕН КООРДИНАТОРОМ ДО ВЕРДИКТА (15.10): Иван поменял постановку спидометров («план до конца месяца по каждому
# спидометру с 15.10 и факт за этот период, факт 01-14.10 справочно»), код #481 меняется. Вердикта и AUDITED нет.
# Результаты ниже - промежуточные, на e063381; для нового кода пробы перегнать, шаблоны мутантов обновить по новым строкам.
# Запись только в scratch. Код - из коммитов (git archive), data/ - копия коммита 4f2409c (= e063381 по data/).
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status/iter3
SC=/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad
DD=$SC/p5/data_4f2409c/analytics-mvp/data
T=$SC/p6/tree_e063381/analytics-mvp
cd /home/user/t1 || exit 1
python3 -B .claude/skills/data-guard/scripts/audit_hash.py --rev e063381                       # 44662f80704eb119
python3 -I $P/setup_iter3.py                                                                     # дерево головы; main = p5/tree_3810a26
(cd $T && npx vitest run src/scripts/plan-tab.test.ts)                                           # R1: 77/77; полный набор 655 против 651 на main, 21 падение одно и то же (среда scratch)
bash $P/r_gate3.sh                                                                               # R1b смоук exit 0 оба; R2 tsc 15 = 15; R3 вне блока байт-в-байт
python3 -I $P/s3_gauges.py $DD                                                                   # W6/W5 своим кодом: 453 018 / 453 018 / pre / 1 265 880; n_in 0; x1,5 красный с 21.10, x1,3 в октябре не красный
(cd $T && npx tsx $P/render7.mts $T $SC/p6/u3_live.jsonl $DD:2026-10-15 $DD:2026-10-16 $DD:2026-10-17 $DD:2026-10-23)   # U3: 0 ошибок, 0 из 20 пустых
python3 -I $P/b4_fixture.py && (cd $T && npx tsx $P/render7.mts $T $SC/p6/b4.jsonl $(cat $SC/p6/b4_pairs.txt)) && python3 -I $P/b4_summary.py $SC/p6/b4.jsonl   # B4: 34 из 34 = таблица 1
(cd $T && npx tsx $P/render7.mts $T $SC/p6/w5.jsonl $SC/p5/fx_below1:2026-10-29 $SC/p5/fx_exact:2026-10-29 $SC/p5/fx_nov:2026-11-04)   # W5: 0 из 10 / 10 из 10 / 10 из 10
python3 -I $P/w6_fixture.py && (cd $T && npx tsx $P/render7.mts $T $SC/p6/w6.jsonl $(cat $SC/p6/w6_pairs.txt))   # W6: x1,5 105/119/121/130%; main 73/92/95/109%
python3 -I $P/f1_window.py $DD                                                                   # F1: ровно в план 3,3 смены цвета за дни 3-14; день 14 = правило 29.10 в 100%
python3 -I $P/m6_mutants.py                                                                      # T4: убиты S15, A1 (zz=wkLast), W5d-f; живы P11 P12 S1' S9 S10' S11 W6a W6b W6c W5a W5b W5c W5g
python3 -I $P/m6b_iter2_alive.py                                                                 # M5: 10 из 10 живых iter2 живы
python3 -I $P/c6_slop.py $SC/p6/slop_ev.json && bash .claude/hooks/anti-slop-checker.sh < $SC/p6/slop_ev.json   # C3 0, C4 0, D1 0; контроль срабатывает
