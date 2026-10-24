# shellcheck shell=bash
# Общая библиотека серверного контура GENGROUP (подключается через `. lib/gg.sh`).
# Раскладка на сервере (GG_ROOT, по умолчанию /srv/gg):
#   git/t1.git            - зеркало GitHub (bare), только код и история
#   src/<ветка>/<sha12>   - неизменяемые релизы веток (git worktree), src/<ветка>/current -> релиз
#   data/                 - живые данные (снимки Bitrix, OZON, ...), свой локальный git, в GitHub НЕ уходит
#   www/releases/<ts>     - собранный сайт, www/current -> релиз (корень nginx)
#   state/ logs/ cache/   - статусы задач, логи, кэш node_modules
# Секреты - /etc/gg/secrets.env (вне git), настройки контура - /etc/gg/gg.env.

[ -r /etc/gg/gg.env ] && . /etc/gg/gg.env

GG_ROOT=${GG_ROOT:-/srv/gg}
GG_GIT=${GG_GIT:-$GG_ROOT/git/t1.git}
GG_DATA=${GG_DATA:-$GG_ROOT/data}
GG_SECRETS=${GG_SECRETS:-/etc/gg/secrets.env}
GG_OPS_BRANCH=${GG_OPS_BRANCH:-main}
# Папка infra/vps того релиза, из которого запущен скрипт (bin/.. или lib/..)
GG_OPS=${GG_OPS:-$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)}
GG_BRANCHES_CONF=${GG_BRANCHES_CONF:-$GG_OPS/conf/branches.conf}
GG_JOBS_CONF=${GG_JOBS_CONF:-$GG_OPS/conf/jobs.conf}
GG_JOBS_DIR=${GG_JOBS_DIR:-$GG_OPS/jobs}
export GG_ROOT GG_GIT GG_DATA GG_SECRETS GG_OPS GG_OPS_BRANCH GG_BRANCHES_CONF GG_JOBS_CONF GG_JOBS_DIR

gg_log()  { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >&2; }
gg_warn() { gg_log "ВНИМАНИЕ: $*"; }
gg_die()  { gg_log "ОШИБКА: $*"; exit 1; }

# Команды контура пишут в /srv/gg (владелец gg), таймеры тоже работают от gg. Запуск от root
# оставил бы файлы root, и следующий плановый запуск упал бы на правах. Поэтому от root -
# перезапуск той же команды от gg (окружение, например ECON_FULL=1, сохраняется).
# Где пользователя gg нет (облачный тест), ничего не делает. GG_ALLOW_ROOT=1 - отключить.
gg_as_gg() {
  [ "$(id -u)" = 0 ] && [ -z "${GG_ALLOW_ROOT:-}" ] && id gg >/dev/null 2>&1 || return 0
  gg_log "запущено от root - выполняю от пользователя gg"
  cd / && exec runuser -u gg -- env HOME="$(getent passwd gg | cut -d: -f6)" USER=gg LOGNAME=gg "$(readlink -f "$0")" "$@"
}

# Имя ветки -> имя папки (claude/x -> claude__x)
gg_safe() { printf '%s' "$1" | sed 's#/#__#g'; }

gg_mkdirs() {
  mkdir -p "$GG_ROOT"/{git,src,www/releases,state/jobs,state/locks,logs/jobs,cache/nm} "$GG_DATA"
}

# Путь к текущему релизу ветки (для задач и шагов сборки сайта)
gg_src() {
  local d
  d="$GG_ROOT/src/$(gg_safe "$1")/current"
  [ -d "$d" ] || gg_die "нет релиза ветки $1 (запусти: gg-release $1)"
  readlink -f "$d"
}

# Фамилии ростера для гейтов персональных данных (академия, план-радар): как в deploy-pages.yml.
# Фамилия в открытом тексте публичной страницы = шаг падает, раздел остаётся прошлым.
# shellcheck disable=SC2034  # читают шаги сайта (30-plan, 31-academy)
GG_ROSTER_RE="Лакомова|Маслова|Кубанова|Лысенко|Лысанова|Шура-Бура|Платонова|Безмащук|Белов|Мавлина|Преснякова|Зазноба|Ерина|Лобова"

