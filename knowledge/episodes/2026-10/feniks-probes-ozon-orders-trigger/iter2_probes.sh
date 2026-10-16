#!/bin/bash
# ФЕНИКС #484 iter2 (голова ff3af7e4, код 39ea4f35): R1-R4 шаг коммита, T1-T3 повтор шагов начислений,
# L1 actionlint/hygiene на трёх файлах. Песочница в scratch, sleep - no-op, npx - подставной.
set -u
REV=ff3af7e4d4833a2441c0328c62137a5f343a80c2
B=/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/fx484
R="$B/iter2-$(date +%s%N)"; mkdir -p "$R/bin" "$R/home"
export HOME="$R/home" GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$R/home/.gitconfig"
git config --global init.defaultBranch main; git config --global user.name probe; git config --global user.email probe@example.invalid
printf '#!/bin/sh\necho "sleep $*" >> "%s/sleeps.log"\nexit 0\n' "$R" > "$R/bin/sleep"; chmod +x "$R/bin/sleep"
git -C /home/user/t1-wt show "$REV:.github/workflows/orders-backfill.yml" > "$R/ob.yml"
python3 -I - "$R" <<'PY'
import sys, yaml
R = sys.argv[1]
d = yaml.safe_load(open(R + "/ob.yml"))
steps = {s.get("name"): s for s in d["jobs"]["orders"]["steps"]}
run = steps["Коммит данных в ветку"]["run"]
run = run.replace("${{ github.event_name == 'schedule' && '(ежедневный сбор)' || github.event_name == 'push' && '(после съёма с мака)' || format('{0}..{1}', github.event.inputs.from, github.event.inputs.to) }}", "(после съёма с мака)")
run = run.replace("${{ github.ref_name }}", "main")
open(R + "/commit.sh", "w").write(run)
open(R + "/commit_mut.sh", "w").write(run.replace('git pull --rebase --autostash origin "main" && ', ""))
for sid in ("pnlsku", "acq", "pnlacc"):
    s = [x for x in d["jobs"]["orders"]["steps"] if x.get("id") == sid][0]
    r = s["run"].replace("${{ github.event.inputs.to }}", "").replace("${{ github.event.inputs.from || '2026-02-06' }}", "2026-02-06")
    open(f"{R}/acc_{sid}.sh", "w").write(r)
    print(sid, "continue-on-error:", s.get("continue-on-error"))
