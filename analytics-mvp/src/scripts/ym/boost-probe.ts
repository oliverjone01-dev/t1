// Разовая проба отчётов Маркета по продвижению (просьба пользователя 02.10: «по ДРР проверь отчёты
// по продвижению»). Только чтение: generate -> poll -> download, в лог - листы, колонки, число строк,
// первые строки (буквы и цифры замаскированы) и суммы числовых колонок. Ничего не пишет и не коммитит.
//
// Что ищем до кода (data-guard, К6): есть ли выручка рекламных заказов, по какой дате она идёт
// (заказ или доставка), есть ли разрез по дням и артикулам, сходится ли расход с «Продвижением»
// отчёта по взаиморасчётам за тот же период (сумма печатается рядом из data-ym/netting.ndjson).
//
// Отчёты: boost-consolidated (буст продаж), shows-boost (буст показов), shelf-statistics (полки).
// Формы тела для двух последних не проверены - если Маркет отвергнет, в лог уйдёт текст ошибки.
import { existsSync, readFileSync } from "node:fs";
import { loadEnv } from "../../env.js";
import { resolveBusinesses, yp } from "./common.js";
import { toTable, maskCell } from "../../util/table.js";
import { retryOnRateLimit, RATE_LIMITED } from "./reports-wait.js";
import { accFeeKey } from "./derive-lib.js";

loadEnv();
const from = process.argv[2] || "2026-09-01";
const to = process.argv[3] || "2026-09-30";
const MASK = process.env.PROBE_NO_MASK !== "1";

const REPORTS: Array<{ type: string; body: (b: string) => any }> = [
  { type: "boost-consolidated", body: (b) => ({ businessId: Number(b), dateFrom: from, dateTo: to }) },
  { type: "shows-boost", body: (b) => ({ businessId: Number(b), dateFrom: from, dateTo: to, attributionType: "SHOWS" }) },
  { type: "shelf-statistics", body: (b) => ({ businessId: Number(b), dateFrom: from, dateTo: to, attributionType: "SHOWS" }) },
];

const num = (s: string) => { const v = Number(String(s ?? "").replace(/\s| /g, "").replace(",", ".")); return Number.isFinite(v) ? v : null; };

// «Продвижение» по отчёту по взаиморасчётам за тот же период - для сверки расхода (деньги, без баллов).
function promoLedger(b: string): number | null {
  const f = yp("netting.ndjson");
  if (!existsSync(f)) return null;
  let s = 0;
  for (const l of readFileSync(f, "utf-8").split("\n")) {
    if (!l.trim()) continue;
    const r = JSON.parse(l);
    if (String(r.business) !== b || r.d < from || r.d > to) continue;
    if (accFeeKey(String(r.service || ""), String(r.src || "")) === "promo") s += Number(r.amount) || 0;
  }
  return Math.round(s);
}

async function main() {
  const startedAt = Date.now();
  const timeLeft = () => 50 * 60 * 1000 - (Date.now() - startedAt);
  for (const { businessId: b, account } of await resolveBusinesses()) {
    console.log(`\n===== кабинет ${b}, период ${from}..${to}; «Продвижение» по взаиморасчётам: ${promoLedger(b) ?? "нет netting.ndjson"} ₽ =====`);
    for (const rep of REPORTS) {
      console.log(`\n--- ${rep.type} ${JSON.stringify(rep.body(b))}`);
      try {
        const r = await retryOnRateLimit(() => account.api.report(rep.type, rep.body(b), { timeoutMs: 15 * 60 * 1000 }), rep.type, { waitMs: 125_000, timeLeft });
        if (r === RATE_LIMITED) { console.log("лимит генерации, время пробы вышло"); continue; }
        console.log(`status ${r.status}${r.subStatus ? "/" + r.subStatus : ""}, файлов ${r.files.length}, байт ${r.bytes}`);
        for (const f of r.files) {
          const t = toTable(f.text);
          console.log(`\n[лист] ${f.name}: строк ${t.rows.length}, разделитель '${t.delimiter}'`);
          console.log(`колонки: ${JSON.stringify(t.headers)}`);
          for (const row of t.rows.slice(0, 3)) console.log(`  ${JSON.stringify(MASK ? row.map((c) => (num(c) != null ? c : maskCell(c))) : row)}`);
          const sums = t.headers.map((h, i) => {
            const vs = t.rows.map((row) => num(row[i]!)).filter((v): v is number => v != null);
            return vs.length === t.rows.length && vs.length ? `${h}=${Math.round(vs.reduce((x, y) => x + y, 0) * 100) / 100}` : null;
          }).filter(Boolean);
          console.log(`суммы числовых колонок: ${sums.join("; ")}`);
        }
      } catch (e) {
        console.log(`ошибка: ${String((e as Error).message).slice(0, 600)}`);
      }
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
