// Отчёт о реализации ЗА ДЕНЬ по SKU -> data/realization_daily.ndjson (Иван 25.09.2026, п. 1.4 и 2.2).
// Источник: POST /v1/finance/realization/by-day {day, month, year}. Формат строки - как у месячного
// отчёта (/v2/finance/realization): delivery_commission / return_commission с amount (F), bonus,
// bank_coinvestment + stars + pick_up_point_coinvestment (G), standard_fee, total. Разбор - тот же
// parseRow, что у месячного, чтобы деньги двух отчётов не могли разойтись по смыслу.
//
// Зачем: месячный отчёт выходит только за закрытый месяц, а по текущему месяцу нужны и база налога
// «Реализовано» (F + G − J − K), и деньги таблицы по артикулам по дате реализации, без шва между
// источниками. OZON хранит отчёт за день не глубже 32 дней, поэтому файл НАКОПИТЕЛЬНЫЙ: каждый прогон
// перетягивает последние DEPTH дней, более старые дни остаются как были.
//
// Строка: {d, sku, sold, ret, f, g, j, k, tb, bonus, com, pay}; com - комиссия нетто (standard_fee,
// положительная), pay - к выплате нетто (total). Запуск: OZON_SELLER_* в env;
// npx tsx src/scripts/ozon/realization-daily.ts [ДНЕЙ]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseRow } from "./pnl-realization.js";

const OUT = "data/realization_daily.ndjson";
const HOST = "https://api-seller.ozon.ru";
const DEPTH = Number(process.argv[2] || 31); // OZON отдаёт не глубже 32 дней

type Row = { d: string; sku: string; sold: number; ret: number; f: number; g: number; j: number; k: number; tb: number; bonus: number; com: number; pay: number };
const KEYS = ["sold", "ret", "f", "g", "j", "k", "tb", "bonus", "com", "pay"] as const;

export function aggDay(d: string, rows: any[]): Row[] {
  const by: Record<string, Row> = {};
  for (const r of rows) {
    const p = parseRow(r); if (!p) continue;
    const o = (by[p.sku] ||= { d, sku: p.sku, sold: 0, ret: 0, f: 0, g: 0, j: 0, k: 0, tb: 0, bonus: 0, com: 0, pay: 0 });
    o.sold += p.sold; o.ret += p.ret; o.f += p.f; o.g += p.g; o.j += p.j; o.k += p.k; o.tb += p.tb; o.bonus += p.bonus;
    o.com += p.commission; o.pay += p.payout;
  }
  const kop = (v: number) => Math.round(v * 100) / 100;
  return Object.values(by).map((o) => { for (const k of KEYS) (o as any)[k] = kop((o as any)[k]); return o; });
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("realization-daily: OZON_SELLER_* нет - пропуск"); return; }
  const headers = { "Client-Id": clientId, "Api-Key": apiKey, "Content-Type": "application/json" };
  const days: string[] = [];
  for (let i = DEPTH; i >= 1; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));

  const old: Row[] = existsSync(OUT) ? readFileSync(OUT, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const fresh: Row[] = []; const got = new Set<string>();
  for (const d of days) {
    const [y, m, dd] = d.split("-").map(Number);
    try {
      const res = await fetch(`${HOST}/v1/finance/realization/by-day`, { method: "POST", headers, body: JSON.stringify({ day: dd, month: m, year: y }) });
      if (!res.ok) { console.warn(`  ${d}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`); continue; }
      const data: any = await res.json();
      const rows: any[] = data?.result?.rows ?? data?.rows ?? [];
      fresh.push(...aggDay(d, rows)); got.add(d);
    } catch (e) { console.warn(`  ${d}: ${(e as Error).message}`); }
  }
  // День, который OZON отдал, заменяет старые строки этого дня целиком (в том числе пустым ответом).
  const merged = old.filter((r) => !got.has(r.d)).concat(fresh).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.sku < b.sku ? -1 : 1));
  writeFileSync(OUT, merged.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const byM: Record<string, { n: number; f: number; g: number; j: number; k: number; tb: number; bonus: number; pay: number; days: Set<string> }> = {};
  for (const r of merged) { const b = (byM[r.d.slice(0, 7)] ||= { n: 0, f: 0, g: 0, j: 0, k: 0, tb: 0, bonus: 0, pay: 0, days: new Set() }); b.n += r.sold - r.ret; b.f += r.f; b.g += r.g; b.j += r.j; b.k += r.k; b.tb += r.tb; b.bonus += r.bonus; b.pay += r.pay; b.days.add(r.d); }
  const fmt = (v: number) => (Math.round(v * 100) / 100).toLocaleString("ru-RU");
  console.log(`realization-daily: получено дней ${got.size} из ${days.length}, строк в файле ${merged.length}`);
  for (const m of Object.keys(byM).sort()) { const b = byM[m]!; console.log(`  ${m}: дней с продажами ${b.days.size}, шт ${b.n}, F ${fmt(b.f)}, G ${fmt(b.g)}, J ${fmt(b.j)}, K ${fmt(b.k)}, база ${fmt(b.tb)}, баллы ${fmt(b.bonus)}, к выплате ${fmt(b.pay)}`); }
}

if (process.argv[1] && /realization-daily\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("realization-daily FAILED:", (e as Error).message); process.exit(0); });
