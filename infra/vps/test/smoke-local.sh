#!/usr/bin/env bash
# Локальная проверка контура без сервера: поднимает «сервер» во временной папке, «GitHub»
# подменяет локальной копией репозитория и прогоняет полный цикл:
#   выкат веток (gg-poll) -> сайт -> задача с данными -> падение задачи с откатом -> откат сайта
#   -> новый коммит в «GitHub» (данные сервера переживают выкат кода) -> генерация таймеров.
# Запуск из корня репозитория: bash infra/vps/test/smoke-local.sh
# Нужны локально ветки-источники пилота: git fetch origin rop-dashboard-v1 office-dashboard-v1
# ВАЖНО: без «cmd | grep -q» - при pipefail grep -q выходит на первом совпадении,
# cmd получает SIGPIPE (код 141) и проверка падает случайно. Только grep -q <<<"$(cmd)".
set -euo pipefail
REPO=$(git rev-parse --show-toplevel)
export GIT_AUTHOR_NAME=gg-smoke GIT_AUTHOR_EMAIL=gg-smoke@localhost GIT_COMMITTER_NAME=gg-smoke GIT_COMMITTER_EMAIL=gg-smoke@localhost
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
pass() { printf '  ok  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; exit 1; }

# --- «GitHub»: bare-репозиторий на объектах локального клона (без копирования) ---
GH="$T/github.git"
git init -q --bare "$GH"
echo "$REPO/.git/objects" >"$GH/objects/info/alternates"
# ветка контура = HEAD + текущее (возможно незакоммиченное) содержимое infra/vps
export GIT_INDEX_FILE="$T/index"
git -C "$REPO" read-tree HEAD
git -C "$REPO" add infra/vps
tree=$(git -C "$REPO" write-tree)
unset GIT_INDEX_FILE
ops=$(git -C "$REPO" commit-tree "$tree" -p HEAD -m "gg smoke: контур из рабочей копии")
git --git-dir="$GH" update-ref refs/heads/gg-smoke-ops "$ops"
for b in rop-dashboard-v1 office-dashboard-v1 manager-lakomova; do
  sha=$(git -C "$REPO" rev-parse -q --verify "origin/$b" || git -C "$REPO" rev-parse -q --verify "$b") \
    || fail "нет ветки $b локально: git fetch origin $b"
  git --git-dir="$GH" update-ref "refs/heads/$b" "$sha"
done

# --- «сервер» ---
export GG_ROOT="$T/srv"
export GG_OPS_BRANCH=gg-smoke-ops GG_SKIP_NPM=1 GG_NO_TIMERS=1 GG_SECRETS="$T/secrets.env"
: >"$GG_SECRETS"
mkdir -p "$GG_ROOT/git"
git clone -q --bare --shared "$GH" "$GG_ROOT/git/t1.git"
git --git-dir="$GG_ROOT/git/t1.git" config remote.origin.fetch '+refs/heads/*:refs/heads/*'
git init -q -b main "$GG_ROOT/data"
git -C "$GG_ROOT/data" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
BIN="$REPO/infra/vps/bin"
# страницы менеджеров собирает задача rop-snapshot (node) - в тесте кладём готовую
mkdir -p "$GG_ROOT/cache/site-managers/rop-smoke"
echo '<html>smoke-mgr</html>' >"$GG_ROOT/cache/site-managers/rop-smoke/index.html"
printf 'rop-smoke\tСмоук Тестов\n-\tНовичок Безсделок\n' >"$GG_ROOT/cache/site-managers/roster.tsv"

echo "1. Первый выкат (gg-poll)"
"$BIN/gg-poll" 2>"$T/poll.log" || { cat "$T/poll.log"; fail "gg-poll"; }
W="$GG_ROOT/www/current"
[ -s "$W/rop/index.html" ] && pass "/rop/ собран" || fail "/rop/ нет"
[ -s "$W/rop2/index.html" ] && pass "/rop2/ собран" || fail "/rop2/ нет"
[ -s "$W/rop/v.txt" ] && pass "штамп /rop/v.txt: $(cat "$W/rop/v.txt")" || fail "v.txt пуст"
[ -s "$W/office/index.html" ] && pass "/office/ собран" || fail "/office/ нет"
[ -s "$W/status/index.html" ] && pass "/status/ собран" || fail "/status/ нет"
[ -s "$W/rop-smoke/index.html" ] && grep -q "^rop-smoke	Смоук Тестов$" "$W/.gg/managers.txt" && pass "/rop-<фамилия>/ собран, список записан" || fail "менеджеры"
ROPSRC="$GG_ROOT/src/rop-dashboard-v1/current"
[ -L "$ROPSRC/analytics-mvp/rop/data" ] && pass "данные РОПа в релизе - ссылка на /srv/gg/data" || fail "нет ссылки на данные"
DATAHTML="$GG_ROOT/data/rop-dashboard-v1/analytics-mvp/public/rop-command.html"
[ -s "$DATAHTML" ] && pass "данные засеяны из git" || fail "данные не засеяны"
grep -q seed <<<"$(git -C "$GG_ROOT/data" log --oneline)" && pass "засев закоммичен в git данных" || fail "нет seed-коммита"

echo "2. Задача: успех -> коммит данных -> пересборка сайта"
mkdir -p "$T/jobs"
cat >"$T/jobs/ok.sh" <<'EOF'
echo '<!-- smoke-ok -->' >> analytics-mvp/public/rop-command.html
EOF
cat >"$T/jobs/bad.sh" <<'EOF'
echo '<!-- smoke-bad -->' >> analytics-mvp/public/rop-command.html
exit 3
EOF
cat >"$T/jobs.conf" <<'EOF'
smoke-ok  | rop-dashboard-v1 | *-*-* 00/3:17:00 UTC | ok.sh  | b24-rop | yes
smoke-bad | rop-dashboard-v1 | *-*-* 04:00:00 UTC   | bad.sh | b24-rop | yes
EOF
export GG_JOBS_CONF="$T/jobs.conf" GG_JOBS_DIR="$T/jobs"
site_before=$(readlink -f "$W")
"$BIN/gg-job" smoke-ok >"$T/job.log" 2>&1 || { cat "$T/job.log"; fail "smoke-ok"; }
grep -q smoke-ok "$W/rop/index.html" && pass "изменение данных попало на сайт" || fail "сайт не обновился"
[ "$(readlink -f "$W")" != "$site_before" ] && pass "новая сборка сайта" || fail "сборка не сменилась"
grep -q "job smoke-ok" <<<"$(git -C "$GG_ROOT/data" log -1 --format=%s)" && pass "данные закоммичены" || fail "нет коммита данных"
grep -q '"ok":true' "$GG_ROOT/state/jobs/smoke-ok.json" && pass "статус ok записан" || fail "статус"

echo "3. Задача: падение -> откат данных, сайт не трогаем"
site_before=$(readlink -f "$W")
if "$BIN/gg-job" smoke-bad >"$T/job.log" 2>&1; then fail "smoke-bad должна была упасть"; fi
grep -q smoke-bad "$DATAHTML" && fail "данные не откатились" || pass "незакоммиченные данные откатились"
[ "$(readlink -f "$W")" = "$site_before" ] && pass "сайт не пересобирался" || fail "сайт пересобрался после падения"
grep -q '"ok":false' "$GG_ROOT/state/jobs/smoke-bad.json" && pass "статус падения записан" || fail "статус"

echo "4. Откат сайта"
"$BIN/gg-site" --rollback 2>/dev/null
grep -q smoke-ok "$W/rop/index.html" && fail "откат не сработал" || pass "gg-site --rollback вернул прошлую сборку"
"$BIN/gg-site" 2>/dev/null

echo "5. Новый коммит кода в «GitHub»: код обновился, данные сервера на месте"
old=$(cat "$ROPSRC/.gg-release-ok")
new=$(git --git-dir="$GH" commit-tree "$(git --git-dir="$GH" rev-parse "rop-dashboard-v1^{tree}")" -p "$old" -m "smoke: новый коммит")
git --git-dir="$GH" update-ref refs/heads/rop-dashboard-v1 "$new"
"$BIN/gg-poll" 2>"$T/poll.log" || { cat "$T/poll.log"; fail "gg-poll 2"; }
[ "$(cat "$GG_ROOT/src/rop-dashboard-v1/current/.gg-release-ok")" = "$new" ] && pass "релиз переключён на новый коммит" || fail "релиз не сменился"
grep -q smoke-ok "$W/rop/index.html" && pass "данные сервера пережили выкат кода" || fail "данные потерялись"

echo "6. Генерация таймеров (dry-run)"
out=$(GG_SYSTEMD_DIR="$T/units" "$REPO/infra/vps/sbin/gg-apply-timers" --dry-run 2>&1) || { echo "$out"; fail "gg-apply-timers"; }
grep -q "OnCalendar=\*-\*-\* 00/3:17:00 UTC" <<<"$out" && pass "таймер smoke-ok сгенерирован" || { echo "$out"; fail "таймер"; }
mkdir -p "$T/units" && touch "$T/units/gg-job-smoke-ok.timer" "$T/units/gg-job-old.timer"
out=$(GG_SYSTEMD_DIR="$T/units" "$REPO/infra/vps/sbin/gg-apply-timers" --dry-run 2>&1)
if grep -q "удаляю таймер old" <<<"$out" && ! grep -q "удаляю таймер smoke-ok" <<<"$out"; then
  pass "удаляется только таймер задачи, которой нет в jobs.conf"
else
  echo "$out"; fail "удаление таймеров"
fi
printf 'x;rm -rf / | rop | * * * | a.sh | g | no\n' >"$T/evil.conf"
if GG_JOBS_CONF="$T/evil.conf" GG_SYSTEMD_DIR="$T/units" "$REPO/infra/vps/sbin/gg-apply-timers" --dry-run >/dev/null 2>&1; then
  fail "плохое имя задачи прошло проверку"
else
  pass "плохое имя задачи отклонено"
fi

echo "7. Шаг сборки упал -> раздел остаётся из прошлой сборки"
OFFHTML="$GG_ROOT/data/office-dashboard-v1/analytics-mvp/public/office-command.html"
mv "$OFFHTML" "$T/office.bak"
"$BIN/gg-site" 2>/dev/null
[ -s "$W/office/index.html" ] && pass "/office/ перенесён из прошлой сборки" || fail "/office/ пропал с сайта"
grep -q '"failed":1' "$W/.gg/build.json" && pass "падение шага видно в build.json" || fail "build.json"
mv "$T/office.bak" "$OFFHTML"

echo "8. Запуск из папки без прав (как sudo -u gg из /root)"
# root читает любую папку: забираем у него это право, иначе проверка ничего не проверяет
nopriv=()
[ "$(id -u)" = 0 ] && nopriv=(setpriv "--inh-caps=-dac_override,-dac_read_search" "--bounding-set=-dac_override,-dac_read_search")
mkdir "$T/noperm"
if (cd "$T/noperm" && chmod 000 . && "${nopriv[@]}" "$BIN/gg-release" rop-dashboard-v1 2>"$T/noperm.log"); then
  pass "gg-release не зависит от папки вызова"
else
  chmod 755 "$T/noperm"; cat "$T/noperm.log"; fail "gg-release упал из папки без прав"
fi
chmod 755 "$T/noperm"

echo "9. Служебная задача без данных (ветка «-»): сводка в Telegram"
cp "$REPO/infra/vps/jobs/daily-report.sh" "$T/jobs/"
printf 'daily-report | - | *-*-* 05:47:00 UTC | daily-report.sh | report | no\n' >>"$T/jobs.conf"
echo '<!-- smoke-dirty -->' >>"$DATAHTML"
data_before=$(git -C "$GG_ROOT/data" rev-parse HEAD)
"$BIN/gg-job" daily-report >"$T/report.log" 2>&1 || { cat "$T/report.log"; fail "daily-report"; }
grep -q "РОП: https://dash.genglas.ru/rop/" "$T/report.log" && pass "в сводке раздел РОП со ссылкой" || { cat "$T/report.log"; fail "сводка без РОП"; }
grep -q "smoke-ok: ✅ ok" "$T/report.log" && pass "в сводке итоги задач" || { cat "$T/report.log"; fail "сводка без задач"; }
grep -q "Волна 2" "$T/report.log" && pass "в сводке план" || fail "сводка без плана"
grep -q "✅ Смоук Тестов: https://dash.genglas.ru/rop-smoke/" "$T/report.log" && pass "в сводке менеджер со ссылкой" || { cat "$T/report.log"; fail "сводка без менеджеров"; }
grep -q "⚠️ Новичок Безсделок: страница не собрана" "$T/report.log" && pass "в сводке несобранный менеджер" || { cat "$T/report.log"; fail "сводка: несобранный"; }
[ "$(git -C "$GG_ROOT/data" rev-parse HEAD)" = "$data_before" ] && grep -q smoke-dirty "$DATAHTML" \
  && pass "данные не закоммичены и не откачены" || fail "служебная задача тронула данные"
grep -q '"ok":true' "$GG_ROOT/state/jobs/daily-report.json" && pass "статус сводки записан" || fail "статус сводки"

echo "10. Менеджеры: шаг упал -> разделы по списку из прошлой сборки"
mv "$GG_ROOT/cache/site-managers" "$T/mgr.bak"
"$BIN/gg-site" 2>/dev/null
[ -s "$W/rop-smoke/index.html" ] && pass "/rop-smoke/ перенесён из прошлой сборки" || fail "менеджер пропал с сайта"
grep -q "^rop-smoke	" "$W/.gg/managers.txt" && pass "список менеджеров перенесён" || fail "список менеджеров"
grep -q 22-managers "$W/.gg/build.json" && pass "падение шага менеджеров видно в build.json" || fail "build.json менеджеров"
mv "$T/mgr.bak" "$GG_ROOT/cache/site-managers"

echo "ВСЁ ЗЕЛЁНОЕ"
