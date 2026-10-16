#!/bin/bash
# ФЕНИКС iter5, PR #482 @ 381f11d5 (audit_hash 3fc874ed10dd7cb7 = голова PR afc411aa, 5 путей поверх main 9a3a212): GO 7.95,
# отчёт feniks-audit-ozon-plan-iter5-20261015.md / .json. Запись только в scratch. Код - из коммитов (git archive из /home/user/t1-wt),
# data/ - архив 381f11d5 (= 9a3a212 по data/), node_modules - автора (/home/user/t1-wt/analytics-mvp/node_modules).
SC=/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad
P=$SC/out/iter5                      # в репозитории: knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status/iter5
I4=/home/user/t1-wt/knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status/iter4
T=$SC/p8/tree_381f11d5/analytics-mvp
cd /home/user/t1-wt || exit 1
python3 -B .claude/skills/data-guard/scripts/audit_hash.py --rev 381f11d5                      # H1: 3fc874ed10dd7cb7 (и --rev afc411aa)
python3 -I $P/setup_iter5.py                                                                    # деревья 381f11d5 и 9a3a212
(cd $T && npx vitest run src/scripts/plan-tab.test.ts)                                          # R1: 81/81
bash $P/r_gate5.sh                                                                              # R1b смоук exit 0 оба; R2 tsc 15 -> 16; R3 вне блока байт-в-байт
python3 -I $P/fixtures_iter5.py                                                                 # семейства iter4 (g1, w6, b4, w5) + ранние e1/e2 (16.10, 17.10)
for k in g1 b4 w5 early; do (cd $T && npx tsx $P/render9.mts $T $SC/p8/r9_$k.jsonl $(cat $SC/p8/pairs_$k.txt)); done
python3 -I $I4/g1_summary.py $SC/p8/r9_g1.jsonl $SC/p8/r9_b4.jsonl $SC/p8/r9_w5.jsonl            # G1 по букве iter4: 5 из 149 (допуск 0,8), G1+W6 0 из 38; «на пути» 55 из 55
python3 -I $P/g1_strict.py $SC/p8/r9_g1.jsonl $SC/p8/r9_b4.jsonl $SC/p8/r9_w5.jsonl            # G2 строго: в дуге чужого цвета 0 из 149
python3 -I $P/g1_strict.py $SC/p8/r9_early.jsonl                                                # G3: e1_y 16.10 - 3 спидометра без жёлтой дуги
node $P/g1_grid.mjs $T/src/scripts/plan-tab/plan-tab.client.js head                             # G2/G3/G5 сетка: 0 / 108 (n=1) / 3
python3 -I $P/codex_fix_sim.py && node $P/g1_grid.mjs $SC/p8/client_codexfix.js codexfix        # G4: фикс Codex 108 -> 0
python3 -I $P/m8_mutants.py                                                                     # M8 / T4: убиты 18 из 39, G1a и V5c убиты, G1b и G1c живы
python3 -I $P/c8_slop.py $SC/p8/slop_ev.json && bash .claude/hooks/anti-slop-checker.sh < $SC/p8/slop_ev.json     # C3 0, C4 0, D1 0
python3 -I $P/c8_slop.py $SC/p8/slop_ctl.json control && bash .claude/hooks/anti-slop-checker.sh < $SC/p8/slop_ctl.json   # контроль срабатывает
python3 schemas/validate.py audit-report $SC/out/feniks-audit-ozon-plan-iter5-20261015.json       # VALID
python3 -I $P/trace_iter5.py && python3 schemas/validate.py agent-trace --jsonl $SC/out/traces-2026-10-16-agents.line.jsonl
