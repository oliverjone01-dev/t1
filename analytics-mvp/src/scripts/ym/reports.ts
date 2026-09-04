// Отчёты Маркета через generate -> poll -> download (только чтение). Три продьюсера:
//   realization [YYYY-MM ...]  goods-realization по кампаниям за месяц -> data-ym/realization_monthly.ndjson
//                              (аналог OZON /v2/finance/realization = основа сверки штук по §15).
//   netting [from] [to]        united-netting по кабинетам -> data-ym/netting.ndjson + netting_summary.json
//                              (выплаты ЛК: сумма платежей по датам п/п = эталон для «к выплате» по §15).
//   shows [days]               shows-sales по кабинетам ПО ДНЯМ -> data-ym/sku_views.ndjson (показы/корзина per-SKU).
// Колонки ищутся по regex из report-columns.json; сырые заголовки + 3 строки каждого отчёта пишутся
// в data-ym/_probe/<type>.json для первичной настройки. Не найдена ключевая колонка -> warning,
// файл не трогаем, exit 0 (мягкий продьюсер: не валит ночной синк).
// Запуск: npm run ym:realization | ym:netting | ym:shows
import { readFileSync } from "node:fs";
import { loadEnv } from "../../env.js";
import { client, resolveCampaigns, ensureDir, readNdjson, writeNdjson, writeJson, readJson, yp, yesterday, addDays, monthBounds, FLOOR, pad } from "./common.js";
import { toTable, findCol, cellNumStrict, cellDate, maskCell } from "../../util/table.js";
import { ymBusinessIdsFromEnv, type YmPartner } from "../../connector/ym-partner.js";

type ColMap = Record<string, string[]>;
const COLS: Record<string, ColMap> = JSON.parse(readFileSync(new URL("./report-columns.json", import.meta.url), "utf-8"));

// Probe: заголовки + МАСКИРОВАННЫЕ образцы строк (цифры -> 9, буквы -> x): для настройки колонок достаточно,
// а номера заказов / п/п / суммы в git не уезжают (ФЕНИКС G10).
function probe(type: string, headers: string[], rows: string[][], extra: any = {}) {
  writeJson(yp(`_probe/${type}.json`), { type, at: new Date().toISOString(), headers, sample_masked: rows.slice(0, 3).map((r) => r.map(maskCell)), ...extra });
}

// Битые числовые ячейки (не разобрались) - считаем, пишем в _probe/bad_cells.json, reconcile поднимает в полосу.
const BAD: Record<string, number> = {};
function num(type: string, s: string | undefined): number {
  const v = cellNumStrict(s);
  if (v == null) { BAD[type] = (BAD[type] || 0) + 1; return 0; }
  return v;
}
function flushBad() {
  const total = Object.values(BAD).reduce((a, b) => a + b, 0);
  const prev = readJson<any>(yp("_probe/bad_cells.json"), { byType: {} });
  const byType: Record<string, number> = { ...(prev.byType || {}), ...BAD };
  writeJson(yp("_probe/bad_cells.json"), { at: new Date().toISOString(), byType, total: Object.values(byType).reduce((a, b) => a + Number(b), 0) });
  if (total) console.warn(`::warning::неразобранных числовых ячеек за прогон: ${total} (${JSON.stringify(BAD)})`);
}

// Бюджет отчётов на прогон (ФЕНИКС G9): каждый generate+poll до 15 мин; без потолка первый бэкфилл
// упирается в timeout job и теряет всё. По умолчанию 10 отчётов, переопределяется YM_REPORT_BUDGET.
const BUDGET = Math.max(1, Number(process.env.YM_REPORT_BUDGET || 10) || 10);
let used = 0;
function budgetLeft(): boolean { if (used >= BUDGET) { console.warn(`::warning::бюджет отчётов исчерпан (${BUDGET}) - остальное доберёт следующий прогон`); return false; } used++; return true; }

function cols(type: string, headers: string[], required: string[]): Record<string, number> | null {
  const map = COLS[type] || {};
  const idx: Record<string, number> = {};
  for (const [k, pats] of Object.entries(map)) idx[k] = findCol(headers, pats);
  const missing = required.filter((k) => idx[k] == null || idx[k]! < 0);
  if (missing.length) { console.warn(`::warning::отчёт ${type}: не найдены колонки ${missing.join(", ")} в заголовках [${headers.join(" | ")}] - см. data-ym/_probe/${type}.json и поправь report-columns.json`); return null; }
  return idx;
}

