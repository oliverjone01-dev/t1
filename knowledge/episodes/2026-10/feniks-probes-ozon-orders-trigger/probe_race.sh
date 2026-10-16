#!/bin/bash
# ФЕНИКС #484, проба R1: гонка push в шаге «Коммит данных в ветку» orders-backfill.yml (a8b1100d, строки 95-106).
# Песочница: голый origin + клон «раннера» в scratch, конкурентный коммит в origin после checkout раннера
# (как мак/бот/сессия во время сбора). Тело шага взято из YAML головы PR, ${{ }} подставлены как на push.
# Оболочка как у GitHub для shell: bash: bash --noprofile --norc -eo pipefail {0}. sleep заменён no-op.
set -u
B=/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/fx484/race
mkdir -p "$B"
R="$B/run-$(date +%s%N)"; mkdir -p "$R"
export HOME="$R/home"; mkdir -p "$HOME"
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$R/home/.gitconfig"
git config --global init.defaultBranch main
git config --global user.name probe; git config --global user.email probe@example.invalid
mkdir -p "$R/bin"; printf '#!/bin/sh\nexit 0\n' > "$R/bin/sleep"; chmod +x "$R/bin/sleep"

# 1. origin с main и файлами данных
git init -q --bare "$R/origin.git"
git clone -q "$R/origin.git" "$R/seed" 2>/dev/null
mkdir -p "$R/seed/analytics-mvp/data"
for f in orders_daily.ndjson orders_accrual_types.json pnl_sku_accrual_daily.ndjson acq_sku_daily.ndjson buyer_delivery_daily.ndjson buyer_delivery_orders.ndjson partner_daily.ndjson partner_orders.ndjson pnl_channel_accrual_daily.ndjson pnl_account_accrual_daily.ndjson coinv_calibration.json realization_monthly.ndjson pnl_account_accrual_types.json realization_daily.ndjson; do echo '{"v":0}' > "$R/seed/analytics-mvp/data/$f"; done
echo '{"t":"07:50"}' > "$R/seed/analytics-mvp/data/reakciya.json"
git -C "$R/seed" add -A; git -C "$R/seed" commit -qm "seed"; git -C "$R/seed" push -q origin HEAD:main

# 2. раннер: checkout (actions/checkout ref=main)
git clone -q "$R/origin.git" "$R/ws"
# 3. сбор: новые заказы в рабочей копии раннера
echo '{"v":1,"fresh":"orders 15.10"}' > "$R/ws/analytics-mvp/data/orders_daily.ndjson"
# 4. конкурент пушит в main во время сбора (мак, бот Маркета, сессия)
git clone -q "$R/origin.git" "$R/other"
echo '{"t":"other push"}' > "$R/other/analytics-mvp/data/other.json"
git -C "$R/other" add -A; git -C "$R/other" commit -qm "concurrent push"; git -C "$R/other" push -q origin HEAD:main

# 5. тело шага «Коммит данных в ветку» из YAML головы (git add списка сокращён до orders_daily)
YML=$(git -C /home/user/t1-wt show a8b1100d19f44c388f5506367b7766b89beb2cf8:.github/workflows/orders-backfill.yml)
STEP=$(printf '%s\n' "$YML" | python3 -I -c '
import sys, yaml
d = yaml.safe_load(sys.stdin.read())
for s in d["jobs"]["orders"]["steps"]:
    if s.get("name") == "Коммит данных в ветку":
        print(s["run"])
')
STEP=${STEP//'${{ github.event_name == '"'"'schedule'"'"' && '"'"'(ежедневный сбор)'"'"' || github.event_name == '"'"'push'"'"' && '"'"'(после съёма с мака)'"'"' || format('"'"'{0}..{1}'"'"', github.event.inputs.from, github.event.inputs.to) }}'/(после съёма с мака)}
STEP=${STEP//'${{ github.ref_name }}'/main}
printf '%s\n' "$STEP" > "$R/step.sh"
echo "--- тело шага после подстановки:"; cat "$R/step.sh"
echo "--- запуск (bash --noprofile --norc -eo pipefail), GITHUB_WORKSPACE=раннер"
(cd "$R/ws/analytics-mvp" && PATH="$R/bin:$PATH" GITHUB_WORKSPACE="$R/ws" bash --noprofile --norc -eo pipefail "$R/step.sh" > "$R/step.out" 2>&1); rc=$?
sed 's/^/   | /' "$R/step.out" | tail -12
echo "КОД ВОЗВРАТА ШАГА: $rc"
echo "--- origin/main после шага:"
git -C "$R/origin.git" log --oneline main
echo "orders_daily в origin/main: $(git -C "$R/origin.git" show main:analytics-mvp/data/orders_daily.ndjson)"
n=$(grep -c "rejected" "$R/step.out"); echo "отказов push в выводе: $n"

# 6. Контроль: то же с pull --rebase перед push (как в ozon-snapshots.yml:363-366)
git clone -q "$R/origin.git" "$R/ws2"
echo '{"v":2,"fresh":"orders 15.10"}' > "$R/ws2/analytics-mvp/data/orders_daily.ndjson"
echo '{"t":"other push 2"}' > "$R/other/analytics-mvp/data/other.json"
git -C "$R/other" commit -qam "concurrent push 2"; git -C "$R/other" push -q origin HEAD:main
sed 's#git push origin "HEAD:main" \&\& break#git pull -q --rebase origin main \&\& git push origin "HEAD:main" \&\& break#' "$R/step.sh" > "$R/step_fix.sh"
(cd "$R/ws2/analytics-mvp" && PATH="$R/bin:$PATH" GITHUB_WORKSPACE="$R/ws2" bash --noprofile --norc -eo pipefail "$R/step_fix.sh" > "$R/step_fix.out" 2>&1); rc2=$?
echo "КОНТРОЛЬ (pull --rebase): код $rc2, orders_daily в origin/main: $(git -C "$R/origin.git" show main:analytics-mvp/data/orders_daily.ndjson)"
echo "каталог пробы: $R"
