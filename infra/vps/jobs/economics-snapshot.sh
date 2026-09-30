# Порт .github/workflows/economics-cron.yml: снимок денег по сделкам воронки «GG Заказы РФ» (49) -
# бюджет и себестоимость из СП Расчёт/Калькулятор/Закупка/Производство GG, затем запекание
# слоевого дашборда (на сайте /economics/layers.html). Выполняется в релизе economics-dashboard-v1,
# где economics/data и public/economics-command.html - ссылки на серверные данные.
# Пушей в GitHub и dispatch деплоя нет: данные коммитит gg-job, сайт пересобирается сам (site=yes).
: "${B24_WEBHOOK_URL:?нет B24_WEBHOOK_URL в /etc/gg/secrets.env}"
export B24_PORTAL=${B24_PORTAL:-https://glassmemory.bitrix24.ru}

cd analytics-mvp || exit 1
npx tsx src/scripts/b24/fetch-economics.ts
gg_log "Размер данных: $(du -hL economics/data/economics.json | cut -f1)"
npx tsx src/scripts/b24/build-economics.ts
gg_log "Дашборд: $(du -hL public/economics-command.html | cut -f1)"
