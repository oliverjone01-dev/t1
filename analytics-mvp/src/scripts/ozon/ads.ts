// Прямой клиент OZON Performance - замена n8n-вебхука gengroup-ozon-ads (снимок кампаний).
// Бакет-путь (без per-SKU async-отчёта - он ленивый/кэш): кампании, ДРР/CPO/ROAS, сливы, по линиям.
// На connector/OzonPerformance (token+withRetry). Креды: OZON_PERF_CLIENT_ID/OZON_PERF_SECRET.
// Выход 1:1 со снимком n8n (skuStats:[]). FENIX: верифицировать отдельным пилотом перед cutover.
// Запуск: tsx src/scripts/ozon/ads.ts [days] [outFile]  (или [dateFrom dateTo outFile])
import { writeFileSync } from "node:fs";
import { OzonPerformance } from "../../connector/ozon-performance.js";

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

// Классификаторы из n8n ads (свои, отличаются от util/line.ts - по артикулам кампаний).
export function adLineOf(s: string): string {
  s = (s || "").toUpperCase();
  if (s.includes("TRUBIS")) return "TRUBIS";
  if (s.includes("VIOLUR")) return "VIOLUR";
  if (s.includes("NOLVIS")) return "NOLVIS";
  if (s.includes("OSOLIS")) return "OSOLIS";
  if (s.includes("REF_VK")) return "внешний трафик";
  if (s.includes("GGTW") || s.includes("GGT")) return "столы";
  if (s.includes("GGM")) return "зеркала/металл";
  if (s.includes("GGL")) return "свет";
  return "прочее";
}
// «Инструмент» = тип рекламного объекта (Трафареты / Продвижение в поиске / ...), а модель
// оплаты (за клик/заказ) - вторична и идёт в скобках. Раньше оплата перекрывала инструмент,
// поэтому в колонке у всех CPC-кампаний стояло «Оплата за клик» вместо реального инструмента.
export function instrOf(t: string, pt: string): string {
  const tool =
    t === "SEARCH_PROMO" ? "Продвижение в поиске" :
    t === "SKU" ? "Трафареты" :
    t === "ALL_SKU_PROMO" ? "Оплата за заказ (все товары)" :
    t === "REF_VK" ? "Внешний трафик (VK)" :
    (t || "");
  const pay = pt === "CPC" ? "за клик" : pt === "CPO" ? "за заказ" : "";
  if (tool && pay && t !== "ALL_SKU_PROMO") return `${tool} (${pay})`;
  if (tool) return tool;
  return pt === "CPC" ? "Оплата за клик" : pt === "CPO" ? "Оплата за заказ" : "-";
}
const PLM: Record<string, string> = {
  PLACEMENT_SEARCH_AND_CATEGORY: "Поиск и рекомендации", PLACEMENT_PDP: "Карточка товара",
  PLACEMENT_TOP_PROMOTION: "Топ выдачи", PLACEMENT_OVERTOP: "Над топом",
};
export function plOf(arr: string[]): string { return (arr || []).map((p) => PLM[p] || String(p).replace("PLACEMENT_", "")).join(", ") || "-"; }
export function statusOf(s: string): string { return s === "CAMPAIGN_STATE_RUNNING" ? "активна" : "закрыта"; }

// Дробим окно на куски <=60 дней (лимит диапазона daily-stats OZON), как в n8n dWins.
export function dateWindows(from: string, to: string, maxD = 60): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let s = new Date(`${from}T00:00:00Z`); const end = new Date(`${to}T00:00:00Z`);
  while (s <= end) {
    const e = new Date(s); e.setUTCDate(e.getUTCDate() + maxD - 1); if (e > end) e.setTime(end.getTime());
    out.push([fmt(s), fmt(e)]); s = new Date(e); s.setUTCDate(s.getUTCDate() + 1);
  }
  return out;
}

