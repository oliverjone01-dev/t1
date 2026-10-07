# Дайджест отдела продаж в Telegram - порт .github/workflows/rop-tg-bot.yml (план 06:15, итог 14:45 UTC).
# Код дайджеста НЕ копируем: берём скрипт из рабочего воркфлоу ветки main в зеркале (одно место правды),
# меняем только пути к данным и ссылки github.io -> домен сервера.
# Режим по имени задачи: rop-digest-plan | rop-digest-itogi.
# GitHub cron отключён 05.10.2026. Рабочий чат задаётся GG_DIGEST_CHAT_ID.
# Ручные тесты GG_DIGEST_TEST=1 направляются только в группу алертов.
mode=${GG_JOB#rop-digest-}
case "$mode" in plan) slot="06:15" ;; itogi) slot="14:45" ;; *) gg_die "неизвестный режим дайджеста: $GG_JOB" ;; esac
dom=${GG_DOMAIN:-dash.genglas.ru}
# Выбираем бот и чат одной парой: бот РОП не обязан состоять в группе алертов.
if [ "${GG_DIGEST_TEST:-0}" = 1 ]; then
  token=${GG_ALERT_BOT_TOKEN:-}; chat=${GG_ALERT_CHAT_ID:-}
  gg_log "Тест дайджеста $mode: группа алертов, без обновления снимка"
elif [ -n "${GG_DIGEST_CHAT_ID:-}" ]; then
  token=${ROPCACHE_BOT_TOKEN:-}; chat=$GG_DIGEST_CHAT_ID
else
  token=${GG_ALERT_BOT_TOKEN:-}; chat=${GG_ALERT_CHAT_ID:-}
fi
[ -n "$token" ] && [ -n "$chat" ] || gg_die "не заполнена пара бот/чат для дайджеста"

# Daily delivery receipt: sent/pending/unknown all block automatic duplicate delivery.
if [ "${GG_DIGEST_TEST:-0}" != 1 ]; then
  delivery_day=$(TZ=Europe/Moscow date +%F)
  delivery_file="$GG_ROOT/state/digest-delivery/${delivery_day}-${mode}-${chat}.json"
  if [ -s "$delivery_file" ]; then gg_log "дайджест $mode за $delivery_day уже отправлен или требует проверки доставки; повтор заблокирован"; exit 0; fi
fi

# Опоздание: таймер Persistent=true догоняет пропуски после простоя - утренний план в обед не нужен
now=$(date -u +%s); slot_ts=$(date -u -d "$(date -u +%F) $slot" +%s)
if [ "${GG_DIGEST_TEST:-0}" != 1 ] && [ $((now - slot_ts)) -gt 5400 ]; then
  gg_warn "дайджест $mode опоздал на $(( (now - slot_ts) / 60 )) мин (>90) - не отправляю"; exit 0
fi

# Свежие данные перед отправкой (в GitHub это «прогрев» за час до слота)
if [ "${GG_DIGEST_TEST:-0}" != 1 ]; then
  "$GG_OPS/bin/gg-job" rop-snapshot || gg_warn "свежий снимок не удался - дайджест по прошлому снимку"
fi

t=$(mktemp -d); trap 'rm -rf "$t"' EXIT
cp "$(gg_src rop-dashboard-v1)/analytics-mvp/rop/data/rop.json" "$t/rop.json"
dialog="$GG_DATA/dialog-export-v1/analytics-mvp/dialog/data/dialog.json"
if [ -s "$dialog" ]; then cp "$dialog" "$t/dialog.json";
else gg_warn "снимок диалогов VPS отсутствует"; echo '{}' >"$t/dialog.json"; fi
git --git-dir="$GG_GIT" show refs/heads/main:.github/workflows/rop-tg-bot.yml \
  | awk '/cat > \/tmp\/digest.mjs <<.MJS./{f=1;next} /^[[:space:]]*MJS$/{f=0} f' | sed 's/^          //' \
  | sed -e "s#/tmp/rop.json#$t/rop.json#g" -e "s#/tmp/dialog.json#$t/dialog.json#g" \
        -e "s#https://oliverjone01-dev.github.io/t1/#https://$dom/#g" >"$t/digest.mjs"
grep -q "sendMessage" "$t/digest.mjs" || gg_die "не нашёл скрипт дайджеста в rop-tg-bot.yml (ветка main) - формат воркфлоу изменился"

MODE=$mode CHAT_ID=$chat BOT_TOKEN=$token \
  MGR_NAME="" REPORT_FILE="" GG_DIGEST_DELIVERY_DIR="$GG_ROOT/state/digest-delivery" node --import "$GG_OPS/tools/digest-delivery-guard.mjs" --dns-result-order=ipv4first "$t/digest.mjs"
