#!/usr/bin/env bash
# Воспроизведение проб ФЕНИКСА, аудит PR #490 (раздел 5 «Цена» вкладки «План с 15.10»), 2026-10-20.
# Код головы 49a7bf3 и базы 74a3280 из git archive в scratch, данные - копия analytics-mvp/data (= 49a7bf3 = 74a3280).
# Запуск из корня репозитория: bash knowledge/episodes/2026-10/feniks-probes-ozon-plan-sec5/run_all.sh [scratch_dir]
# Пишет только в scratch и в эту папку. Реальные data/ и src/ не трогает.
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"
P="$REPO/knowledge/episodes/2026-10/feniks-probes-ozon-plan-sec5"
S="${1:-$(mktemp -d /tmp/feniks-plan-sec5.XXXXXX)}"
mkdir -p "$S/head" "$S/base" "$S/data" "$S/out_head" "$S/out_base"
EX=(':(exclude)analytics-mvp/data' ':(exclude)analytics-mvp/data-ym' ':(exclude)analytics-mvp/public' ':(exclude)analytics-mvp/exports')
git -C "$REPO" archive 49a7bf3 analytics-mvp "${EX[@]}" | tar -x -C "$S/head"
git -C "$REPO" archive 74a3280 analytics-mvp "${EX[@]}" | tar -x -C "$S/base"
cp -a "$REPO/analytics-mvp/data/." "$S/data/"
cp -as "$REPO/analytics-mvp/node_modules" "$S/head/analytics-mvp/node_modules"
cp -as "$REPO/analytics-mvp/node_modules" "$S/base/analytics-mvp/node_modules"

# хеш
{ echo "rev HEAD: $(python3 -I "$REPO/.claude/skills/data-guard/scripts/audit_hash.py" --rev HEAD)";
  echo "rev 49a7bf3: $(python3 -I "$REPO/.claude/skills/data-guard/scripts/audit_hash.py" --rev 49a7bf3)";
  echo "worktree: $(python3 -I "$REPO/.claude/skills/data-guard/scripts/audit_hash.py" --worktree)"; } > "$P/out_hash.txt"

# (а) сборка страницы на голове и базе
for t in head base; do
  (cd "$S/$t/analytics-mvp" && DATA_DIR="$S/data" OUT_DIR="$S/out_$t" FIXTURES_DIR="$S/$t/analytics-mvp/fixtures" npx tsx src/scripts/build-tests.ts) > "$P/out_build_$t.txt" 2>&1
done
python3 -I "$P/p_a_build_compare.py" "$S/out_head/katya-tests.html" "$S/out_base/katya-tests.html" > "$P/out_a_build_compare.txt"
python3 -I "$P/p_a2_price_changes_independent.py" "$S/data" "$S/out_head/katya-tests.html" > "$P/out_a2_price_changes.txt"
# (б) (в) (г) (д)
python3 -I "$P/p_b_orders_independent.py" "$S/data" "$S/out_head/katya-tests.html" > "$P/out_b_orders_independent.txt"
python3 -I "$P/p_d_noise_control.py" "$S/data" > "$P/out_d_noise_control.txt"
python3 -I "$P/p_g2_names.py" "$S/data" > "$P/out_g2_names.txt"
(cd "$S/head/analytics-mvp" && npx tsx "$P/p_g_scenarios.mts" "$S/head/analytics-mvp" "$S/data" "$S") > "$P/out_g_scenarios.txt" 2>&1
# (е) tsc и vitest (дереву головы нужны data, data-ym, public, exports и ../.github)
git -C "$REPO" archive 49a7bf3 analytics-mvp/data-ym analytics-mvp/public analytics-mvp/exports .github | tar -x -C "$S/head"
cp -a "$S/data" "$S/head/analytics-mvp/data"
for t in head base; do (cd "$S/$t/analytics-mvp" && npx tsc --noEmit -p tsconfig.json) > "$S/tsc_$t.txt" 2>&1 || true; done
{ echo "errors head: $(grep -c 'error TS' "$S/tsc_head.txt")  base: $(grep -c 'error TS' "$S/tsc_base.txt")";
  echo "в файлах PR (plan-tab.ts, plan-tab.test.ts, build-tests.ts) на голове:"; grep -E 'plan-tab(\.test)?\.ts|build-tests\.ts' "$S/tsc_head.txt" || echo "  0";
  echo "наборы ошибок base/head (без позиций) совпадают:";
  diff <(grep 'error TS' "$S/tsc_base.txt" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort) <(grep 'error TS' "$S/tsc_head.txt" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort) && echo "  да"; } > "$P/out_tsc.txt"
(cd "$S/head/analytics-mvp" && npx vitest run src/scripts/plan-tab.test.ts) > "$P/out_vitest_plan_tab.txt" 2>&1
(cd "$S/head/analytics-mvp" && npx vitest run) > "$P/out_vitest_full.txt" 2>&1 || true
echo "scratch: $S"
