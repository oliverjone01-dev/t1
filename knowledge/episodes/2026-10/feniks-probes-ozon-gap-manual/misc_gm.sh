#!/usr/bin/env bash
# Git / text probes for the audit of PR #489 (head e0aab10a, base 81764e4). Read-only on the repo.
# Usage: bash misc_gm.sh <scratch dir>
set -u
S=$1
cd /home/user/t1 || exit 1
H=e0aab10a; B=81764e4
echo "== H1 hash"
for m in "--rev HEAD" "--rev $H" "--worktree"; do echo "  $m: $(python3 -B .claude/skills/data-guard/scripts/audit_hash.py $m)"; done
echo "  HEAD=$(git rev-parse --short=8 HEAD) origin/main=$(git rev-parse --short=8 origin/main) merge-base=$(git merge-base origin/main $H | cut -c1-8)"
echo "  paths of the branch (minus excluded):"; git diff --name-only "$(git merge-base origin/main $H)" $H | grep -vE '^(traces/|knowledge/episodes/|knowledge/errors/|sessions/handoff/)' | sed 's/^/    /'
echo "  commit message [skip ci]: $(git log -1 --format=%B $H | grep -c '\[skip ci\]')"
echo "== M1 mac autocommits (author GENGLASS srez) on origin/main"
echo "  count: $(git log origin/main --author='GENGLASS srez' --format=%h | wc -l), first: $(git log origin/main --author='GENGLASS srez' --format=%ad --date=iso | tail -1)"
echo "  statuses: $(git log origin/main --author='GENGLASS srez' --name-status --format='' | awk '{print $1}' | sort | uniq -c | tr '\n' ' ')"
echo "  unique paths: $(git log origin/main --author='GENGLASS srez' --name-only --format='' | sort -u | grep -c .)"
echo "  gap_manual among them: $(git log origin/main --author='GENGLASS srez' --name-only --format='' | grep -c gap_manual)"
for c in e3968750 c2c0aeba; do echo "  $c: $(git show --name-only --format='' $c | grep -c .) files, gap_manual $(git show --name-only --format='' $c | grep -c gap_manual)"; done
FIRST=$(git log origin/main --author='GENGLASS srez' --format=%H | tail -1)
echo "  data files added by others after the first mac autocommit, present at $H:"
for f in $(git log origin/main --diff-filter=A --name-only --format='' "$FIRST"..origin/main -- analytics-mvp/data/ | sort -u); do echo "    $f $(git cat-file -e $H:$f 2>/dev/null && echo present || echo MISSING)"; done
echo "== T3 CI head (gh api)"
gh api "repos/oliverjone01-dev/t1/commits/$(git rev-parse $H)/check-runs" --jq '.check_runs[] | "  \(.name): \(.status) \(.conclusion) id \(.id)"' 2>&1
echo "== texts"
echo "  'весь день' in src/spec/decisions: $(git grep -c 'весь день' $H -- analytics-mvp/src knowledge/semantic knowledge/decisions.md | tr '\n' ' ')"
echo "  old chip name: $(git grep -c 'выпал из бустинга' $H -- analytics-mvp/src knowledge/semantic knowledge/decisions.md analytics-mvp/tools | wc -l) files"
echo "  stale procedure text in gap-daily.ts (метка no_site в gap_daily / через markNoSite):"
git show $H:analytics-mvp/src/scripts/gap-daily.ts | grep -nE 'берут строки через markNoSite|строке в gap_daily ставится no_site|W1, открыто Ивану' | sed 's/^/    /' | cut -c1-200
echo "  live test early return on absent manual file:"
git show $H:analytics-mvp/src/scripts/gap-daily.test.ts | grep -n 'existsSync("data/" + GAP_MANUAL_FILE)' | sed 's/^/    /' | cut -c1-200
echo "  window in build-tests.ts:"; git show $H:analytics-mvp/src/scripts/build-tests.ts | grep -nE 'GAP_LAST_ANY =|GAP_RECENT =' | sed 's/^/    /' | cut -c1-200
echo "== C3 / C4 / D1 on added lines and self-check"
git diff $B..$H | grep '^+' | grep -v '^+++' > "$S/added.txt"
SC=knowledge/episodes/2026-10/ozon-testy-scripts/v8/selfcheck-gap-manual.md
echo "  added lines: $(wc -l < "$S/added.txt"); U+2014 added $(grep -c $'\xe2\x80\x94' "$S/added.txt"), self-check $(grep -c $'\xe2\x80\x94' $SC)"
n=0
while IFS= read -r p; do c=$(cat "$S/added.txt" $SC | grep -ciF -- "$p"); n=$((n+c)); done <<'EOF'
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
echo "  self-claimed X/10: $(cat "$S/added.txt" $SC | grep -cE '[0-9][.,][0-9]+ ?/ ?10')"