PY
FILES="orders_daily.ndjson orders_accrual_types.json pnl_sku_accrual_daily.ndjson acq_sku_daily.ndjson buyer_delivery_daily.ndjson buyer_delivery_orders.ndjson partner_daily.ndjson partner_orders.ndjson pnl_channel_accrual_daily.ndjson pnl_account_accrual_daily.ndjson coinv_calibration.json realization_monthly.ndjson pnl_account_accrual_types.json realization_daily.ndjson"
setup () { # dir
  local W="$1"; git init -q --bare "$W/origin.git"; git clone -q "$W/origin.git" "$W/seed" 2>/dev/null
  mkdir -p "$W/seed/analytics-mvp/data"; for f in $FILES; do echo '{"v":0}' > "$W/seed/analytics-mvp/data/$f"; done
  echo '{"lock":0}' > "$W/seed/analytics-mvp/package-lock.json"
  git -C "$W/seed" add -A; git -C "$W/seed" commit -qm seed; git -C "$W/seed" push -q origin HEAD:main
  git clone -q "$W/origin.git" "$W/ws"; git clone -q "$W/origin.git" "$W/other"
}
other_push () { # dir file content
  echo "$3" > "$1/other/$2"; git -C "$1/other" add -A; git -C "$1/other" commit -qm "concurrent $2"; git -C "$1/other" push -q origin HEAD:main
}
runstep () { # dir script
  (cd "$1/ws/analytics-mvp" && PATH="$R/bin:$PATH" GITHUB_WORKSPACE="$1/ws" bash --noprofile --norc -eo pipefail "$2" > "$1/out.txt" 2>&1); echo $?
}
report () { echo "$1: код $2; origin orders=$(git -C "$3/origin.git" show main:analytics-mvp/data/orders_daily.ndjson); коммитов в origin $(git -C "$3/origin.git" rev-list --count main); $(grep -c rejected "$3/out.txt") строк rejected; хвост: $(tail -n 1 "$3/out.txt")"; }
# R1: чужой push (не конфликтующий) после checkout
W="$R/r1"; mkdir -p "$W"; setup "$W"; echo '{"v":1}' > "$W/ws/analytics-mvp/data/orders_daily.ndjson"; other_push "$W" analytics-mvp/data/funnel_tests.ndjson '{"mac":1}'
rc=$(runstep "$W" "$R/commit.sh"); report "R1 чужой push, новый шаг" "$rc" "$W"
# R2: мутант без pull --rebase (должен стать красным)
W="$R/r2"; mkdir -p "$W"; setup "$W"; echo '{"v":1}' > "$W/ws/analytics-mvp/data/orders_daily.ndjson"; other_push "$W" analytics-mvp/data/funnel_tests.ndjson '{"mac":1}'
rc=$(runstep "$W" "$R/commit_mut.sh"); report "R2 мутант без pull" "$rc" "$W"
# R3: грязное дерево (package-lock.json от npm install, вне списка git add) + чужой push - autostash
W="$R/r3"; mkdir -p "$W"; setup "$W"; echo '{"v":1}' > "$W/ws/analytics-mvp/data/orders_daily.ndjson"; echo '{"lock":"npm install"}' > "$W/ws/analytics-mvp/package-lock.json"; other_push "$W" analytics-mvp/data/funnel_tests.ndjson '{"mac":1}'
rc=$(runstep "$W" "$R/commit.sh"); report "R3 грязное дерево + чужой push" "$rc" "$W"
# R4: конфликт: чужой коммит правит тот же файл заказов
W="$R/r4"; mkdir -p "$W"; setup "$W"; echo '{"v":1}' > "$W/ws/analytics-mvp/data/orders_daily.ndjson"; other_push "$W" analytics-mvp/data/orders_daily.ndjson '{"v":"other"}'
rc=$(runstep "$W" "$R/commit.sh"); report "R4 конфликт в orders_daily" "$rc" "$W"; echo "   rebase в процессе после шага: $(test -d "$W/ws/.git/rebase-merge" -o -d "$W/ws/.git/rebase-apply" && echo да || echo нет)"
# R5: без чужого push (обычный день)
W="$R/r5"; mkdir -p "$W"; setup "$W"; echo '{"v":1}' > "$W/ws/analytics-mvp/data/orders_daily.ndjson"
rc=$(runstep "$W" "$R/commit.sh"); report "R5 без гонки" "$rc" "$W"
# T1-T3: повтор шагов начислений (подставной npx: последовательность кодов)
for sid in pnlsku acq pnlacc; do
  for seq in "0" "1,0" "1,1,0" "1,1,1"; do
    T="$R/t-$sid-$(echo $seq | tr , _)"; mkdir -p "$T/bin" "$T/analytics-mvp"; : > "$T/calls"; : > "$R/sleeps.log"
    printf '#!/bin/bash\nn=$(wc -l < "%s/calls"); echo "$*" >> "%s/calls"\nIFS=, read -ra S <<< "%s"; c=${S[$n]:-1}; exit $c\n' "$T" "$T" "$seq" > "$T/bin/npx"; chmod +x "$T/bin/npx"
    (cd "$T/analytics-mvp" && PATH="$T/bin:$R/bin:$PATH" bash --noprofile --norc -eo pipefail "$R/acc_$sid.sh" > "$T/out" 2>&1); rc=$?
    echo "T $sid коды npx [$seq]: код шага $rc, вызовов $(wc -l < "$T/calls"), паузы: $(tr '\n' ' ' < "$R/sleeps.log")"
  done
done
head -n 1 "$R"/t-pnlsku-0/calls
# L1: actionlint + shellcheck и hygiene на трёх файлах головы
L="$R/lint/.github/workflows"; mkdir -p "$L"
for f in orders-backfill.yml ozon-snapshots.yml deploy-pages.yml; do git -C /home/user/t1-wt show "$REV:.github/workflows/$f" > "$L/$f"; done
(cd "$R/lint" && "$B/al/actionlint" -shellcheck "$B/sc/shellcheck_py-0.11.0.1.data/scripts/shellcheck" -no-color .github/workflows/orders-backfill.yml .github/workflows/ozon-snapshots.yml .github/workflows/deploy-pages.yml > "$R/al.txt" 2>&1; echo "actionlint rc=$?")
grep -E "^\.github" "$R/al.txt" | cut -c1-200
(cd "$R/lint" && python3 -I /home/user/t1-wt/tools/ci/workflow_hygiene.py .github/workflows/orders-backfill.yml .github/workflows/ozon-snapshots.yml .github/workflows/deploy-pages.yml > "$R/hy.txt"; echo "hygiene rc=$?"; grep -c "::warning" "$R/hy.txt"; grep -c "::error" "$R/hy.txt"; grep "orders-backfill" "$R/hy.txt" | sed 's/::warning file=//' | cut -c1-90)
python3 -I -c "import yaml,sys; d=yaml.safe_load(open('$L/ozon-snapshots.yml')); print('ozon on:', list(d[True].keys()))"
echo "каталог: $R"
