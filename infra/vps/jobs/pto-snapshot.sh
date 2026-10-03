# Порт .github/workflows/pto-cron.yml: снимок смарта «Расчёт» (fetch-pto) -> pto/data/pto.json и та же
# проверка снимка (ноль карточек или нет стадий = падение, данные откатятся). Как в GitHub, страницу
# НЕ пересобирает: public/pto-command.html публичная сборка из git ветки (на 30.09 - от 24.09).
# Выполняется в релизе pto-dashboard-v1, где pto/data - ссылка на серверные данные.
: "${B24_WEBHOOK_URL:?нет B24_WEBHOOK_URL в /etc/gg/secrets.env}"
export B24_PORTAL=${B24_PORTAL:-https://glassmemory.bitrix24.ru}

cd analytics-mvp || exit 1
npx tsx src/scripts/b24/fetch-pto.ts
[ -s pto/data/pto.json ] || gg_die "pto.json пуст"
node -e '
  const d = require("./pto/data/pto.json");
  const c = d.counts || {};
  console.log("карточек", c.items, "· с историей", c.withHist, "· со сделкой", c.withDeal, "· штук", c.qtySum);
  console.log("стадий", (d.refs?.stageOrder || []).length);
  if (!c.items) { console.error("в снимке ноль карточек"); process.exit(1); }
  if (!(d.refs?.stageOrder || []).length) { console.error("не выгрузились стадии смарта"); process.exit(1); }
'
