#!/usr/bin/env bash
# Воспроизведение проб ФЕНИКСА, PR #490 iter3: только подтверждение, что слияние origin/main 180b575 в ветку
# (голова 46cd4bf) не изменило проверенный в iter2 артефакт. 2026-10-20.
# Сборки страницы:
#   (a) код головы 46cd4bf + data/ головы (снимки main 4641e9d);
#   (b) код 299cc0c (проверен в iter2) + data/ головы;
#   (c) код 299cc0c + data/ на 74a3280 (данные iter2).
# Запуск из корня репозитория: bash knowledge/episodes/2026-10/feniks-probes-ozon-plan-sec5/run_all_iter3.sh [scratch_dir]
# Пишет только в scratch и в эту папку (файлы *_iter3). Реальные data/ и src/ не трогает, пробы iter1/iter2 не перезаписывает.
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"
P="$REPO/knowledge/episodes/2026-10/feniks-probes-ozon-plan-sec5"
S="${1:-$(mktemp -d /tmp/feniks-plan-sec5-iter3.XXXXXX)}"
HEAD_REV=46cd4bf; CODE_REV=299cc0c; OLD_BASE=74a3280; NEW_BASE=origin/main
PT=(analytics-mvp/src/scripts/plan-tab.ts analytics-mvp/src/scripts/plan-tab.test.ts)
AH="$REPO/.claude/skills/data-guard/scripts/audit_hash.py"
rm -rf "$S/head" "$S/c299" "$S/data_new" "$S/data_old" "$S/out_a" "$S/out_b" "$S/out_c"
mkdir -p "$S/head" "$S/c299" "$S/data_new" "$S/data_old" "$S/out_a" "$S/out_b" "$S/out_c"
EX=(':(exclude)analytics-mvp/data' ':(exclude)analytics-mvp/data-ym' ':(exclude)analytics-mvp/public' ':(exclude)analytics-mvp/exports')
git archive $HEAD_REV analytics-mvp "${EX[@]}" | tar -x -C "$S/head"
git archive $CODE_REV analytics-mvp "${EX[@]}" | tar -x -C "$S/c299"
git archive $HEAD_REV analytics-mvp/data | tar -x -C "$S/data_new" --strip-components=2
git archive $OLD_BASE analytics-mvp/data | tar -x -C "$S/data_old" --strip-components=2
for t in head c299; do cp -as "$REPO/analytics-mvp/node_modules" "$S/$t/analytics-mvp/node_modules"; done

# 1. хеш и blob путей ветки
{ echo "rev HEAD ($(git rev-parse --short HEAD)): $(python3 -I "$AH" --rev HEAD)"
  echo "rev $HEAD_REV: $(python3 -I "$AH" --rev $HEAD_REV)"
  echo "worktree: $(python3 -I "$AH" --worktree)"
  echo "rev $CODE_REV (iter2, go 8,0): $(python3 -I "$AH" --rev $CODE_REV)"
  echo "запрос: 3a19d7266e29c095"
  echo "worktree против HEAD по analytics-mvp/ и knowledge/decisions.md: $(git diff --stat HEAD -- analytics-mvp knowledge/decisions.md | tail -1)(пусто = нет правок)"
  echo "пути ветки с blob (минус traces/, knowledge/episodes/, knowledge/errors/, sessions/handoff/):"
  for r in $CODE_REV $HEAD_REV; do mb=$(git merge-base $NEW_BASE $r); echo "  rev $r, merge-base $(git rev-parse --short $mb):"
    git diff --name-only "$mb" $r | grep -vE '^(traces/|knowledge/episodes/|knowledge/errors/|sessions/handoff/)' | while read -r f; do echo "    $(git rev-parse --short=12 "$r:$f") $f"; done; done
} > "$P/out_hash_iter3.txt"

# 2. дифф кода iter2 против диффа к новому main; decisions.md и трейс после слияния
git diff $OLD_BASE $CODE_REV -- "${PT[@]}" > "$S/d_iter2.diff"
git diff $NEW_BASE $HEAD_REV -- "${PT[@]}" > "$S/d_head.diff"
{ echo "дифф кода: iter2 ($OLD_BASE..$CODE_REV) и к новому main ($NEW_BASE..$HEAD_REV), пути: ${PT[*]}"
  echo "  md5 с index:   $(md5sum < "$S/d_iter2.diff" | cut -c1-32)  $(md5sum < "$S/d_head.diff" | cut -c1-32)"
  echo "  md5 без index: $(grep -v '^index ' "$S/d_iter2.diff" | md5sum | cut -c1-32)  $(grep -v '^index ' "$S/d_head.diff" | md5sum | cut -c1-32)"
  if cmp -s "$S/d_iter2.diff" "$S/d_head.diff"; then echo "  побайтно равны, и со строками index"; else echo "  РАЗЛИЧАЮТСЯ"; fi
  echo "  строк: $(wc -l < "$S/d_iter2.diff") / $(wc -l < "$S/d_head.diff")"
  echo "  blob ($OLD_BASE / $NEW_BASE / $CODE_REV / $HEAD_REV):"
  for f in "${PT[@]}"; do echo "    $f: $(for r in $OLD_BASE $NEW_BASE $CODE_REV $HEAD_REV; do printf '%s ' "$(git rev-parse --short=12 "$r:$f")"; done)"; done
  echo "  файлы src/, которые main изменил после $OLD_BASE: $(git diff --name-only $OLD_BASE $NEW_BASE -- analytics-mvp/src | tr '\n' ' ')"
  echo
  python3 -I "$P/p_merge_iter3.py" $HEAD_REV $OLD_BASE $NEW_BASE $CODE_REV
  git show $HEAD_REV:traces/2026-10-20/agents.jsonl > "$S/trace_head.jsonl"
  echo "  схема agent-trace (голова): $(python3 -I schemas/validate.py agent-trace --jsonl "$S/trace_head.jsonl" 2>&1 | tail -1)"
} > "$P/out_merge_iter3.txt" 2>&1

