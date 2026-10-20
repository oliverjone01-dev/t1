#!/usr/bin/env bash
# H1 (hash and coverage), T3 (CI on head), W1 (mac rewrites gap_daily), texts. Read-only; prints to stdout.
# Usage: bash misc2.sh   (from any directory; repo is /home/user/t1)
set -u
R=/home/user/t1
g() { git -C "$R" "$@"; }
H=$R/.claude/skills/data-guard/scripts/audit_hash.py
echo "== H1 hash"
echo "HEAD $(g rev-parse --short HEAD)  origin/main $(g rev-parse --short origin/main)  merge-base $(g merge-base origin/main 10049c0 | cut -c1-7)"
for a in "--rev HEAD" "--rev 10049c0" "--worktree"; do echo "audit_hash $a = $(cd "$R" && python3 -B "$H" $a)"; done
echo "-- hash paths (branch diff minus excluded)"
g diff --name-only "$(g merge-base origin/main 10049c0)" 10049c0 | grep -vE '^(traces/|knowledge/episodes/|knowledge/errors/|sessions/handoff/)'
P=$(g diff --name-only "$(g merge-base origin/main 10049c0)" 10049c0 | grep -vE '^(traces/|knowledge/episodes/|knowledge/errors/|sessions/handoff/)' | tr '\n' ' ')
echo "-- main ada2e83..12808f9 touching hash paths: [$(g diff --name-only ada2e83 12808f9 -- $P | tr '\n' ' ')]"
echo "-- 2f5cd50..958b0a2 (merge of main) touching hash paths: [$(g diff --name-only 2f5cd50 958b0a2 -- $P | tr '\n' ' ')]"
echo "-- 30abf83..2f5cd50 touching hash paths: [$(g diff --name-only 30abf83 2f5cd50 -- $P | tr '\n' ' ')]"
echo "-- files of 10049c0:"; g show --name-only --format= 10049c0
echo
echo "== T3 CI"
for c in 10049c0 e3968750 c2c0aeba 23b70ce3; do
  sha=$(g rev-parse "$c")
  echo "$c $(g log -1 --format='%an %ci' "$c"): $(cd "$R" && gh api "repos/:owner/:repo/commits/$sha/check-runs?per_page=50" --jq '[.check_runs[] | select(.name|test("vitest")) | "\(.name) \(.conclusion)"] | join("; ")' 2>&1)"
done
echo
echo "== W1 mac rewrites gap_daily (labels of #487)"
echo "no_site labels in gap_daily: ada2e83 $(g show ada2e83:analytics-mvp/data/gap_daily.ndjson | grep -c '"no_site": *true'), e3968750^ $(g show e3968750^:analytics-mvp/data/gap_daily.ndjson | grep -c '"no_site": *true'), e3968750 $(g show e3968750:analytics-mvp/data/gap_daily.ndjson | grep -c '"no_site": *true'), HEAD $(g show HEAD:analytics-mvp/data/gap_daily.ndjson | grep -c '"no_site": *true')"
echo "e3968750 removed label lines: $(g show e3968750 --format= -- analytics-mvp/data/gap_daily.ndjson | grep -c '^-.*"no_site": *true'); changed rows by date:"
g show e3968750 --format= -- analytics-mvp/data/gap_daily.ndjson | grep -E '^[-+]\{' | cut -c1-22 | sort | uniq -c
echo "no_site labels in coinv_daily: ada2e83 $(g show ada2e83:analytics-mvp/data/coinv_daily.ndjson | grep -c '"no_site": *true'), HEAD $(g show HEAD:analytics-mvp/data/coinv_daily.ndjson | grep -c '"no_site": *true')"
echo
echo "== texts"
echo "-- old chip name «выпал из бустинга?» at 10049c0:"; g grep -n "выпал из бустинга?" 10049c0 -- analytics-mvp/src knowledge/decisions.md | cut -c1-140
echo "-- «весь день» surfaces:"; g grep -n "весь день" 10049c0 -- analytics-mvp/src/scripts/gap-daily.ts analytics-mvp/src/scripts/build-tests.ts knowledge/semantic/metrics/ozon-price-test-gap-shift.yaml | cut -c1-160
echo "-- hardcoded thresholds in page/log texts (build-tests.ts):"; g grep -n "90% строк\|15-90%" 10049c0 -- analytics-mvp/src/scripts/build-tests.ts | cut -c1-120
echo "-- decisions п.(6) fragments:"
g show 10049c0:knowledge/decisions.md | sed -n 6p | grep -o "читатель и слияние пишут warning и плашку на странице\|Зона 15-90% - значения как есть, warning и плашка (как SAME_BEFORE_WARN у снимка цен)\|(б) плашка в любой системный день, решение не менять - сделано\|ставит автор ветки или тот, кто правит данные\|по начисленным, 87 из 90 отгруженных\|coinv:merge"
echo "-- self-check: «см. ниже» and what follows:"; grep -n "см. ниже" "$R/knowledge/episodes/2026-10/ozon-testy-scripts/v8/selfcheck-k2-p1-l3.md" | cut -c1-60; tail -n 1 "$R/knowledge/episodes/2026-10/ozon-testy-scripts/v8/selfcheck-k2-p1-l3.md"
echo "-- em dash in added lines of 10049c0: $(g diff 958b0a2 10049c0 | grep '^+' | grep -c $'\xe2\x80\x94')"
