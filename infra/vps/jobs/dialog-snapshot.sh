# Порт .github/workflows/b24-dialog-cron.yml: снимок коммуникаций Bitrix24 (fetch-dialog, окно 7 дней)
# и скоринг диалогов (score-dialog) по фактам CRM из снимка РОПа. В GitHub страница /dialog/ пеклась на
# деплое, здесь - сразу в задаче (build-dialog): релизы неизменяемые, а public/dialog.html - данные
# без истории (~100 МБ, «~» в branches.conf). ИИ-разбор по API (ai-review) не переносится: в GitHub он
# приостановлен по правилу Ивана (API только из дашборда), а с российских IP API Anthropic недоступен.
: "${B24_WEBHOOK_URL:?нет B24_WEBHOOK_URL в /etc/gg/secrets.env}"
export B24_PORTAL=${B24_PORTAL:-https://glassmemory.bitrix24.ru}
export DIALOG_DAYS=${DIALOG_DAYS:-7}

cd analytics-mvp || exit 1
npx tsx src/scripts/b24/fetch-dialog.ts
gg_log "Размер: $(du -hL dialog/data/dialog.json | cut -f1)"
# Факты CRM - снимок РОПа этого сервера (в GitHub - последний rop.json ветки rop-dashboard-v1)
rop="$GG_ROOT/data/rop-dashboard-v1/analytics-mvp/rop/data/rop.json"
[ -s "$rop" ] || { gg_warn "rop.json недоступен, скоринг без фактов CRM"; rop=/nonexistent/rop.json; }
ROP_JSON=$rop npx tsx src/scripts/b24/score-dialog.ts
npx tsx src/scripts/b24/build-dialog.ts
gg_log "Страница: $(du -hL public/dialog.html | cut -f1)"