async function fetchReport(api: YmPartner, type: string, body: any): Promise<{ headers: string[]; rows: string[][] } | null> {
  if (!budgetLeft()) return null;
  const r = await api.report(type, body, { timeoutMs: Number(process.env.YM_REPORT_TIMEOUT_MS || 15 * 60 * 1000) });
  if (r.status !== "DONE" || r.text == null) { console.warn(`::warning::отчёт ${type} ${JSON.stringify(body)}: status ${r.status}${r.subStatus ? "/" + r.subStatus : ""} - данных нет`); return null; }
  const t = toTable(r.text);
  console.log(`  ${type}: ${r.fileName || "file"} ${r.bytes} байт, строк ${t.rows.length}, разделитель '${t.delimiter}'`);
  return { headers: t.headers, rows: t.rows };
}

// ---- goods-realization: {campaignId, year, month} -> {ym, sku, sold, ret} ----
async function realization(api: YmPartner, months: string[]) {
  const OUT = yp("realization_monthly.ndjson");
  const camps = await resolveCampaigns(api);
  const existing = readNdjson<any>(OUT);
  const done = new Set<string>();
  const fresh: any[] = [];
  for (const ym of months) {
    const [y, m] = ym.split("-").map(Number) as [number, number];
    const bySku: Record<string, { sold: number; ret: number; amount: number }> = {};
    let ok = 0;
    for (const c of camps) {
      const t = await fetchReport(api, "goods-realization", { campaignId: Number(c.id), year: y, month: m });
      if (!t) continue;
      probe("goods-realization", t.headers, t.rows, { campaign: c.id, ym });
      const ix = cols("goods-realization", t.headers, ["sku", "sold"]);
      if (!ix) continue;
      ok++;
      for (const r of t.rows) {
        const sku = (r[ix.sku!] || "").trim(); if (!sku) continue;
        const a = bySku[sku] || (bySku[sku] = { sold: 0, ret: 0, amount: 0 });
        a.sold += num("goods-realization", r[ix.sold!]); if (ix.returned! >= 0) a.ret += num("goods-realization", r[ix.returned!]); if (ix.amount! >= 0) a.amount += num("goods-realization", r[ix.amount!]);
      }
    }
    if (!ok) { console.warn(`::warning::realization ${ym}: ни один отчёт не разобран - месяц не трогаю`); continue; }
    done.add(ym);
    for (const [sku, a] of Object.entries(bySku)) fresh.push({ ym, sku, sold: Math.round(a.sold), ret: Math.round(a.ret), amount: Math.round(a.amount), platform: "ym", source: "goods-realization" });
    console.log(`realization ${ym}: SKU ${Object.keys(bySku).length}, реализовано нетто ${Object.values(bySku).reduce((s, a) => s + a.sold - a.ret, 0)} шт`);
  }
  const merged = existing.filter((r) => !done.has(r.ym)).concat(fresh).sort((a, b) => (a.ym < b.ym ? -1 : a.ym > b.ym ? 1 : a.sku < b.sku ? -1 : 1));
  writeNdjson(OUT, merged);
  console.log(`realization: всего ${merged.length} строк (${new Set(merged.map((r) => r.ym)).size} мес) -> ${OUT}`);
}

// ---- united-netting: {businessId, dateFrom, dateTo} -> платежи по датам ----
async function netting(api: YmPartner, from: string, to: string) {
  const OUT = yp("netting.ndjson");
  const existing = readNdjson<any>(OUT).filter((r) => !(r.d >= from && r.d <= to));
  const fresh: any[] = [];
  let ok = 0;
  for (const b of ymBusinessIdsFromEnv()) {
    // помесячно (лимит диапазона отчёта)
    let s = from;
    while (s <= to) {
      const mb = monthBounds(s.slice(0, 7));
      const e = mb.dateTo < to ? mb.dateTo : to;
      const t = await fetchReport(api, "united-netting", { businessId: Number(b), dateFrom: s, dateTo: e });
      if (t) {
        probe("united-netting", t.headers, t.rows, { business: b, from: s, to: e });
        const ix = cols("united-netting", t.headers, ["date", "amount"]);
        if (ix) {
          ok++;
          for (const r of t.rows) {
            const d = cellDate(r[ix.date!]); if (!d) continue;
            fresh.push({ d, business: b, type: ix.type! >= 0 ? (r[ix.type!] || "").trim() : "", service: ix.service! >= 0 ? (r[ix.service!] || "").trim() : "", amount: num("united-netting", r[ix.amount!]), order: ix.order! >= 0 ? (r[ix.order!] || "").trim() : "", sku: ix.sku! >= 0 ? (r[ix.sku!] || "").trim() : "", po: ix.payment_order! >= 0 ? (r[ix.payment_order!] || "").trim() : "", platform: "ym" });
          }
        }
      }
      s = addDays(e, 1);
    }
  }
  if (!ok) { console.warn("::warning::netting: ни один отчёт не разобран - файлы не трогаю"); return; }
  const merged = existing.concat(fresh).sort((a, b) => (a.d < b.d ? -1 : 1));
  writeNdjson(OUT, merged);
  const byDate: Record<string, number> = {}, byMonth: Record<string, number> = {};
  for (const r of merged) { byDate[r.d] = Math.round(((byDate[r.d] || 0) + r.amount) * 100) / 100; const m = r.d.slice(0, 7); byMonth[m] = Math.round(((byMonth[m] || 0) + r.amount) * 100) / 100; }
  writeJson(yp("netting_summary.json"), { platform: "ym", generated_at: new Date().toISOString(), rows: merged.length, byDate, byMonth, note: "сумма строк отчёта по взаиморасчётам по дате; знак как в отчёте (выплаты +, удержания -). [ГИПОТЕЗА] до сверки колонок" });
  console.log(`netting: строк ${merged.length} (${from}..${to} обновлено ${fresh.length}) -> ${OUT}`);
}

