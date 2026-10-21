// Только чтение API. Не пишет data/, не меняет кабинет и не публикует сайт.
import { OzonSeller } from "../../connector/ozon-seller.js";
import { OzonPerformance } from "../../connector/ozon-performance.js";
import { closedDay, requireCredentials, readRows } from "./collector-integrity.js";
import { attributionReport, supportsSkuReport } from "./attribution-report.js";

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID ?? "", apiKey = process.env.OZON_SELLER_API_KEY ?? "";
  const perfId = process.env.OZON_PERF_CLIENT_ID ?? "", clientSecret = process.env.OZON_PERF_SECRET ?? "";
  requireCredentials(clientId,apiKey,perfId,clientSecret);
  const day = closedDay(), seller = new OzonSeller({clientId,apiKey}), perf = new OzonPerformance({clientId:perfId,clientSecret});
  let failures = 0;
  async function probe(name: string, run: () => Promise<number>) {
    try { console.log(`PROBE ${name}: OK, строк ${await run()}`); }
    catch (e) { failures++; console.error(`PROBE ${name}: FAIL: ${(e as Error).message}`); }
  }
  await probe(`accrual/types`, async () => (await seller.accrualTypes()).length);
  await probe(`accrual/by-day ${day}`, async () => (await seller.accrualByDay(day)).length);
  await probe(`dayTotals ${day}`, async () => (await seller.dayTotals(day,day)).length);
  await probe(`skuViewsDay ${day}`, async () => (await seller.skuViewsDay(day)).length);
  await probe(`postings + accrual/postings ${day}`, async () => {
    const posts = await seller.postings(day,day);
    return (await seller.accrualPostings(posts.slice(0,3).map(p => p.posting_number))).length;
  });
  const campaigns = await perf.campaigns(), supported = new Set(campaigns.filter(supportsSkuReport).map(c=>c.id));
  const stats = await perf.dailyStats(campaigns.map(c=>c.id),day,day);
  const present = new Set(readRows("data/ads_attr_daily.ndjson").filter(r=>r.d===day).map(r=>String(r.id)));
  const candidates = stats.filter(r=>r.spent>0 && supported.has(r.id)).sort((a,b)=>Number(present.has(a.id))-Number(present.has(b.id)) || b.spent-a.spent).slice(0,4);
  if (!candidates.length) throw new Error("Нет CPC кампаний для пробы отчётов");
  const deadline = Date.now()+18*60000;
  for (const c of candidates) await probe(`DATE CSV ${c.id} ${day}`, async () => {
    const rows = await attributionReport(perf,c.id,day,day,deadline);
    if (!rows.length || rows.some(r=>r.date!==day)) throw new Error("Пустой/неполный отчёт при положительном расходе");
    return rows.length;
  });
  if (failures) throw new Error(`Не пройдены ${failures} проб`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
