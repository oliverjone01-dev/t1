# Weekly/monthly facts from VPS snapshots. No AI provider calls.
# Sending is disabled until GG_AUDIT_ENABLED=1; previews never send.
mode=${GG_JOB#sales-audit-}
case "$mode" in weekly|monthly) ;; *) gg_die "неизвестный аудит $GG_JOB" ;; esac
[ "${GG_AUDIT_CHAT_ID:-}" = -1003652568523 ] || gg_die "аудит разрешён только в закрытый чат -1003652568523"
preview=${GG_AUDIT_PREVIEW:-0}
test_delivery=${GG_AUDIT_TEST:-0}
if [ "$preview" != 1 ] && [ "$test_delivery" != 1 ] && [ "${GG_AUDIT_ENABLED:-0}" != 1 ]; then
  gg_log "Аудит не включён: GG_AUDIT_ENABLED не равен 1"; exit 0
fi
: "${ROPCACHE_BOT_TOKEN:?нет токена бота РОП}"
unset ANTHROPIC_API_KEY
store="$GG_DATA/sales-audit"
[ -f "$store/imported.json" ] || gg_die "сначала импортируй историю: prepare-sales-audit.sh"
mkdir -p "$store"/{srez,reports,delivery}
src=$(gg_src main)
builder="$src/analytics-mvp/src/scripts/sales/audit-build.mjs"
sender="$src/.github/scripts/tg-send.mjs"
rop="$GG_DATA/rop-dashboard-v1/analytics-mvp/rop/data/rop.json"
dialog="$GG_DATA/dialog-export-v1/analytics-mvp/dialog/data/dialog.json"
work=$(mktemp -d "$GG_ROOT/cache/sales-audit.XXXXXX")
trap 'rm -rf "$work"' EXIT
if [ "$mode" = weekly ]; then
  python3 - "$rop" "$dialog" <<'PY'
import json, sys
from datetime import datetime, timezone
now = datetime.now(timezone.utc)
for p, field in [(sys.argv[1], 'generated_at'), (sys.argv[2], 'generatedAt')]:
    d = json.load(open(p))
    value = d.get(field)
    if not value: raise SystemExit('Нет даты снимка: '+p)
    stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if not 0 <= (now-stamp).total_seconds() <= 172800:
        raise SystemExit('Снимок старше 48 часов или из будущего: '+p)
    print('Источник VPS:', field, value)
PY
  node "$builder" --mode weekly --rop "$rop" --dialog "$dialog" --store "$store/srez" --out-facts "$work/facts.md" --out-srez "$work/srez.json"
  period=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).week)' "$work/srez.json")
  cp "$work/srez.json" "$store/srez/$period.json"
else
  period=$(python3 - <<'PY'
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
print((datetime.now(ZoneInfo("Europe/Moscow")).date().replace(day=1)-timedelta(days=1)).strftime("%Y-%m"))
PY
)
  node "$builder" --mode monthly --month "$period" --store "$store/srez" --out-facts "$work/facts.md"
fi
kind=$mode
[ "$test_delivery" != 1 ] || kind="test-$mode"
report="$store/reports/$kind-$period.md"
{
  if [ "$test_delivery" = 1 ]; then printf '🧪 ТЕСТ ДОСТАВКИ · не плановый отчёт\n\n'; fi
  printf '🔒 Для Ивана и РОПа · факты без нового ИИ-разбора\n\n'
  if [ "$mode" = monthly ]; then
    printf 'Это свод доступных недельных срезов; не ежедневный отчёт за весь месяц и не снимок последнего дня.\n\n'
  fi
  sed -e 's/на конец месяца/по последнему доступному недельному срезу/g' \
      -e 's/Просрочка дел (конец месяца)/Просрочка дел (последний недельный срез)/g' "$work/facts.md"
} >"$report"
# Facts survive Telegram failures; AI is not involved.
rc=0; gg_data_commit "sales-audit $mode $period: facts saved before delivery" sales-audit || rc=$?
[ "$rc" -le 1 ] || gg_die "не удалось сохранить факты в локальной истории"
if [ "$preview" = 1 ]; then
  cat "$report"; gg_log "Предпросмотр: сообщения не отправлены, Anthropic не вызван"; exit 0
fi
marker="$store/delivery/$kind-$period.txt"
if [ -f "$marker" ]; then
  gg_log "Доставка $mode $period уже имеет статус $(cat "$marker"); автоматического повтора нет"; exit 0
fi
printf 'pending\n' >"$marker"
rc=0; gg_data_commit "sales-audit $mode $period: delivery pending" sales-audit || rc=$?
[ "$rc" -le 1 ] || gg_die "не удалось сохранить статус до отправки"
BOT_TOKEN=$ROPCACHE_BOT_TOKEN BOT_TOKEN_ALT="" CHAT_ID=$GG_AUDIT_CHAT_ID \
  node --dns-result-order=ipv4first "$sender" "$report"
printf 'sent\n' >"$marker"
rc=0; gg_data_commit "sales-audit $mode $period: delivered to private chat" sales-audit || rc=$?
[ "$rc" -le 1 ] || gg_die "отправлено, но статус не сохранён"
gg_log "Аудит-факты $mode $period отправлен только в закрытый чат"
