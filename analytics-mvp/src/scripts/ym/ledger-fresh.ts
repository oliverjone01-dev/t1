// Тревога конца прогона: реестр платежей (netting.ndjson) застрял. Шаг ym:netting в workflow
// fail-open (`|| echo ::warning::`): сбой не роняет прогон, жёлтое предупреждение никто не видит,
// и реестр тихо замерзает (E027). Этот шаг стоит ПОСЛЕ коммита снимков: собранное сохраняется,
// а прогон краснеет, и GitHub присылает письмо.
// Запуск: npm run ym:ledger-fresh
import { yp, readNdjson, readJson, yesterday } from "./common.js";
import { ledgerFreshness, LEDGER_STALE_DAYS } from "./derive-lib.js";

const y = yesterday();
const rows = ledgerFreshness(readNdjson<any>(yp("netting.ndjson")), readNdjson<any>(yp("orders.ndjson")), y);
if (!rows.length) { console.error("::error::ym-ledger-fresh: нет ни реестра, ни заказов - проверять нечего, это сбой сбора"); process.exit(1); }
for (const r of rows) console.log(`кабинет ${r.business}: реестр по ${r.ledger_to ?? "нет строк"}, вчера ${y}, отставание ${r.lag ?? "?"} дн`);
// Незавершённый бэкфилл (после смены схемы) - не застревание, а работа в процессе: жёлтым.
const st = readJson<{ schema?: number; months_done?: string[] }>(yp("netting_state.json"), {});
const done = new Set(st.months_done || []);
const cur = y.slice(0, 7);
const pending = rows.map((r) => `${r.business}/${cur}`).filter((p) => !done.has(p));
if (pending.length) console.warn(`::warning::ym-ledger-fresh: реестр за текущий месяц ещё не собран: ${pending.join(", ")}`);
const bad = rows.filter((r) => r.stale);
if (bad.length) {
  for (const r of bad) console.error(`::error::реестр платежей кабинета ${r.business} по ${r.ledger_to ?? "нет строк"}, отстаёт от вчера (${y}) на ${r.lag ?? "?"} дн, предел ${LEDGER_STALE_DAYS}. Смотри шаг «Отчёт по взаиморасчётам» (ym:netting) и netting_state.json`);
  process.exit(1);
}
console.log(`ym-ledger-fresh: реестр свежий по всем ${rows.length} кабинетам (отставание < ${LEDGER_STALE_DAYS} дн)`);