# 3. данные: что принесли снимки main
python3 -I "$P/p_data_iter3.py" "$S/data_old" "$S/data_new" > "$P/out_data_iter3.txt"
{ echo; echo "коммит 4641e9d, файлы:"; git show --stat --format='%h %s' 4641e9d | sed 's/^/  /'; } >> "$P/out_data_iter3.txt"

# 4. сборки a, b, c
build() { (cd "$1/analytics-mvp" && DATA_DIR="$2" OUT_DIR="$3" FIXTURES_DIR="$1/analytics-mvp/fixtures" npx tsx src/scripts/build-tests.ts) > "$4" 2>&1; }
build "$S/head" "$S/data_new" "$S/out_a" "$P/out_build_a_iter3.txt"
build "$S/c299" "$S/data_new" "$S/out_b" "$P/out_build_b_iter3.txt"
build "$S/c299" "$S/data_old" "$S/out_c" "$P/out_build_c_iter3.txt"
python3 -I "$P/p_sec5_compare_iter3.py" "$S/out_a/katya-tests.html" "$S/out_b/katya-tests.html" "$S/out_c/katya-tests.html" > "$P/out_sec5_compare_iter3.txt"

# 5. независимый пересчёт раздела 5 на голове (скрипт iter2 без изменений) и сравнение с выводом iter2
python3 -I "$P/p_b_orders_independent_iter2.py" "$S/data_new" "$S/out_a/katya-tests.html" > "$P/out_b_orders_independent_iter3.txt"
{ echo "вывод независимого пересчёта iter3 (голова, новые снимки) против iter2 (299cc0c, данные 74a3280):"
  if diff "$P/out_b_orders_independent_iter2.txt" "$P/out_b_orders_independent_iter3.txt"; then echo "  ОДИНАКОВЫ побайтно"; fi
} >> "$P/out_sec5_compare_iter3.txt"

# 6. тест файла PR на дереве головы (полный прогон - CI, п.7); тесту нужна data/ в дереве (читает data/ от cwd)
cp -a "$S/data_new" "$S/head/analytics-mvp/data"
(cd "$S/head/analytics-mvp" && npx vitest run src/scripts/plan-tab.test.ts) > "$P/out_vitest_plan_tab_iter3.txt" 2>&1 || true

# 7. CI по API
{ echo "check-runs на $(git rev-parse $HEAD_REV):"
  gh api "repos/oliverjone01-dev/t1/commits/$(git rev-parse $HEAD_REV)/check-runs" --jq '.check_runs[] | [.name, .status, .conclusion, .started_at, .completed_at, .details_url] | @tsv' 2>&1 || echo "  нет сети / нет gh"
  echo "workflow runs по head_sha:"
  gh api "repos/oliverjone01-dev/t1/actions/runs?head_sha=$(git rev-parse $HEAD_REV)" --jq '.workflow_runs[] | [.id, .name, .event, .status, .conclusion, .run_number, .head_branch] | @tsv' 2>&1 || echo "  нет сети / нет gh"
  for rid in $(gh api "repos/oliverjone01-dev/t1/actions/runs?head_sha=$(git rev-parse $HEAD_REV)" --jq '.workflow_runs[].id' 2>/dev/null); do
    echo "шаги прогона $rid:"
    gh api "repos/oliverjone01-dev/t1/actions/runs/$rid/jobs" --jq '.jobs[] | .steps[] | "  \(.number) \(.name): \(.conclusion)"' 2>&1 || true
  done
  echo "PR #490:"
  gh api repos/oliverjone01-dev/t1/pulls/490 --jq '[.state, .head.ref, .head.sha, .base.ref, .base.sha, .mergeable_state, .merged] | @tsv' 2>&1 || echo "  нет сети / нет gh"
} > "$P/out_ci_iter3.txt"
echo "scratch: $S"
