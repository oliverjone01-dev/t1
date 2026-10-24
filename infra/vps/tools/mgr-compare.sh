#!/usr/bin/env bash
# Разовая сверка личных дашбордов менеджеров: сервер vs github.io, итог в группу алертов.
# Запуск от root (читает /etc/gg/secrets.env). Однократно по времени:
#   systemd-run --on-calendar="2026-09-30 16:00:00 UTC" bash <релиз контура>/infra/vps/tools/mgr-compare.sh
set -uo pipefail
set -a; . /etc/gg/secrets.env; set +a
site=$(readlink -f /srv/gg/www/current)
lst="$site/.gg/managers.txt"
gh=https://oliverjone01-dev.github.io/t1
nl=$'\n'
n=$(grep -c . "$lst" 2>/dev/null || echo 0)
msg="📏 Сверка личных дашбордов: сервер vs github.io ($(date -u '+%d.%m %H:%M') UTC)${nl}Страниц на сервере: $n (ожидается 7)${nl}"
ok=0; bad=0
while IFS=$'\t' read -r s name; do
  [ -n "$s" ] || continue
  a=$(stat -c%s "$site/$s/index.html" 2>/dev/null || echo 0)
  r=$(curl -s -m 90 -o /dev/null -w '%{http_code} %{size_download}' "$gh/$s/" || echo "000 0")
  code=${r%% *}; b=${r##* }
  sv=$(cat "$site/$s/v.txt" 2>/dev/null | cut -c12-16)
  gv=$(curl -s -m 30 "$gh/$s/v.txt" | cut -c12-16)
  d=$((a - b)); ad=${d#-}
  if [ "$code" = 200 ] && [ "$ad" -le 5000 ]; then mark="✅"; ok=$((ok + 1)); else mark="⚠️"; bad=$((bad + 1)); fi
  msg+="${nl}$mark ${name:-$s}: сервер $a, github $b (разница $d байт, github $code; сборка сервер $sv / github $gv UTC)"
done <"$lst"
msg+="${nl}${nl}Итог: совпало $ok, расхождений $bad. Порог: 5000 байт (~0,1%)."
[ "$n" = 7 ] || msg+="${nl}⚠️ Страниц не 7 - проверить conf/managers.conf и лог rop-snapshot."
printf '%s\n' "$msg"
curl -fsS -m 30 -o /dev/null -X POST "https://api.telegram.org/bot${GG_ALERT_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${GG_ALERT_CHAT_ID}" --data-urlencode "text=[$(hostname -s)] $msg" \
  && echo "отправлено в группу алертов" || echo "Telegram не принял сообщение"
