import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { closedDay, shiftDay, readRows } from "./collector-integrity.js";

export type SourceHealth = { source: string; through: string | null; expected: string; status: "ok" | "warning" | "error"; note: string };
const json = (path: string): any => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
const maxDate = (rows: any[], fields: string[]) => rows.flatMap(r => fields.map(f => String(r[f] ?? "").slice(0,10))).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1) ?? null;

export function sourceHealth(dir: string, now = new Date()): SourceHealth[] {
  const to = closedDay(now), today = shiftDay(to, 1), out: SourceHealth[] = [];
  const status = json(join(dir, "collector_status.json"));
  const attempt = json(join(dir, "collector_failures.json"));
  if (attempt.failures?.length) out.push({source:"Последняя загрузка",through:attempt.attempted_at ?? null,expected:to,status:"error",note:attempt.failures.join("; ")});
  const defs: Array<[string, string, string[], string?]> = [
    ["Заказы", "orders_daily.ndjson", ["d"]], ["Продажи", "history.ndjson", ["date"]],
    ["Дневные итоги", "daily_totals.ndjson", ["date"]], ["Воронка SKU", "sku_views.ndjson", ["date"]],
    ["Расход кампаний", "ads_daily.ndjson", ["d"]], ["Расход CPC по SKU", "ads_sku_daily.ndjson", ["d"]],
    ["Атрибуция CPC", "ads_attr_daily.ndjson", ["d"]], ["Дневная реализация", "realization_daily.ndjson", ["d"]],
    ["Начисления SKU", "acq_sku_daily.ndjson", ["d"], "acq-sku-daily"],
    ["Финансы канала", "pnl_channel_accrual_daily.ndjson", ["d"], "pnl-accrual-daily"],
    ["Финансы SKU по дате заказа", "pnl_sku_accrual_daily.ndjson", ["d"], "pnl-sku-accrual-daily"],
    ["Цены", "prices_daily.ndjson", ["d"]],
  ];
  for (const [source, file, fields, collector] of defs) {
    const rows = readRows(join(dir, file));
    const through = collector && status[collector]?.through || maxDate(rows, fields);
    // У доставленных заказов последняя дата заказа может быть старше даты выгрузки.
    const expected = collector === "pnl-sku-accrual-daily" && !status[collector] ? shiftDay(to, -7) : to;
    out.push({ source, through, expected, status: through && through >= expected ? "ok" : "error", note: collector && status[collector] ? `Успешная загрузка ${status[collector].loaded_at}` : "Дата последней строки; не подтверждает отсутствие внутренних пропусков" });
  }
  const cabinet = json(join(dir, "reakciya.json"));
  const cabThrough = cabinet.data_until ?? cabinet.updated ?? null;
  out.push({ source: "Кабинет: акции и цены", through: cabThrough, expected: today, status: cabThrough && cabThrough >= today ? "ok" : "warning", note: "Съём с Mac; сегодняшний день может быть неполным" });
  for (const [source, file, fields] of [
    ["CPO: ставки и позиции", "cpo_sku_status.ndjson", ["date", "d"]],
    ["CPO: ручная выгрузка", "cpo_sku_daily.ndjson", ["d"]],
    ["Наша доставка: ручная ведомость", "delivery_sku_daily.ndjson", ["d"]],
  ] as Array<[string,string,string[]]>) {
    const through = maxDate(readRows(join(dir, file)), fields);
    out.push({ source, through, expected: to, status: through && through >= to ? "ok" : "warning", note: "Более поздние даты не подтверждены. Нужна новая выгрузка/съём кабинета" });
  }
  const periods = json(join(dir, "ads_periods.json")), ids = new Set<string>();
  for (const p of ["p7", "p30", "p90"]) for (const k of ["top_spend", "burners"]) for (const c of periods[p]?.[k] ?? []) ids.add(String(c.id));
  const meta = { ...periods.p90?.camp_meta, ...periods.p30?.camp_meta, ...periods.p7?.camp_meta };
  const attr = new Set(readRows(join(dir, "ads_attr_daily.ndjson")).map(r => `${r.d}|${r.id}`));
  const gaps = readRows(join(dir, "ads_daily.ndjson")).filter(r => r.d >= shiftDay(to,-6) && r.d <= to && r.sp > 0 && ids.has(String(r.id)) && meta[String(r.id)]?.instr === "Оплата за клик" && !attr.has(`${r.d}|${r.id}`));
  if (gaps.length) out.push({ source: "Полнота атрибуции кампаний", through: null, expected: to, status: "error", note: `Нет строк для ${gaps.length} пар кампания/день: ${gaps.map(r => `${r.id} (${r.d})`).join(", ")}. Возможен fallback на расход SKU; атрибуция продаж не подтверждена` });
  out.push({ source: "Архив transaction/list", through: "2026-09-07", expected: "2026-09-07", status: "ok", note: "Историческая граница. Метод отключён, текущие деньги берутся из accrual/реализации" });
  return out;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function healthHtml(dir: string, now = new Date()): string {
  const rows = sourceHealth(dir, now), bad = rows.filter(r => r.status !== "ok");
  return `<details class="source-health" style="margin:10px 16px;padding:10px;border:1px solid ${bad.length ? "#eab308" : "#3a7666"};border-radius:8px;font:13px/1.5 system-ui"><summary>Свежесть источников: ${bad.length ? `${bad.length} требуют внимания` : "проверенные источники актуальны"}</summary><table><thead><tr><th>Источник</th><th>Данные по</th><th>Состояние</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.source)}</td><td>${esc(r.through ?? "не подтверждено")}</td><td>${r.status === "ok" ? "✓" : "⚠"} ${esc(r.note)}</td></tr>`).join("")}</tbody></table></details>`;
}

if (process.argv[1] && /source-health\.ts$/.test(process.argv[1])) {
  const rows = sourceHealth(process.env.DATA_DIR || "data");
  for (const r of rows.filter(r => r.status !== "ok")) console.log(`::${r.status === "error" ? "error" : "warning"}::${r.source}: по ${r.through ?? "не подтверждено"}, ожидалось ${r.expected}. ${r.note}`);
  if (rows.some(r => r.status === "error")) process.exitCode = 1;
}
