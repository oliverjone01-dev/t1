// План маркетинга из Google-таблицы (CSV) -> data/plan_monthly.json.
// Таблица: колонки Источник, Месяц (YYYY-MM), Начислено, Выручка, «Реализация, шт»,
// «Реклама, потолок», «Рентабельность, %», Чистая прибыль. Берём строки Источник=OZON
// (дашборд OZON-план плоский). Другие источники добавим, когда подключим их фильтры.
// Запуск: tsx src/scripts/plan-from-sheet.ts <csvПуть> [outJson]
import { readFileSync, writeFileSync } from "node:fs";

const OUT_DEFAULT = "data/plan_monthly.json";
const num = (s: string): number | null => {
  const t = String(s ?? "").replace(/[\s ₽%]/g, "").replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
// Разбор одной CSV-строки с учётом кавычек.
function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur); return out.map((s) => s.trim());
}
const norm = (s: string) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export function parsePlanCsv(text: string, source = "OZON"): Record<string, any> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return {};
  const header = splitCsv(lines[0]!).map(norm);
  const col = (pred: (h: string) => boolean) => header.findIndex(pred);
  const ci = {
    src: col((h) => h.includes("источник")),
    month: col((h) => h.includes("месяц")),
    accrued: col((h) => h.includes("начислен")),
    revenue: col((h) => h.includes("выручк")),
    realized: col((h) => h.includes("реализац")),
    adSpend: col((h) => h.includes("реклам")),
    rentab: col((h) => h.includes("рентаб")),
    netProfit: col((h) => h.includes("чист") && h.includes("приб")),
  };
  const out: Record<string, any> = {};
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsv(lines[i]!);
    if (ci.src >= 0 && norm(c[ci.src] ?? "") !== source.toLowerCase()) continue;
    const ym = String(c[ci.month] ?? "").trim();
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    const rec: Record<string, number> = {};
    const put = (k: string, idx: number) => { if (idx >= 0) { const v = num(c[idx] ?? ""); if (v != null) rec[k] = v; } };
    put("adSpend", ci.adSpend); put("rentab", ci.rentab); put("revenue", ci.revenue);
    put("realized", ci.realized); put("netProfit", ci.netProfit); put("accrued", ci.accrued);
    out[ym] = rec;
  }
  return out;
}

if (process.argv[1] && /plan-from-sheet\.ts$/.test(process.argv[1])) {
  const csvPath = process.argv[2], outPath = process.argv[3] || OUT_DEFAULT;
  if (!csvPath) { console.error("нужен путь к CSV"); process.exit(1); }
  const plan = parsePlanCsv(readFileSync(csvPath, "utf-8"));
  const months = Object.keys(plan).length;
  if (!months) { console.warn("plan-from-sheet: строк OZON не найдено - plan_monthly.json НЕ трогаем"); process.exit(0); }
  const obj: Record<string, any> = { _note: "План по месяцам (источник OZON). Заполняется в Google-таблице, синхронизируется автоматически. Поля: adSpend, rentab, revenue, realized, netProfit, accrued." };
  for (const k of Object.keys(plan).sort()) obj[k] = plan[k];
  writeFileSync(outPath, JSON.stringify(obj, null, 2) + "\n");
  console.log(`plan-from-sheet: ${months} мес -> ${outPath}`);
}