// ---- shows-sales по дням: {businessId, dateFrom, dateTo, grouping:"OFFERS"} -> sku_views.ndjson ----
async function shows(api: YmPartner, days: number) {
  const OUT = yp("sku_views.ndjson");
  const existing = readNdjson<any>(OUT);
  const have = new Set(existing.map((r) => r.date));
  const to = yesterday();
  let from = addDays(to, -(days - 1)); if (from < FLOOR) from = FLOOR;
  const targets: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) if (!have.has(d)) targets.push(d);
  const maxReports = Math.min(Number(process.env.YM_SHOWS_MAX_REPORTS || 40), BUDGET);
  console.log(`shows: дней к сбору ${targets.length} (${targets[0] || "-"}..${targets[targets.length - 1] || "-"}), лимит отчётов за прогон ${maxReports}`);
  const fresh: any[] = []; let n = 0, fails = 0;
  outer: for (const d of targets) {
    const dayRows: any[] = [];
    for (const b of ymBusinessIdsFromEnv()) {
      if (n >= maxReports) break outer;
      n++;
      let t: { headers: string[]; rows: string[][] } | null = null;
      try { t = await fetchReport(api, "shows-sales", { businessId: Number(b), dateFrom: d, dateTo: d, grouping: "OFFERS" }); }
      catch (e) { fails++; console.warn(`::warning::shows ${d} ${b}: ${(e as Error).message.slice(0, 160)}`); if (fails >= 3) break outer; continue; }
      if (!t) continue;
      probe("shows-sales", t.headers, t.rows, { business: b, date: d });
      const ix = cols("shows-sales", t.headers, ["sku", "shows"]);
      if (!ix) break outer;
      for (const r of t.rows) {
        const sku = (r[ix.sku!] || "").trim(); if (!sku) continue;
        dayRows.push({ date: d, sku, name: ix.name! >= 0 ? (r[ix.name!] || "").trim() : "", line: "", views: Math.round(num("shows-sales", r[ix.shows!])), vsearch: 0, pdp: ix.clicks! >= 0 ? Math.round(num("shows-sales", r[ix.clicks!])) : 0, cart: ix.cart! >= 0 ? Math.round(num("shows-sales", r[ix.cart!])) : 0, units: ix.units! >= 0 ? Math.round(num("shows-sales", r[ix.units!])) : 0, deliv: 0, ret: 0, canc: 0, business: b, platform: "ym" });
      }
    }
    fresh.push(...dayRows);
  }
  if (!fresh.length) { console.log("shows: новых строк нет"); return; }
  const merged = existing.concat(fresh).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  writeNdjson(OUT, merged);
  console.log(`shows: +${fresh.length} строк, всего ${merged.length} -> ${OUT}`);
}

async function main() {
  loadEnv(); ensureDir();
  const api = client();
  const cmd = process.argv[2];
  const now = new Date();
  if (cmd === "realization") {
    const args = process.argv.slice(3);
    let months = args.filter((a) => /^\d{4}-\d{2}$/.test(a));
    if (!months.length) { // текущий + предыдущий (доначисления), как у OZON pnl-realization
      const cur = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
      const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      months = [`${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}`, cur];
      if (!readNdjson(yp("realization_monthly.ndjson")).length) { // первый прогон - все месяцы от FLOOR
        months = []; let d = new Date(Date.UTC(Number(FLOOR.slice(0, 4)), Number(FLOOR.slice(5, 7)) - 1, 1));
        while (d.getTime() <= now.getTime()) { months.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
      }
    }
    await realization(api, months);
  } else if (cmd === "netting") {
    const to = process.argv[4] || yesterday();
    const from = process.argv[3] || (readNdjson(yp("netting.ndjson")).length ? addDays(to, -59) : FLOOR);
    await netting(api, from, to);
  } else if (cmd === "shows") {
    await shows(api, Number(process.argv[3] || process.env.YM_SHOWS_DAYS || 7) || 7);
  } else { console.error("usage: reports.ts realization [YYYY-MM...] | netting [from] [to] | shows [days]"); process.exit(2); }
  flushBad();
}

main().catch((e) => { console.error("ym-reports FAILED:", (e as Error).message); process.exit(0); }); // мягкий продьюсер
