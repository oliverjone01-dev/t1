#!/usr/bin/env bash
# Воспроизведение проб ФЕНИКСА, аудит PR #490 iter2 (раздел 5 «Цена» вкладки «План с 15.10»), 2026-10-20.
# Код: голова iter2 299cc0c, голова iter1 49a7bf3 и база 74a3280 из git archive в scratch; данные - копия analytics-mvp/data
# (на 299cc0c, 49a7bf3 и 74a3280 data/ одинаковые). Пробы iter1 (без суффикса) не перезаписываются.
# Запуск из корня репозитория: bash knowledge/episodes/2026-10/feniks-probes-ozon-plan-sec5/run_all_iter2.sh [scratch_dir]
# Пишет только в scratch и в эту папку (файлы *_iter2). Реальные data/ и src/ не трогает.
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"
P="$REPO/knowledge/episodes/2026-10/feniks-probes-ozon-plan-sec5"
S="${1:-$(mktemp -d /tmp/feniks-plan-sec5-iter2.XXXXXX)}"
HEAD_REV=299cc0c; IT1_REV=49a7bf3; BASE_REV=74a3280
mkdir -p "$S/head" "$S/base" "$S/it1" "$S/data" "$S/out_head" "$S/out_base" "$S/out_it1"
EX=(':(exclude)analytics-mvp/data' ':(exclude)analytics-mvp/data-ym' ':(exclude)analytics-mvp/public' ':(exclude)analytics-mvp/exports')
git -C "$REPO" archive $HEAD_REV analytics-mvp "${EX[@]}" | tar -x -C "$S/head"
git -C "$REPO" archive $BASE_REV analytics-mvp "${EX[@]}" | tar -x -C "$S/base"
git -C "$REPO" archive $IT1_REV analytics-mvp "${EX[@]}" | tar -x -C "$S/it1"
cp -a "$REPO/analytics-mvp/data/." "$S/data/"
for t in head base it1; do cp -as "$REPO/analytics-mvp/node_modules" "$S/$t/analytics-mvp/node_modules"; done
{ echo "data/ на $HEAD_REV против рабочего дерева: $(git -C "$REPO" diff --stat $HEAD_REV -- analytics-mvp/data | tail -1)";
  echo "data/ $BASE_REV..$HEAD_REV: $(git -C "$REPO" diff --stat $BASE_REV $HEAD_REV -- analytics-mvp/data | tail -1)"; } > "$S/data_same.txt"

# хеш
{ echo "rev HEAD ($(git -C "$REPO" rev-parse --short HEAD)): $(python3 -I "$REPO/.claude/skills/data-guard/scripts/audit_hash.py" --rev HEAD)";
  echo "rev $HEAD_REV: $(python3 -I "$REPO/.claude/skills/data-guard/scripts/audit_hash.py" --rev $HEAD_REV)";
  echo "worktree: $(python3 -I "$REPO/.claude/skills/data-guard/scripts/audit_hash.py" --worktree)";
  echo "запрос: 4752851bf76c89a5";
  echo "пути ветки (merge-base origin/main..HEAD) минус traces/, knowledge/episodes/, knowledge/errors/, sessions/handoff/:";
  git -C "$REPO" diff --name-only "$(git -C "$REPO" merge-base origin/main HEAD)" HEAD | grep -vE '^(traces/|knowledge/episodes/|knowledge/errors/|sessions/handoff/)' | sed 's/^/  /';
  cat "$S/data_same.txt"; } > "$P/out_hash_iter2.txt"

# (а) сборка страницы на трёх ревизиях, одна копия data/
for t in head base it1; do
  (cd "$S/$t/analytics-mvp" && DATA_DIR="$S/data" OUT_DIR="$S/out_$t" FIXTURES_DIR="$S/$t/analytics-mvp/fixtures" npx tsx src/scripts/build-tests.ts) > "$P/out_build_${t}_iter2.txt" 2>&1
done
python3 -I "$P/p_a_build_compare.py" "$S/out_head/katya-tests.html" "$S/out_base/katya-tests.html" > "$P/out_a_build_compare_iter2.txt"
python3 -I "$P/p_a2_price_changes_independent.py" "$S/data" "$S/out_head/katya-tests.html" > "$P/out_a2_price_changes_iter2.txt"
python3 -I "$P/p_a3_iter1_vs_iter2.py" "$S/out_it1/katya-tests.html" "$S/out_head/katya-tests.html" > "$P/out_a3_iter1_vs_iter2.txt"
# (б) независимый счёт на живых данных, (д) шум и пороги
python3 -I "$P/p_b_orders_independent_iter2.py" "$S/data" "$S/out_head/katya-tests.html" > "$P/out_b_orders_independent_iter2.txt"
python3 -I "$P/p_d_noise_control_iter2.py" "$S/data" > "$P/out_d_noise_control_iter2.txt"
# (г) сценарии на фикстурах + независимый пересчёт каждого сценария
(cd "$S/head/analytics-mvp" && npx tsx "$P/p_g_scenarios_iter2.mts" "$S/head/analytics-mvp" "$S/data" "$S") > "$P/out_g_scenarios_iter2.txt" 2>&1
: > "$P/out_g_scen_recount_iter2.txt"
for d in "$S"/scen2_*; do
  { echo "######## $(basename "$d")"; python3 -I "$P/p_b_orders_independent_iter2.py" "$S/data" "$d/sec.html" "$d" || echo "ОШИБКА ПЕРЕСЧЁТА"; echo; } >> "$P/out_g_scen_recount_iter2.txt" 2>&1
done
# (е) tsc и vitest (дереву головы нужны data, data-ym, public, exports и ../.github)
git -C "$REPO" archive $HEAD_REV analytics-mvp/data-ym analytics-mvp/public analytics-mvp/exports .github | tar -x -C "$S/head"
git -C "$REPO" archive $BASE_REV analytics-mvp/data-ym analytics-mvp/public analytics-mvp/exports | tar -x -C "$S/base"
cp -a "$S/data" "$S/head/analytics-mvp/data"; cp -a "$S/data" "$S/base/analytics-mvp/data"
for t in head base; do (cd "$S/$t/analytics-mvp" && npx tsc --noEmit -p tsconfig.json) > "$S/tsc_$t.txt" 2>&1 || true; done
{ echo "errors head ($HEAD_REV): $(grep -c 'error TS' "$S/tsc_head.txt")  base ($BASE_REV): $(grep -c 'error TS' "$S/tsc_base.txt")";
  echo "в файлах PR (plan-tab.ts, plan-tab.test.ts) на голове:"; grep -E 'plan-tab(\.test)?\.ts' "$S/tsc_head.txt" || echo "  0";
  echo "наборы ошибок base/head (без позиций) совпадают:";
  diff <(grep 'error TS' "$S/tsc_base.txt" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort) <(grep 'error TS' "$S/tsc_head.txt" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort) && echo "  да"; } > "$P/out_tsc_iter2.txt"
(cd "$S/head/analytics-mvp" && npx vitest run src/scripts/plan-tab.test.ts) > "$P/out_vitest_plan_tab_iter2.txt" 2>&1 || true
(cd "$S/head/analytics-mvp" && npx vitest run) > "$P/out_vitest_full_iter2.txt" 2>&1 || true
# (м) мутационный тест проводки G1/G2
python3 -I "$P/p_m_mutants_iter2.py" "$S/head/analytics-mvp" > "$P/out_m_mutants_iter2.txt" 2>&1 || true
echo "scratch: $S"
