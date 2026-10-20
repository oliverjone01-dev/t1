#!/usr/bin/env bash
# Git / text probes for iter2 of the audit of PR #489 (code head e1c3a62, iter1 head e0aab10a, base 81764e4).
# Read-only on the repo; writes only <scratch dir>/added_iter2.txt. Usage: bash misc_gm_iter2.sh <scratch dir>
set -u
S=$1
cd /home/user/t1 || exit 1
H=e1c3a62; P=e0aab10a; B=81764e4
echo "== H1 hash"
for m in "--rev HEAD" "--rev $H" "--worktree"; do echo "  $m: $(python3 -I .claude/skills/data-guard/scripts/audit_hash.py $m)"; done
echo "  --rev $P (iter1): $(python3 -I .claude/skills/data-guard/scripts/audit_hash.py --rev $P)"
echo "  HEAD=$(git rev-parse --short=8 HEAD) remote branch=$(git ls-remote origin refs/heads/claude/amazing-hawking-0trncq | cut -c1-8) remote main=$(git ls-remote origin refs/heads/main | cut -c1-8) merge-base=$(git merge-base origin/main HEAD | cut -c1-8)"
echo "  git status --porcelain lines: $(git status --porcelain | grep -c .)"
echo "  paths of the branch at $H (minus excluded):"
git diff --name-only "$(git merge-base origin/main $H)" $H | grep -vE '^(traces/|knowledge/episodes/|knowledge/errors/|sessions/handoff/)' | sed 's/^/    /'
echo "  paths changed $P..$H (minus excluded):"
git diff --name-only $P $H | grep -vE '^(traces/|knowledge/episodes/|knowledge/errors/|sessions/handoff/)' | sed 's/^/    /'
echo "  paths changed $H..HEAD (all):"
git diff --name-only $H HEAD | sed 's/^/    /'
for c in $(git rev-list $H..HEAD); do echo "  $(git log -1 --format='%h' $c): [skip ci] in message $(git log -1 --format=%B $c | grep -c '\[skip ci\]')"; done
echo "  $H: [skip ci] in message $(git log -1 --format=%B $H | grep -c '\[skip ci\]')"
echo "== T3 CI"
gh api "repos/oliverjone01-dev/t1/actions/runs/39394762646" --jq '"  run \(.run_number) \(.name): \(.status) \(.conclusion), head \(.head_sha[0:8]), event \(.event)"' 2>&1
gh api "repos/oliverjone01-dev/t1/commits/$(git rev-parse $H)/check-runs" --jq '.check_runs[] | "  check-run \(.name): \(.status) \(.conclusion) id \(.id)"' 2>&1
gh api "repos/oliverjone01-dev/t1/pulls/489" --jq '"  PR #489 \(.state), head \(.head.sha[0:8]), base \(.base.sha[0:8]), mergeable_state \(.mergeable_state)"' 2>&1
echo "== texts at $H"
echo "  stale procedure in gap-daily.ts (через markNoSite / строке в gap_daily ставится no_site): $(git show $H:analytics-mvp/src/scripts/gap-daily.ts | grep -cE 'через markNoSite|строке в gap_daily ставится no_site')"
echo "  'весь день' in src/spec/decisions: $(git grep -c 'весь день' $H -- analytics-mvp/src knowledge/semantic knowledge/decisions.md | tr '\n' ' ')"
echo "  old chip name 'выпал из бустинга' in src/spec/tools: $(git grep -l 'выпал из бустинга' $H -- analytics-mvp/src knowledge/semantic analytics-mvp/tools | wc -l) files; in decisions: base $(git show $B:knowledge/decisions.md | grep -c 'выпал из бустинга'), head $(git show $H:knowledge/decisions.md | grep -c 'выпал из бустинга')"
echo "  commits that introduced 'OZON не доплачивает?' into decisions.md: $(git log --format=%h -S'OZON не доплачивает?' -- knowledge/decisions.md | tr '\n' ' ')"
echo "  live test: existsSync guard on manual file:"; git show $H:analytics-mvp/src/scripts/gap-daily.test.ts | grep -n 'GAP_MANUAL_FILE)' | sed 's/^/    /' | cut -c1-160
echo "  build log line:"; git show $H:analytics-mvp/src/scripts/build-tests.ts | grep -n 'НЕ НАЙДЕН' | sed 's/^/    /' | cut -c1-200
echo "  manual applies only to price == ours:"; git show $H:analytics-mvp/src/scripts/gap-daily.ts | grep -n 'priceEqualsOurs(r)) {' | sed 's/^/    /' | cut -c1-200
echo "  test-4 stop line threshold:"; git show $H:analytics-mvp/src/scripts/build-tests.ts | grep -n '?? 99) < 10' | sed 's/^/    /' | cut -c1-200
echo "  placebo filter (exact zero):"; git show $H:analytics-mvp/src/scripts/gap-daily.test.ts | grep -n 'gap_pct === 0' | sed 's/^/    /' | cut -c1-200
echo "== C3 / C4 / D1 on lines added $P..$H and the self-check"
# Author lines only: 7883816 (my iter1 report and probes, incl. the phrase list of misc_gm.sh) sits between $P and $H.
git diff $P $H -- . ':(exclude)knowledge/episodes/2026-10/feniks-audit-ozon-gap-manual-20261020.md' ':(exclude)knowledge/episodes/2026-10/feniks-audit-ozon-gap-manual-20261020.json' ':(exclude)knowledge/episodes/2026-10/feniks-probes-ozon-gap-manual' ':(exclude)traces' | grep '^+' | grep -v '^+++' > "$S/added_iter2.txt"
SC=knowledge/episodes/2026-10/ozon-testy-scripts/v8/selfcheck-gap-manual.md
echo "  added lines: $(wc -l < "$S/added_iter2.txt"); U+2014 added $(grep -c $'\xe2\x80\x94' "$S/added_iter2.txt"), self-check $(grep -c $'\xe2\x80\x94' $SC)"
n=0
while IFS= read -r p; do c=$(cat "$S/added_iter2.txt" $SC | grep -ciF -- "$p"); n=$((n+c)); done <<'EOF'
в мире современного дизайна
не секрет, что
на протяжении веков
является неотъемлемой частью
позволяет создать
высокое качество
опытные специалисты
индивидуальный подход
доступные цены
гармонично вписывается
идеальное решение
квинтэссенция
широкий ассортимент
инновационный
революционный
непревзойдённый
удвоит бизнес
выстрелит
взорвёт рынок
выглядит хорошо
отлично подойдёт
EOF
echo "  anti-slop hits (21 phrases): $n"
echo "  self-claimed X/10 in added lines and self-check: $(cat "$S/added_iter2.txt" $SC | grep -cE '[0-9][.,][0-9]+ ?/ ?10')"
