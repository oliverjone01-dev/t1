// Только чтение API. Не пишет data/, не меняет кабинет и не публикует сайт.
import { OzonSeller } from "../../connector/ozon-seller.js";
import { OzonPerformance } from "../../connector/ozon-performance.js";
import { closedDay, shiftDay, requireCredentials, readRows } from "./collector-integrity.js";
import { readFileSync } from "node:fs";
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
  const periods = JSON.parse(readFileSync("data/ads_periods.json","utf8")), dashboard = new Set<string>();
  for (const p of ["p7","p30","p90"]) for (const k of ["top_spend","burners"]) for (const c of periods[p]?.[k] ?? []) dashboard.add(String(c.id));
  const present = new Set(readRows("data/ads_attr_daily.ndjson").filter(r=>r.d===day).map(r=>String(r.id)));
  const candidates = stats.filter(r=>r.spent>0 && supported.has(r.id) && dashboard.has(r.id)).sort((a,b)=>Number(present.has(a.id))-Number(present.has(b.id)) || b.spent-a.spent).slice(0,4);
  if (!candidates.length) throw new Error("Нет CPC кампаний для пробы отчётов");
  const deadline = Date.now()+18*60000;
  const download = perf.downloadStatistics.bind(perf);
  perf.downloadStatistics = async uuid => {
    const csv = await download(uuid), lines = csv.split(/\r?\n/).filter(l=>l.trim());
    const h = lines.findIndex(l=>/(^|;)\s*sku\s*;/i.test(l) && /продажи в продвижении/i.test(l));
    // Только форма, даты и наличие SKU; без имён товаров и денежных значений.
    const shape = (l: string) => {const c=l.split(";");return {date:c[0],sku_present:!!c[1]?.trim(),sku_numeric:/^\d+$/.test(c[1]?.trim() ?? ""),columns:c.length};};
    const unusual = lines.slice(h+1).filter(l=>{const c=l.split(";");return !/^\d{2}\.\d{2}\.\d{4}$/.test(c[0]?.trim() ?? "") || !/^\d+$/.test(c[1]?.trim() ?? "");});
    console.log("CSV SHAPE",JSON.stringify({lines:lines.length,header:h<0?null:lines[h],sample:lines.slice(h+1,h+5).map(shape),unusual:unusual.slice(0,8).map(shape)}));
    return csv;
  };
  for (const c of candidates) await probe(`DATE CSV ${c.id} ${day}`, async () => {
    const from=shiftDay(day,-54);
    const rows = await attributionReport(perf,c.id,from,day,deadline,r=>console.log("CSV CORRECTION",JSON.stringify({cid:c.id,from:r.from,to:r.to,fields:Object.keys(r.values),undated:true})));
    console.log("CSV BOUNDS",JSON.stringify({cid:c.id,from,to:day,first:rows.map(r=>r.date).sort()[0],last:rows.map(r=>r.date).sort().at(-1),outside:[...new Set(rows.filter(r=>r.date<from||r.date>day).map(r=>r.date))]}));
    if (rows.some(r=>r.date<from||r.date>day)) throw new Error("DATE-строки вне запрошенных московских суток");
    if (!rows.some(r=>r.date===day)) throw new Error(`В отчёте нет ${day} при положительном расходе; строк ${rows.length}, последняя дата ${rows.map(r=>r.date).sort().at(-1) ?? "нет"}`);
    return rows.length;
  });
  // Paired UTC/MSK requests over the same closed historical window. Read-only:
  // no report rows or monetary values are printed or written to the repository.
  for (const c of candidates.slice(0,2)) {
    const to=shiftDay(day,-2), from=shiftDay(to,-6);
    for (const offset of ["+00:00","+03:00"]) await probe(`DATE BOUNDARY ${c.id} ${offset}`,async()=>{
      const client=new OzonPerformance({clientId:perfId,clientSecret});
      client.requestStatistics=async(campaigns,dateFrom,dateTo,groupBy="DATE")=>{
        const data=await (client as any).post("/api/client/statistics",{campaigns,from:`${dateFrom}T00:00:00${offset}`,to:`${dateTo}T23:59:59${offset}`,groupBy});
        return String(data.UUID??data.uuid??data.id??"");
      };
      const rows=await attributionReport(client,c.id,from,to,deadline,()=>{});
      const outside=[...new Set(rows.filter(r=>r.date<from||r.date>to).map(r=>r.date))];
      console.log("BOUNDARY RESULT",JSON.stringify({cid:c.id,offset,from,to,first:rows.map(r=>r.date).sort()[0],last:rows.map(r=>r.date).sort().at(-1),outside,rows:rows.length}));
      if (offset === "+03:00" && outside.length) throw new Error("MSK boundary did not constrain DATE rows");
      return rows.length;
    });
  }
  if (failures) throw new Error(`Не пройдены ${failures} проб`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