# Строки конфига без комментариев и пустых
gg_conf_lines() { sed -e 's/[[:space:]]*#.*$//' -e '/^[[:space:]]*$/d' "$1"; }

# Ветки, которые сервер держит в релизах: ветка контура + все из branches.conf
gg_branches() {
  { printf '%s\n' "$GG_OPS_BRANCH"; gg_conf_lines "$GG_BRANCHES_CONF" | awk '{print $1}'; } | awk '!seen[$0]++'
}

# Пути данных ветки (по одному в строке), относительно корня репозитория
gg_data_paths() {
  gg_conf_lines "$GG_BRANCHES_CONF" | awk -v b="$1" '$1==b{print $2}' | tr ',' '\n' | sed '/^$/d'
}

# Строка задачи из jobs.conf: name|branch|oncalendar|script|lock|site -> поля через TAB
gg_job_fields() {
  gg_conf_lines "$GG_JOBS_CONF" | awk -F'|' -v n="$1" '
    { for (i = 1; i <= NF; i++) { gsub(/^[ \t]+|[ \t]+$/, "", $i) } }
    $1 == n { print $1 "\t" $2 "\t" $3 "\t" $4 "\t" $5 "\t" $6; found = 1 }
    END { exit found ? 0 : 1 }'
}

gg_job_names() {
  gg_conf_lines "$GG_JOBS_CONF" | awk -F'|' '{ gsub(/^[ \t]+|[ \t]+$/, "", $1); print $1 }'
}

gg_load_secrets() {
  if [ -r "$GG_SECRETS" ]; then set -a; . "$GG_SECRETS"; set +a; else gg_warn "нет $GG_SECRETS"; fi
}

# Алерт в Telegram (если заданы GG_ALERT_BOT_TOKEN и GG_ALERT_CHAT_ID в secrets.env)
gg_alert() {
  [ -n "${GG_ALERT_BOT_TOKEN:-}" ] && [ -n "${GG_ALERT_CHAT_ID:-}" ] || { gg_warn "алерт не отправлен (нет токена): $*"; return 0; }
  curl -fsS -m 20 -X POST "https://api.telegram.org/bot${GG_ALERT_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${GG_ALERT_CHAT_ID}" \
    --data-urlencode "text=[$(hostname -s)] $*" >/dev/null || gg_warn "Telegram не принял алерт"
}

# Коммит данных в локальный git данных. Код 0 = были изменения, 1 = нечего коммитить.
# Второй аргумент (необязательный) - ограничить коммит папкой (например, данными одной ветки).
# Код возврата: 0 - закоммичено, 1 - изменений нет, 2 - сбой git (права, lock, «dubious ownership»).
# Сбой нельзя путать с «без изменений»: иначе снимок тихо не сохраняется (E027, fail-open).
gg_data_commit() {
  local msg=$1 scope=${2:-.} rc=0
  (
    flock -w 600 7 || exit 2
    git -C "$GG_DATA" add -A -- "$scope" || exit 2
    git -C "$GG_DATA" diff --cached --quiet; d=$?
    [ "$d" = 0 ] && exit 1
    [ "$d" = 1 ] || exit 2
    git -C "$GG_DATA" -c user.name=gg-server -c user.email=gg-server@localhost commit -q -m "$msg" || exit 2
  ) 7>"$GG_ROOT/state/locks/data.lock" || rc=$?
  [ "$rc" = 2 ] && gg_warn "коммит данных не удался (git: права, lock или владелец папки $GG_DATA)"
  return "$rc"
}

# Откат незакоммиченных изменений данных ветки (после упавшей задачи)
gg_data_revert() {
  local dir; dir=$(gg_safe "$1")
  (
    flock -w 600 7 || exit 1
    git -C "$GG_DATA" checkout -q -- "$dir" 2>/dev/null || true
    git -C "$GG_DATA" clean -fdq -- "$dir" 2>/dev/null || true
  ) 7>"$GG_ROOT/state/locks/data.lock"
}
