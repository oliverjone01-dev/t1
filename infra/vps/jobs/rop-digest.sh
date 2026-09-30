# Дайджест отдела продаж в Telegram - порт .github/workflows/rop-tg-bot.yml (план 06:15, итог 14:45 UTC).
# Код дайджеста НЕ копируем: берём скрипт из рабочего воркфлоу ветки main в зеркале (одно место правды),
# меняем только пути к данным, ссылки github.io -> домен сервера и помечаем заголовок «[сервер]».
# Режим по имени задачи: rop-digest-plan | rop-digest-itogi.
# ПАРАЛЛЕЛЬНЫЙ ПРОГОН (ЯДИ 30.09): в рабочий чат по-прежнему шлёт GitHub, сервер шлёт тот же дайджест
# в группу алертов ботом алертов - для сверки. Переключение: GG_DIGEST_CHAT_ID и ROPCACHE_BOT_TOKEN
# в /etc/gg/secrets.env (и выключить cron в rop-tg-bot.yml в том же PR - два бота в один чат нельзя).
mode=${GG_JOB#rop-digest-}
case "$mode" in plan) slot="06:15" ;; itogi) slot="14:45" ;; *) gg_die "неизвестный режим дайджеста: $GG_JOB" ;; esac
dom=${GG_DOMAIN:-dash.genglas.ru}

# Опоздание: таймер Persistent=true догоняет пропуски после простоя - утренний план в обед не нужен
now=$(date -u +%s); slot_ts=$(date -u -d "$(date -u +%F) $slot" +%s)
if [ $((now - slot_ts)) -gt 5400 ]; then
  gg_warn "дайджест $mode опоздал на $(( (now - slot_ts) / 60 )) мин (>90) - не отправляю"; exit 0
fi

# Свежие данные перед отправкой (в GitHub это «прогрев» за час до слота)
"$GG_OPS/bin/gg-job" rop-snapshot || gg_warn "свежий снимок не удался - дайджест по прошлому снимку"

t=$(mktemp -d); trap 'rm -rf "$t"' EXIT
cp "$(gg_src rop-dashboard-v1)/analytics-mvp/rop/data/rop.json" "$t/rop.json"
git --git-dir="$GG_GIT" show refs/heads/dialog-export-v1:analytics-mvp/dialog/data/dialog.json >"$t/dialog.json" 2>/dev/null \
  || echo '{}' >"$t/dialog.json"
git --git-dir="$GG_GIT" show refs/heads/main:.github/workflows/rop-tg-bot.yml \
  | awk '/cat > \/tmp\/digest.mjs <<.MJS./{f=1;next} /^[[:space:]]*MJS$/{f=0} f' | sed 's/^          //' \
  | sed -e "s#/tmp/rop.json#$t/rop.json#g" -e "s#/tmp/dialog.json#$t/dialog.json#g" \
        -e "s#https://oliverjone01-dev.github.io/t1/#https://$dom/#g" \
        -e "s#const before='<b>'+head#const before='<b>[сервер] '+head#" >"$t/digest.mjs"
grep -q "sendMessage" "$t/digest.mjs" || gg_die "не нашёл скрипт дайджеста в rop-tg-bot.yml (ветка main) - формат воркфлоу изменился"

MODE=$mode CHAT_ID=${GG_DIGEST_CHAT_ID:-$GG_ALERT_CHAT_ID} BOT_TOKEN=${ROPCACHE_BOT_TOKEN:-$GG_ALERT_BOT_TOKEN} \
  MGR_NAME="" REPORT_FILE="" node "$t/digest.mjs"
