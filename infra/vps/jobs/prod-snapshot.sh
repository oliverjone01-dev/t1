# Порт .github/workflows/prod-cron.yml: снимок СП «Производство» (fetch-prod) и запекание дашборда
# (build-prod) -> /prod/ и /prod2/. Выполняется в релизе prod-dashboard-v1, где prod/data и
# public/prod-command.html - ссылки на серверные данные. Пушей в GitHub и dispatch деплоя нет.
: "${B24_WEBHOOK_URL:?нет B24_WEBHOOK_URL в /etc/gg/secrets.env}"
export B24_PORTAL=${B24_PORTAL:-https://glassmemory.bitrix24.ru}

cd analytics-mvp || exit 1
npx tsx src/scripts/b24/fetch-prod.ts
gg_log "Размер данных: $(du -hL prod/data/prod.json | cut -f1)"
npx tsx src/scripts/b24/build-prod.ts
gg_log "Дашборд: $(du -hL public/prod-command.html | cut -f1)"
