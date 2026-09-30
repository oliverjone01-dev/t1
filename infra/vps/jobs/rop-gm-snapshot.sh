# Порт .github/workflows/b24-gm-snapshots.yml: РОП Glass Memory - снимок воронки C21 «ПРОДАЖИ Glass Memory»
# тем же сборщиком, что РОП ГГ (fetch-rop.ts), в отдельный файл rop/data/rop-gm.json; СП «Производство GM»
# (1120), только лиды Glass Memory. В GitHub дашборд пёкся на деплое (deploy-pages), здесь - сразу в задаче:
# релизы неизменяемые, а public/rop-gm-command.html - путь данных. Выполняется в релизе rop-gm-dashboard-v1.
: "${B24_WEBHOOK_URL:?нет B24_WEBHOOK_URL в /etc/gg/secrets.env}"
export B24_PORTAL=${B24_PORTAL:-https://glassmemory.bitrix24.ru}
export ROP_DEAL_CATEGORY=21 ROP_OUT=rop/data/rop-gm.json ROP_SP_ETID=1120 ROP_ONLY_LEAD_DIRS=glass-memory
export ROP_DATE_FROM=${ROP_DATE_FROM:-}

cd analytics-mvp || exit 1
npx tsx src/scripts/b24/fetch-rop.ts
gg_log "Размер данных: $(du -hL rop/data/rop-gm.json | cut -f1)"
npx tsx src/scripts/b24/build-rop-gm.ts
gg_log "Дашборд: $(du -hL public/rop-gm-command.html | cut -f1)"
