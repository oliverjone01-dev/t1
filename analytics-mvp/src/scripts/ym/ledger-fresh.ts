// Тревога конца прогона: реестр платежей (netting.ndjson) застрял. Шаг ym:netting в workflow
// fail-open (`|| echo ::warning::`), а 29.09 он и не падал: упёрся в бюджет отчётов и остановился
// штатно, кабинет 1023124 остался по 27.09 при зелёном прогоне. Правило - ledgerFreshness
// (derive-lib). Шаг стоит ПОСЛЕ коммита снимков: собранное сохраняется, прогон краснеет, GitHub
// присылает письмо владельцу плановых прогонов.
// Кабинеты - из настроек (YM_BUSINESS_IDS или список по умолчанию) плюс активные за 30 дней по реестру
// и заказам: продьюсеры берут кабинеты из ключей. Закрытый кабинет без активности не красит прогон.
// Запуск: npm run ym:ledger-fresh
import { yp, readNdjson, readJson, yesterday } from "./common.js";
import { ymBusinessIdsFromEnv } from "../../connector/ym-partner.js";
import { ledgerFreshness } from "./derive-lib.js";

const y = yesterday();
const st = readJson<{ months_done?: string[] }>(yp("netting_state.json"), {});
const rows = ledgerFreshness(readNdjson<any>(yp("netting.ndjson")), ymBusinessIdsFromEnv(), y, st.months_done || [], readNdjson<any>(yp("orders.ndjson")));
if (!rows.length) { console.error("::error::ym-ledger-fresh: список кабинетов пуст - проверять нечего, это сбой настроек"); process.exit(1); }
for (const r of rows) console.log(`кабинет ${r.business}: реестр по ${r.ledger_to ?? "нет строк"}, вчера ${y}, ${r.reason}`);
const bad = rows.filter((r) => r.stale);
if (bad.length) {
  for (const r of bad) console.error(`::error::реестр платежей кабинета ${r.business} застрял: ${r.reason} (реестр по ${r.ledger_to ?? "нет строк"}, вчера ${y}). Смотри шаг «Отчёт по взаиморасчётам» (ym:netting): лимит или бюджет отчётов, netting_state.json`);
  process.exit(1);
}
console.log(`ym-ledger-fresh: реестр свежий по всем ${rows.length} кабинетам`);
