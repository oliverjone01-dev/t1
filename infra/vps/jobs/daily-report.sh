# Сводка переезда в Telegram (группа алертов): что уже работает на сервере со ссылками,
# чем закончились задачи, что дальше по плану. Данных не пишет (ветка «-» в jobs.conf).
# Разделы и план - conf/report.conf, итоги задач - state/jobs/*.json (их пишет gg-job).
dom=${GG_DOMAIN:-dash.genglas.ru}
conf="$GG_OPS/conf/report.conf"
site=$(readlink -f "$GG_ROOT/www/current")
now=$(date +%s)
nl=$'\n'

ready=""
while IFS='|' read -r kind sec title; do
  kind=$(printf '%s' "$kind" | tr -d '[:space:]'); sec=$(printf '%s' "$sec" | tr -d '[:space:]')
  title=$(printf '%s' "$title" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [ "$kind" = ready ] || continue
  if [ -s "$site/$sec/index.html" ]; then ready+="${nl}• $title: https://$dom/$sec/"; fi
done < <(gg_conf_lines "$conf")

jobs=""
for f in "$GG_ROOT"/state/jobs/*.json; do
  [ -f "$f" ] || continue
  j=$(cat "$f")
  get() { printf '%s' "$j" | sed -n "s/.*\"$1\":\"\{0,1\}\([^\",}]*\).*/\1/p"; }
  [ "$(get name)" = "$GG_JOB" ] && continue
  fin=$(get finished); age=$(( (now - $(date -d "$fin" +%s 2>/dev/null || echo "$now")) / 3600 ))
  if [ "$(get ok)" = true ]; then res="✅ ok"; else res="❌ упала (код $(get rc))"; fi
  jobs+="${nl}• $(get name): $res, $age ч назад"
done

plan=$(gg_conf_lines "$conf" | awk -F'|' '{k=$1; gsub(/[[:space:]]/, "", k)} k=="plan" {sub(/^[^|]*\|[[:space:]]*/, ""); print "• " $0}')

msg="📋 Переезд на сервер: сводка $(date -u '+%d.%m %H:%M') UTC${nl}${nl}Работает на сервере:${ready:-${nl}• пока ничего}"
msg+="${nl}${nl}Задачи:${jobs:-${nl}• ещё не запускались}${nl}${nl}По плану:${nl}${plan}"
msg+="${nl}${nl}Вход по личному логину."
printf '%s\n' "$msg"
gg_alert "$msg"