export async function adsSnapshot(dateFrom: string, dateTo: string): Promise<any> {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  if (!clientId || !clientSecret) throw new Error("OZON_PERF_CLIENT_ID / OZON_PERF_SECRET не заданы (GitHub Secrets)");
  const perf = new OzonPerformance({ clientId, clientSecret });
  const camps = await perf.campaigns();
  const meta: Record<string, { t: string; pl: string[]; pt: string; st: string; title: string }> = {};
  camps.forEach((c) => { meta[c.id] = { t: c.advObjectType, pl: c.placement, pt: c.paymentType, st: c.state, title: c.title }; });
  const ids = camps.map((c) => c.id);

  // Дневная статистика по всем кампаниям, окно дробим на <=60 дней.
  const agg: Record<string, { id: string; title: string; sp: number; o: number; om: number }> = {};
  for (const [wf, wt] of dateWindows(dateFrom, dateTo)) {
    const rows = await perf.dailyStats(ids, wf, wt);
    for (const r of rows) {
      const a = agg[r.id] || (agg[r.id] = { id: r.id, title: r.title || meta[r.id]?.title || r.id, sp: 0, o: 0, om: 0 });
      a.sp += r.spent; a.o += r.orders; a.om += r.ordersMoney;
    }
  }

  const list = Object.values(agg).map((a) => {
    const m = meta[a.id] || { t: "", pl: [], pt: "", st: "", title: a.title };
    return {
      ...a, line: adLineOf(a.title), instr: instrOf(m.t, m.pt), place: plOf(m.pl), status: statusOf(m.st),
      drr: a.om ? Math.round((a.sp / a.om) * 1000) / 10 : 0, cpo: a.o ? Math.round(a.sp / a.o) : 0,
      roas: a.sp ? Math.round((a.om / a.sp) * 10) / 10 : 0,
    };
  });

  // Объекты (продвигаемые SKU) тянем только для топ-10 по расходу.
  const top10 = list.filter((a) => a.sp > 0).sort((x, y) => y.sp - x.sp).slice(0, 10);
  const objectsByCamp: Record<string, string[]> = {};
  for (const a of top10) objectsByCamp[a.id] = await perf.campaignObjects(a.id);

  return { dateFrom, dateTo, generated_at: new Date().toISOString(), ...aggregateAds(list, camps.length, objectsByCamp) };
}

// Чистая агрегация снимка рекламы (тестируется без сети): totals, сливы, top_spend, по линиям.
// Сливы: расход >=3000 и (0 заказов или ДРР>=40), топ-8 по расходу. top_spend: топ-10 по расходу.
export function aggregateAds(
  list: Array<{ id: string; title: string; sp: number; o: number; om: number; line: string; instr: string; place: string; status: string; drr: number; cpo: number; roas: number }>,
  campaignsCount: number,
  objectsByCamp: Record<string, string[]> = {},
): { totals: any; burners: any[]; top_spend: any[]; by_line: any[] } {
  const spent = list.filter((a) => a.sp > 0);
  const T = { spend: 0, om: 0, o: 0 }; spent.forEach((a) => { T.spend += a.sp; T.om += a.om; T.o += a.o; });
  const totals = { spend: Math.round(T.spend), adRevenue: Math.round(T.om), orders: T.o, drr: T.om ? Math.round((T.spend / T.om) * 1000) / 10 : 0, cpo: T.o ? Math.round(T.spend / T.o) : 0, active: spent.length, campaigns: campaignsCount };

  const burners = spent.filter((a) => a.sp >= 3000 && (a.o === 0 || a.drr >= 40)).sort((x, y) => y.sp - x.sp).slice(0, 8)
    .map((a) => ({ off: a.title, id: a.id, line: a.line, status: a.status, sp: Math.round(a.sp), o: a.o, om: Math.round(a.om), drr: a.drr, cpo: a.cpo }));

  const top_spend = spent.slice().sort((x, y) => y.sp - x.sp).slice(0, 10).map((a) => ({
    off: a.title, id: a.id, line: a.line, instr: a.instr, place: a.place, status: a.status,
    sp: Math.round(a.sp), o: a.o, om: Math.round(a.om), drr: a.drr, cpo: a.cpo, roas: a.roas,
    skus: objectsByCamp[a.id] || [], skuStats: [],
  }));

  const lm: Record<string, { line: string; sp: number; om: number; o: number }> = {};
  spent.forEach((a) => { const L = lm[a.line] || (lm[a.line] = { line: a.line, sp: 0, om: 0, o: 0 }); L.sp += a.sp; L.om += a.om; L.o += a.o; });
  const by_line = Object.values(lm).map((L) => ({ line: L.line, sp: Math.round(L.sp), om: Math.round(L.om), o: L.o, drr: L.om ? Math.round((L.sp / L.om) * 1000) / 10 : 0 })).sort((a, b) => b.sp - a.sp);

  return { totals, burners, top_spend, by_line };
}

async function main() {
  const argv = process.argv.slice(2);
  let dateFrom: string, dateTo: string, outFile: string;
  if (argv[0] && /^\d{4}-\d\d-\d\d$/.test(argv[0])) { dateFrom = argv[0]; dateTo = argv[1]!; outFile = argv[2] || "data/ads_30d.json"; }
  else { const w = window(parseInt(argv[0] || "30", 10) || 30); dateFrom = w.dateFrom; dateTo = w.dateTo; outFile = argv[1] || "data/ads_30d.json"; }
  const out = await adsSnapshot(dateFrom, dateTo);
  writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`ads: кампаний ${out.totals.campaigns}, активных ${out.totals.active}, расход ${out.totals.spend}, ${dateFrom}..${dateTo} -> ${outFile}`);
}

if (process.argv[1] && /ads\.ts$/.test(process.argv[1])) main().catch((e) => { console.error("ads FAILED:", (e as Error).message); process.exit(1); });
