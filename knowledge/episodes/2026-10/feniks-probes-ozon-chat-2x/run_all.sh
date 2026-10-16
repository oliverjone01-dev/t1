#!/bin/bash
# ФЕНИКС, аудит PR #477 @ 889c35b (съём кабинета 2 раза в день). Воспроизведение всех проб.
# Пути scratch зашиты в скриптах (SP). База 628695b вынимается git show в scratch/base и scratch/base_tree
# (funnel-tests.ts, gap-daily.ts, src/paths.ts, src/scripts/plan-tab.ts и plan-tab/*), см. отчёт.
# jsdom: в analytics-mvp/node_modules не установлен, копия: npm install --prefix <scratch>/dom jsdom@25.
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-chat-2x
SP=/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad
cd /home/user/t1/analytics-mvp || exit 1
python3 -I $P/c1_live.py                    # живые файлы: дубли по ключам, поля full/ts/snap, acts
python3 -I $P/c2_ftdups.py                  # 146 «дублей» = пары групп агрегатов; строки против товаров
npx tsx $P/c3_regress.mts                   # R2 база/голова на живых + P1-P7
python3 -I $P/c4_keys.py                    # ключ инструкции для funnel_tests против живого файла
for s in eve contra eve2; do python3 -I $P/c5_fixture.py $s; done
for s in live eve contra eve2; do                 # сборка страницы «Тесты» в scratch
  D=$SP/fx_$s; [ $s = live ] && D=data
  mkdir -p $SP/out_$s; DATA_DIR=$D OUT_DIR=$SP/out_$s npx tsx src/scripts/build-tests.ts > $SP/build_$s.log 2>&1; echo "$s exit $?"
done
for s in dec28 dec27 cabok caboff cabcov; do python3 -I $P/c6_fixture_plan.py $s; done
for s in dec27 dec28; do for i in new base; do npx tsx $P/c7_render.mts $i $SP/fxp_$s 2026-10-29; done; done   # Z1
for s in cabok caboff cabcov; do npx tsx $P/c7_render.mts new $SP/fxp_$s 2026-10-21; done                     # S1, S2
python3 -I $P/c8_port.py && python3 -I $P/c8_fixture_iter3.py wipe3
for i in new base; do npx tsx $P/c7_render.mts $i $SP/fx_wipe3 2026-10-18; done                                # N7
python3 -I $P/c9_golden.py; python3 -I $P/c10_drift.py      # G1
python3 -I $P/c11_slop.py $SP/slop_ev.json && bash /home/user/t1/.claude/hooks/anti-slop-checker.sh < $SP/slop_ev.json
python3 -I $P/c12_postcheck.py               # I2
