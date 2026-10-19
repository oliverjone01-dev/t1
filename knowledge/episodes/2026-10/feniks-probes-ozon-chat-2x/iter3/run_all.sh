#!/bin/bash
# ФЕНИКС iter3, PR #478: 754cf5c (e728601700d8c735) и голова 528604a (c5501fb533ac78c3). Воспроизведение проб iter3.
# Запись только в scratch (SP); фикстуры и jsdom iter1-2 переиспользуются из ../ и SP/dom.
P=/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-chat-2x
SP=/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad
mkdir -p $SP/c3
cd /home/user/t1 || exit 1
python3 -B .claude/skills/data-guard/scripts/audit_hash.py --rev 754cf5c    # e728601700d8c735
python3 -B .claude/skills/data-guard/scripts/audit_hash.py --rev 528604a    # c5501fb533ac78c3
cd analytics-mvp || exit 1
npx vitest run src/scripts/plan-tab.test.ts src/scripts/funnel-tests.test.ts src/scripts/gap-daily.test.ts   # 103/103 на 528604a
python3 -I $P/iter3/s4_tolerance.py          # S4 допуск 1 шт по прокси кабинета, 0 из 290
for s in cab3ok cab3edge2 cab3edge2not cab3tail cab3cov cab3hole cab3short cab3dup cab3dupr; do
  python3 -I $P/iter3/cab3_fixture.py $s; npx tsx $P/c7_render.mts new $SP/c3/fx_$s 2026-10-21 | grep -E 'warnings|Сверка'
done                                          # S3, B3, B1c, K4
npx tsx $P/iter3/g5_mixed.mts $SP/c3/fx_cab3edge2not 2026-10-21    # T2 зависимость от t
python3 -I $P/iter3/m1_mutants.py             # M1 мутанты assert неполной выгрузки
python3 -I $P/iter3/g3_msk.py; npx tsx $P/iter3/g3_page.mts        # G3 эталоны и путь страницы
python3 -I $P/iter3/p_live.py; python3 -I $P/iter3/p1_live.py      # P1/P5/P6 на живых
python3 -I $P/c5_fixture.py eve && mkdir -p $SP/c3/out_eve && DATA_DIR=$SP/fx_eve OUT_DIR=$SP/c3/out_eve npx tsx src/scripts/build-tests.ts > $SP/c3/build_eve.log 2>&1   # T1
cd /home/user/t1
python3 -I $P/iter3/r3_build.py 51f24d2 754cf5c; python3 -I $P/iter3/r3_build.py 51f24d2 528604a   # R3
python3 -I $P/iter3/c4_slop.py $SP/c3/slop_ev.json && bash .claude/hooks/anti-slop-checker.sh < $SP/c3/slop_ev.json
python3 -I $P/iter3/c4b_slop.py $SP/c3/slop2.json && bash .claude/hooks/anti-slop-checker.sh < $SP/c3/slop2.json
python3 -I $P/iter3/v2_withdrawn.py; python3 -I $P/iter3/v2_poisson.py; python3 -I $P/iter3/v2_pricecols.py   # V2, V3, U2
python3 -I $P/iter3/g4_l120.py                # L120: база 14 по UTC, 13 по МСК (для Ивана)
cd analytics-mvp && npx tsx $P/iter3/v2_render.mts 2026-10-15     # U1, U2 на живых
