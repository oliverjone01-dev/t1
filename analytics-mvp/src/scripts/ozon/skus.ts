// Прямой клиент OZON - замена n8n-вебхука gengroup-ozon-skus (живые SKU + индекс цен + остатки + ДРР по линиям).
// На connector/OzonSeller (analytics/stocks/prices) + OzonPerformance (dailyStats для ДРР по линиям), всё под withRetry.
// Креды из env: OZON_SELLER_CLIENT_ID/API_KEY, OZON_PERF_CLIENT_ID/OZON_PERF_SECRET.
// Выход 1:1 со снимком n8n: {dateFrom,dateTo,generated_at,totals,by_line,sku_table}.
// Запуск: tsx src/scripts/ozon/skus.ts [days] [outFile]
import { writeFileSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";
import { OzonPerformance } from "../../connector/ozon-performance.js";
import { lineOf } from "../../util/line.js";

const FLOOR = "2026-02-01";
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function window(days: number): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); y.setUTCDate(y.getUTCDate() - 1);
  const to = fmt(y);
  const f = new Date(y); f.setUTCDate(f.getUTCDate() - (days - 1));
  let from = fmt(f); if (from < FLOOR) from = FLOOR;
  return { dateFrom: from, dateTo: to };
}

export async function skusLive(dateFrom: string, dateTo: string): Promise<any> {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) throw new Error("OZON_SELLER_CLIENT_ID / OZON_SELLER_API_KEY не заданы (GitHub Secrets)");
  const seller = new OzonSeller({ clientId, apiKey });

  // 1) Аналитика по SKU за окно
  const rows = await seller.analytics(dateFrom, dateTo, "sku");
  const skus: any[] = [];
  const lineMap: Record<string, { line: string; rev: number; units: number; ret: number; sk: number }> = {};
  for (const x of rows) {
    const rev = x.metrics[0] ?? 0;
    if (rev <= 0) continue;
    const units = x.metrics[1] ?? 0, views = x.metrics[2] ?? 0, cart = x.metrics[3] ?? 0,
      deliv = x.metrics[4] ?? 0, ret = x.metrics[5] ?? 0, canc = x.metrics[6] ?? 0;
    const line = lineOf(x.name);
    skus.push({
      sku: String(x.id), name: x.name, line,
      rev: Math.round(rev), units, views, cart, deliv, ret, canc,
      convCart: views ? Math.round((cart / views) * 1000) / 10 : 0,
      convOrd: views ? Math.round((units / views) * 1000) / 10 : 0,
      retp: (units + ret) ? Math.round((ret / (units + ret)) * 1000) / 10 : 0,
      aov: units ? Math.round(rev / units) : 0,
    });
    const L = lineMap[line] || (lineMap[line] = { line, rev: 0, units: 0, ret: 0, sk: 0 });
    L.rev += rev; L.units += units; L.ret += ret; L.sk += 1;
  }

  // 2) Остатки и индекс цены (по offer_id)
  const so: Record<string, string> = {}, os: Record<string, number> = {};
  try {
    for (const s of await seller.stocks()) {
      if (s.sku && s.sku !== "undefined") so[s.sku] = s.offer_id;
      os[s.offer_id] = (os[s.offer_id] || 0) + (s.present - s.reserved);
    }
  } catch { /* остатки не критичны */ }
  const pm: Record<string, { pidx: number | null; pcol: string; price: number | null }> = {};
  try {
    for (const p of await seller.prices()) {
      pm[p.offer_id] = { pidx: p.price_index_value != null ? Math.round(p.price_index_value * 100) / 100 : null, pcol: p.color_index || "", price: p.price != null ? Math.round(p.price) : null };
    }
  } catch { /* индекс/цена не критичны */ }
  for (const s of skus) {
    const off = so[s.sku] || "";
    s.offer = off; s.stock = off ? (os[off] || 0) : 0;
    const p = off ? (pm[off] || {}) : {};
    s.pidx = (p as any).pidx != null ? (p as any).pidx : null;
    s.pcol = (p as any).pcol || "";
    s.price = (p as any).price != null ? (p as any).price : null; // текущая цена с витрины, ₽
    s.oos = (s.units > 0 && s.stock <= 0) ? 1 : 0;
  }

  // 3) ДРР по линиям из рекламы (Performance dailyStats), если креды есть
  const adsByLine: Record<string, { sp: number; om: number }> = {};
  const perfId = process.env.OZON_PERF_CLIENT_ID || "", perfSecret = process.env.OZON_PERF_SECRET || "";
  if (perfId && perfSecret) {
    try {
      const perf = new OzonPerformance({ clientId: perfId, clientSecret: perfSecret });
      const camps = await perf.campaigns();
      const titleOf: Record<string, string> = {}; camps.forEach((c) => (titleOf[c.id] = c.title));
      const stats = await perf.dailyStats(camps.map((c) => c.id), dateFrom, dateTo);
      for (const r of stats) {
        const ln = lineOf(r.title || titleOf[r.id] || "");
        const a = adsByLine[ln] || (adsByLine[ln] = { sp: 0, om: 0 });
        a.sp += r.spent; a.om += r.ordersMoney;
      }
    } catch { /* реклама не критична для снимка SKU */ }
  }

  const by_line = Object.keys(lineMap).map((k) => {
    const L = lineMap[k]!; const ad = adsByLine[k] || { sp: 0, om: 0 };
    return { line: k, rev: Math.round(L.rev), units: L.units, ret: L.ret, sk: L.sk, ad_spend: Math.round(ad.sp), ad_drr: ad.om ? Math.round((ad.sp / ad.om) * 1000) / 10 : 0 };
  }).sort((a, b) => b.rev - a.rev);

  const totals: any = { rev: 0, units: 0, ret: 0, canc: 0, views: 0, sk: skus.length };
  for (const s of skus) { totals.rev += s.rev; totals.units += s.units; totals.ret += s.ret; totals.canc += s.canc; totals.views += s.views; }
  totals.rev = Math.round(totals.rev); totals.oos = skus.filter((s) => s.oos).length;
  let adSp = 0, adOm = 0; for (const k in adsByLine) { adSp += adsByLine[k]!.sp; adOm += adsByLine[k]!.om; }
  totals.ad_spend = Math.round(adSp); totals.ad_drr = adOm ? Math.round((adSp / adOm) * 1000) / 10 : 0;

  return { dateFrom, dateTo, generated_at: new Date().toISOString(), totals, by_line, sku_table: skus };
}

async function main() {
  const argv = process.argv.slice(2);
  const days = parseInt(argv[0] || "30", 10) || 30;
  const outFile = argv[1] || "data/skus_live_30d.json";
  const w = window(days);
  const out = await skusLive(w.dateFrom, w.dateTo);
  writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`skus: ${out.sku_table.length} SKU, выручка ${out.totals.rev}, ${w.dateFrom}..${w.dateTo} -> ${outFile}`);
}

if (process.argv[1] && /skus\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("skus FAILED:", (e as Error).message); process.exit(1); });
