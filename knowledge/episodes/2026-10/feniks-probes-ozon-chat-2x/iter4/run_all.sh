#!/bin/bash
# ФЕНИКС iter4: ветка claude/amazing-hawking-0trncq, запрос @ 753bf11 (d7233195c3f64dc2), голова da0a36b (adcdcfd5420b7619, Codex P1).
# Воспроизведение проб iter4. Запись только в scratch (SP). Рабочее дерево во время аудита менялось параллельно,
# поэтому код берётся из коммитов (git archive), data/ - копия коммита 753bf11 (= da0a36b по data/).
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-chat-2x/iter4
SP=/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad
DD=$SP/data_753bf11/analytics-mvp/data
cd /home/user/t1 || exit 1
python3 -B .claude/skills/data-guard/scripts/audit_hash.py --rev 753bf11   # d7233195c3f64dc2
python3 -B .claude/skills/data-guard/scripts/audit_hash.py --rev da0a36b   # adcdcfd5420b7619
# деревья коммитов в scratch (git archive), data/ коммита, зависимости npm ci --ignore-scripts
python3 -I $P/setup_trees.py 753bf11 5c4f053 da0a36b && python3 -I $P/pin_data.py && python3 -I $P/link_tree.py da0a36b
(cd $SP/tree_753bf11/analytics-mvp && npm ci --ignore-scripts --no-audit --no-fund) && python3 -I $P/link_nm.py
# R1 / R1b / R2 / R3
(cd $SP/tree_da0a36b/analytics-mvp && npx vitest run src/scripts/plan-tab.test.ts src/scripts/funnel-tests.test.ts src/scripts/gap-daily.test.ts)   # 115/115
bash $P/r1_smoke.sh            # smoke-гейт деплоя: 753bf11 FAIL ReferenceError wkLast, da0a36b OK
bash $P/r2_tsc.sh              # tsc: 15 = 15, в plan-tab 0
python3 -I $P/r4_build.py && (cd $SP/tree_da0a36b/analytics-mvp && npx tsx $P/r4_outside.mts)   # вне блока «План» байт-в-байт
# U3: клиент блока в jsdom на трёх коммитах
cd $SP/tree_da0a36b/analytics-mvp && for i in base h753 head; do npx tsx $P/render4.mts $i $DD 2026-10-15 --brief; done
# V3: закрытие (независимый пересчёт, второй порядок, воспроизводимость, остатки выводимых)
cd /home/user/t1 && python3 -I $P/v4_base.py && python3 -I $P/v4_subst.py && python3 -I $P/v4_repro.py && python3 -I $P/v4_stock.py
# W: спидометр «Реклама за месяц»
python3 -I $P/v4_ads.py && (cd $SP/tree_da0a36b/analytics-mvp && npx tsx $P/a4_after_decision.mts)
# B1c: фикстуры сверки с кабинетом с реальным ts съёма
bash $P/run_cab4.sh
# M4: мутанты
python3 -I $P/m4_mutants.py
# C3 / C4, P1
python3 -I $P/c4_slop.py $SP/slop_ev.json && bash .claude/hooks/anti-slop-checker.sh < $SP/slop_ev.json
python3 -I $P/c4_slop.py $SP/slop_ctl.json control && bash .claude/hooks/anti-slop-checker.sh < $SP/slop_ctl.json
python3 -I $P/p1_live.py
