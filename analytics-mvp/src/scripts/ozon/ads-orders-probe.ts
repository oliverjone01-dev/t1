// PROBE v4: ищем, откуда OZON отдаёт заказы по SKU (в т.ч. CPO). Пробуем свежее короткое окно,
// CSV-вариант, числовые/строковые id, полный дамп ответа и статуса. НЕ в ночном синке.
import { OzonPerformance } from "../../connector/ozon-performance.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  if (!clientId || !clientSecret) { console.warn("нет кредов"); return; }
  const perf = new OzonPerformance({ clientId, clientSecret });
  const to = ymd(new Date(Date.now() - 864e5)), from14 = ymd(new Date(Date.now() - 15 * 864e5)), from7 = ymd(new Date(Date.now() - 8 * 864e5));
  const camps = await perf.campaigns();
  const pay: Record<string, string> = {}; for (const c of camps) pay[c.id] = c.paymentType || "?";
  const stats = await perf.dailyStats(camps.map((c) => c.id), from14, to);
  const ord: Record<string, number> = {}, sp: Record<string, number> = {};
  for (const r of stats) { const id = String((r as any).id); ord[id] = (ord[id] || 0) + ((r as any).orders || 0); sp[id] = (sp[id] || 0) + ((r as any).spent || 0); }
  const withOrders = Object.keys(ord).filter((id) => ord[id]! > 0).sort((a, b) => ord[b]! - ord[a]!);
  const cpc = withOrders.find((id) => /CPC|клик/i.test(pay[id] || "")) || withOrders[0]!;
  const cpo = Object.keys(sp).filter((id) => /за заказ|CPO/i.test(pay[id] || "") && sp[id]! > 0).sort((a, b) => sp[b]! - sp[a]!)[0] || "";
  console.log(`Окно ${from14}..${to}. CPC с заказами: ${cpc} (заказов ${ord[cpc] || 0}); CPO: ${cpo} (расход ${Math.round(sp[cpo] || 0)})`);

  async function run(label: string, path: string, body: any, isCsvDownload = false) {
    console.log(`\n### ${label}\n  POST ${path} ${JSON.stringify(body)}`);
    let d: any;
    try { d = await perf.rawPost(path, body); } catch (e) { console.error("  generate ERR:", (e as Error).message); return; }
    const uuid = String(d.UUID ?? d.uuid ?? d.id ?? ""); console.log("  generate:", JSON.stringify(d).slice(0, 200));
    if (!uuid) return;
    for (let i = 0; i < 60; i++) { let s: any; try { s = await perf.statisticsState(uuid); } catch (e) { console.error("  state ERR:", (e as Error).message); return; } const st = String(s.state ?? ""); if (i === 0 || /\b(ok|done|success|ready|error|fail)\b/i.test(st)) console.log(`  state[${i}]:`, JSON.stringify(s).slice(0, 300)); if (/\b(ok|done|success|ready)\b/i.test(st)) break; if (/\b(error|fail)\b/i.test(st)) return; await sleep(3000); }
    const dl = isCsvDownload ? `/api/client/statistics/report?UUID=${uuid}` : `/api/client/statistics/report?UUID=${uuid}`;
    const text = await perf.rawGetText(dl);
    console.log("  DOWNLOAD:", text.slice(0, 1400));
  }

  const P_JSON = "/api/client/statistics/orders/generate/json";
  const P_CSV = "/api/client/statistics/orders/generate/csv";
  if (cpc) await run("V1 CPC json 14д строка", P_JSON, { campaigns: [cpc], from: `${from14}T00:00:00.000Z`, to: `${to}T23:59:59.000Z` });
  if (cpc) await run("V2 CPC json 14д ЧИСЛО", P_JSON, { campaigns: [Number(cpc)], from: `${from14}T00:00:00.000Z`, to: `${to}T23:59:59.000Z` });
  if (cpc) await run("V3 CPC CSV 14д", P_CSV, { campaigns: [cpc], from: `${from14}T00:00:00.000Z`, to: `${to}T23:59:59.000Z` });
  if (cpc) await run("V4 CPC json 7д", P_JSON, { campaigns: [cpc], from: `${from7}T00:00:00.000Z`, to: `${to}T23:59:59.000Z` });
  if (cpo) await run("V5 CPO json 14д", P_JSON, { campaigns: [cpo], from: `${from14}T00:00:00.000Z`, to: `${to}T23:59:59.000Z` });
  if (cpo) await run("V6 CPO CSV 14д", P_CSV, { campaigns: [cpo], from: `${from14}T00:00:00.000Z`, to: `${to}T23:59:59.000Z` });
}

main().catch((e) => { console.error("FAILED:", (e as Error).message); process.exit(0); });
