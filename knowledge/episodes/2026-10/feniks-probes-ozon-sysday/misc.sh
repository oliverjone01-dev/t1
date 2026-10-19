#!/usr/bin/env bash
# H1 (hash), CI on the PR heads, mac format of coinv_daily, em dash / anti-slop / self-score on the diff.
# Usage: bash misc.sh. Read-only on the repo; prints to stdout.
set -u
R=/home/user/t1
cd "$R" || exit 1
echo "# H1 audit_hash"
for rev in HEAD 30abf83 5324cf4; do echo "$rev $(python3 -I .claude/skills/data-guard/scripts/audit_hash.py --rev $rev)"; done
echo "worktree $(python3 -I .claude/skills/data-guard/scripts/audit_hash.py --worktree)"
echo "merge-base $(git merge-base origin/main HEAD | cut -c1-7), origin/main $(git rev-parse --short origin/main)"
echo "hash paths:"; git diff --name-only "$(git merge-base origin/main HEAD)" HEAD | grep -vE '^(traces/|knowledge/episodes/|knowledge/errors/|sessions/handoff/)'
echo "30abf83 paths:"; git show --name-only --format= 30abf83
echo "# CI: check-runs on PR heads (none = not run)"
for c in 30abf83 5324cf4; do echo "$c: $(gh api "repos/oliverjone01-dev/t1/commits/$(git rev-parse $c)/check-runs" --jq '.total_count' 2>&1)"; done
echo "head commit message: $(git log -1 --format=%s 5324cf4)"
echo "# coinv_daily: rows in the mac format (fields snap/ts, never written by mergeCoinv)"
echo "rows with snap: $(grep -c '"snap"' analytics-mvp/data/coinv_daily.ndjson) of $(grep -c . analytics-mvp/data/coinv_daily.ndjson)"
git show 23b70ce -- analytics-mvp/data/coinv_daily.ndjson | grep '^+{' | head -1 | cut -c1-260
echo "# diff hygiene (30abf83 added lines + self-check)"
TMP=$(mktemp)
git show 30abf83 | grep '^+' > "$TMP"; cat knowledge/episodes/2026-10/ozon-testy-scripts/v8/selfcheck-k2-p1-l3.md >> "$TMP"
echo "added lines: $(git show 30abf83 | grep -c '^+[^+]'), U+2014: $(grep -c $'\xe2\x80\x94' "$TMP")"
n=0; for pat in 'в мире современного дизайна' 'не секрет, что' 'на протяжении веков' 'является неотъемлемой частью' 'позволяет создать' 'высокое качество' 'опытные специалисты' 'индивидуальный подход' 'доступные цены' 'гармонично вписывается' 'идеальное решение' 'квинтэссенция' 'широкий ассортимент' 'инновационный' 'революционный' 'непревзойдённый' 'удвоит бизнес' 'выстрелит' 'взорвёт рынок' 'выглядит хорошо' 'отлично подойдёт'; do n=$((n + $(grep -ciF -- "$pat" "$TMP"))); done
echo "anti-slop hits (21 phrases): $n"
echo "self-claimed X.X/10: $(grep -cE '[0-9]\.[0-9]+ ?/ ?10' "$TMP")"
rm -f "$TMP"
echo "# texts: three surfaces of the same stop signal at HEAD"
git grep -n "выпал из бустинга?\|похоже, выпал из Эластичного бустинга" HEAD -- analytics-mvp/src/scripts/plan-tab.ts | cut -c1-160
git grep -n -o "Стоп, вернуть цену: доля показов за день ниже половины базы 3 дня подряд или товар выпал из «Эластичного бустинга»" HEAD -- analytics-mvp/tools/tests/tests.json | cut -c1-200
git grep -n -o "выход из «Эластичного бустинга» разрыв не обваливает" HEAD -- knowledge/semantic/metrics/ozon-price-test-gap-shift.yaml
git grep -n -o "OZON перестал доплачивать, вернуть цену; если это сбой витрины на один день, строке в gap_daily ставится no_site" HEAD -- analytics-mvp/src/scripts/build-tests.ts
echo "# decisions 19.10 p.(4) still without the accrued 87 of 90 caveat; p.(6) floor 50 under Ivan's header"
git grep -n -o "01-14.10: 135 из 146 заказов в ±2%[^;]*" HEAD -- knowledge/decisions.md | cut -c1-200
echo "87 из 90 in decisions: $(git show HEAD:knowledge/decisions.md | grep -c '87 из 90')"
git grep -n -o "(6) Иван 19.10 после ФЕНИКСА iter4 (go 8,35; K2, вариант «рекомендую»): системный день - если цена сайта равна нашей у 90% строк дня и больше при полном срезе (не меньше 50 строк" HEAD -- knowledge/decisions.md | cut -c1-260
echo "# WARNING text in build-tests hardcodes 90%"
git grep -n "WARNING" HEAD -- analytics-mvp/src/scripts/build-tests.ts | cut -c1-170
