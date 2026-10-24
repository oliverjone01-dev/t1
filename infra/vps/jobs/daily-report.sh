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
# Дашборды менеджеров: как блок «Дашборды менеджеров» в РОП - по каждому продавцу ссылка и готовность
mgrs=""
if [ -s "$site/.gg/managers.txt" ]; then
  while IFS=$'\t' read -r s n; do
    [ -n "$s" ] || continue
    mgrs+="${nl}✅ ${n:-$s}: https://$dom/$s/"
  done <"$site/.gg/managers.txt"
fi
if [ -s "$site/.gg/managers-missing.txt" ]; then
  while read -r n; do [ -n "$n" ] && mgrs+="${nl}⚠️ $n: страница не собрана"; done <"$site/.gg/managers-missing.txt"
fi

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

# План галочками: item - ✅ если раздел собран на сервере (проверяется, а не отмечается руками), иначе ❌
plan=""; pdone=0; ptotal=0
while IFS='|' read -r kind rsec title; do
  kind=$(printf '%s' "$kind" | tr -d '[:space:]'); sec=$(printf '%s' "$rsec" | tr -d '[:space:]')
  title=$(printf '%s' "$title" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  case "$kind" in
    wave) plan+="${nl}${nl}$(printf '%s' "$rsec" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'):"; continue ;;
    done) ok=1 ;;
    todo) ok=0 ;;
    item)
      ok=0
      case "$sec" in
        .) [ -s "$site/index.html" ] && ok=1 ;;
        @managers) [ -s "$site/.gg/managers.txt" ] && ok=1 ;;
        *) [ -s "$site/$sec/index.html" ] && ok=1 ;;
      esac ;;
    *) continue ;;
  esac
  ptotal=$((ptotal + 1))
  if [ "$ok" = 1 ]; then pdone=$((pdone + 1)); plan+="${nl}✅ $title"; else plan+="${nl}❌ $title"; fi
done < <(gg_conf_lines "$conf")

msg="📋 Переезд на сервер: сводка $(date -u '+%d.%m %H:%M') UTC${nl}${nl}Работает на сервере:${ready:-${nl}• пока ничего}"
[ -n "$mgrs" ] && msg+="${nl}${nl}Дашборды менеджеров (как в РОП):${mgrs}"
msg+="${nl}${nl}Задачи:${jobs:-${nl}• ещё не запускались}${nl}${nl}План: готово $pdone из $ptotal ($(( ptotal ? pdone * 100 / ptotal : 0 ))%), осталось $((ptotal - pdone))${nl}✅ готово на сервере, ❌ осталось${plan}"
msg+="${nl}${nl}Вход по личному логину."
printf '%s\n' "$msg"
gg_alert "$msg"
