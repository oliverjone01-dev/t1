import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const fixture = vi.hoisted(() => ({ dir: "" }));
vi.mock("node:fs", async importOriginal => {
  const fs = await importOriginal<typeof import("node:fs")>();
  const map = (p: any) => typeof p === "string" && p.startsWith("data/") ? `${fixture.dir}/${p}` : p;
  return { ...fs,
    existsSync: (p: any) => fs.existsSync(map(p)),
    readFileSync: (p: any, ...args: any[]) => (fs.readFileSync as any)(map(p), ...args),
    writeFileSync: (p: any, ...args: any[]) => (fs.writeFileSync as any)(map(p), ...args),
    renameSync: (a: any,b: any) => fs.renameSync(map(a),map(b)),
    unlinkSync: (p: any) => fs.unlinkSync(map(p)),
  };
});
import { closedDay, dates, pendingDays, collectDaily, validateRows, replaceSlice } from "./collector-integrity.js";
import { OzonSeller } from "../../connector/ozon-seller.js";
import { OzonPerformance } from "../../connector/ozon-performance.js";
import { attributionReport } from "./attribution-report.js";
import { main as acq } from "./acq-sku-daily.js";
import { main as pnl } from "./pnl-accrual-daily.js";
import { main as skuPnl } from "./pnl-sku-accrual-daily.js";
import { main as adsSku } from "./ad-sku-daily.js";
import { main as attr } from "./ad-attribution-daily.js";
import { sourceHealth, healthHtml } from "./source-health.js";

const put = (name: string, value: unknown, nd = true) => writeFileSync(`data/${name}`, nd ? (value as any[]).map(r => JSON.stringify(r)).join("\n") + "\n" : JSON.stringify(value));
const raw = (name: string) => readFileSync(`data/${name}`, "utf8");
const csv = (day = "2026-10-20") => `День;SKU;Название товара;Расход;Продано товаров;Продажи в продвижении\n${day.split("-").reverse().join(".")};123;Товар;100;1;500\n`;
let argv: string[];
beforeEach(() => {
  fixture.dir = mkdtempSync(join(tmpdir(), "ozon-integrity-")); mkdirSync(join(fixture.dir,"data"));
  argv = process.argv; process.argv = ["node", "fixture.ts"];
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  for (const key of ["OZON_SELLER_CLIENT_ID", "OZON_SELLER_API_KEY", "OZON_PERF_CLIENT_ID", "OZON_PERF_SECRET"]) vi.stubEnv(key,"fixture");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Запрещён выход в сеть из fixture"); }));
  vi.spyOn(console,"log").mockImplementation(() => {}); vi.spyOn(console,"error").mockImplementation(() => {});
  vi.spyOn(OzonSeller.prototype,"accrualTypes").mockResolvedValue([{id:1,name:"PayPerClick",description:""}]);
  vi.spyOn(OzonSeller.prototype,"postings").mockResolvedValue([]);
  vi.spyOn(OzonSeller.prototype,"accrualPostings").mockResolvedValue([]);
  vi.spyOn(OzonSeller.prototype,"accrualByDay").mockImplementation(async day => {
    if (day === "2026-10-20") throw new Error("HTTP 503");
    return [];
  });
  vi.spyOn(OzonPerformance.prototype,"campaigns").mockResolvedValue([{id:"1", paymentType:"CPC"} as any]);
  vi.spyOn(OzonPerformance.prototype,"dailyStats").mockResolvedValue([{id:"1",date:"2026-10-20",spent:100} as any]);
  vi.spyOn(OzonPerformance.prototype,"requestStatistics").mockImplementation(async (_ids,from,to) => `${from}|${to}`);
  vi.spyOn(OzonPerformance.prototype,"statisticsState").mockResolvedValue({state:"OK"});
  vi.spyOn(OzonPerformance.prototype,"downloadStatistics").mockImplementation(async uuid => csv(uuid.split("|")[1]));
});
afterEach(() => { process.argv = argv; vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); rmSync(fixture.dir,{recursive:true,force:true}); });

describe("целостность дневных загрузок", () => {
  it("23:30 МСК остаётся в своём дне, семь дней = семь дат", () => {
    expect(closedDay(new Date("2026-10-21T20:30:00Z"))).toBe("2026-10-20");
    expect(closedDay(new Date("2026-10-21T22:30:00Z"))).toBe("2026-10-21");
    expect(dates("2026-10-14","2026-10-20")).toHaveLength(7);
  });
  it("ищет старую дыру даже если есть более свежая строка; помнит успешный пустой день", () => {
    const done = dates("2026-10-01","2026-10-20").filter(d => !["2026-10-02","2026-10-03"].includes(d));
    expect(pendingDays(done,["2026-10-03"],"2026-10-01","2026-10-20")).toEqual(["2026-10-02",...dates("2026-10-14","2026-10-20")]);
  });
  it("ошибка второго дня сохраняет все байты; повтор восстанавливает дыру без дублей", async () => {
    put("views.ndjson",[{date:"2026-10-18",sku:"123",views:9},{date:"2026-10-20",sku:"123",views:1}]);
    const before = raw("views.ndjson");
    const options = {path:"data/views.ndjson",floor:"2026-10-19",to:"2026-10-20",date:(r:any)=>r.date,key:(r:any)=>`${r.date}|${r.sku}`,load:async(day:string)=>{
      if (day === "2026-10-20") throw new Error("HTTP 503"); return [{date:day,sku:"123",views:2}];
    }};
    await expect(collectDaily(options)).rejects.toThrow("503");
    expect(raw("views.ndjson")).toBe(before); expect(existsSync("data/views.ndjson.completed.json")).toBe(false);
    options.load = async day => [{date:day,sku:"123",views:2}];
    await collectDaily(options); const repaired = raw("views.ndjson"); await collectDaily(options);
    expect(raw("views.ndjson")).toBe(repaired); expect(repaired.trim().split("\n")).toHaveLength(3);
    expect(JSON.parse(repaired.split("\n")[0]!)).toEqual({date:"2026-10-18",sku:"123",views:9});
  });
  it("битые ключи, NaN, пустая замена и выход за окно блокируют запись", () => {
    expect(() => validateRows([{id:"x"},{id:"x"}],r=>r.id)).toThrow();
    expect(() => validateRows([{id:"x",sum:NaN}],r=>r.id)).toThrow();
    expect(() => replaceSlice([{d:"a"}],[],()=>true)).toThrow();
    expect(() => replaceSlice([], [{d:"a"}],()=>false)).toThrow();
  });
});

describe("финансовый полный пересбор", () => {
  for (const [name,run,file] of [["acq",acq,"acq_sku_daily.ndjson"],["pnl",pnl,"pnl_account_accrual_daily.ndjson"]] as const) {
    it(`${name}: сбой дня не удаляет сохранённые строки и не пишет checkpoint`, async () => {
      put(file,[{d:"2026-10-19",sku:"123",sum:10},{d:"2026-10-20",sku:"123",sum:20}]);
      const before = raw(file); await expect(run()).rejects.toThrow("503");
      expect(raw(file)).toBe(before); expect(existsSync("data/collector_status.json")).toBe(false);
    });
  }
  it("все три сборщика останавливаются при сбое справочника до публикации", async () => {
    vi.mocked(OzonSeller.prototype.accrualTypes).mockRejectedValue(new Error("types 503"));
    for (const run of [acq,pnl,skuPnl]) await expect(run()).rejects.toThrow("types 503");
    expect(existsSync("data/collector_status.json")).toBe(false);
  });
  it("короткий FROM запрещён до обращения к API", async () => {
    process.argv = ["node","fixture.ts","2026-10-19","2026-10-20"];
    for (const run of [acq,pnl,skuPnl]) await expect(run()).rejects.toThrow("FROM=2026-02-06");
    expect(OzonSeller.prototype.accrualTypes).not.toHaveBeenCalled();
  });
});

describe("async отчёты кампаний", () => {
  it.each(["request","state","download","format","timeout"])("%s: сохраняет старые строки и checkpoint кампании", async kind => {
    put("ads_sku_daily.ndjson",[{d:"2026-10-20",cid:"1",sku:"123",sp:100,om:500,ca:0}]);
    put("ads_sku_state.json",{"1":"2026-10-18"},false);
    if (kind === "request") vi.mocked(OzonPerformance.prototype.requestStatistics).mockRejectedValue(new Error("503"));
    if (kind === "state") vi.mocked(OzonPerformance.prototype.statisticsState).mockResolvedValue({state:"ERROR"});
    if (kind === "download") vi.mocked(OzonPerformance.prototype.downloadStatistics).mockRejectedValue(new Error("503"));
    if (kind === "format") vi.mocked(OzonPerformance.prototype.downloadStatistics).mockResolvedValue('{"error":"not CSV"}');
    if (kind === "timeout") vi.mocked(OzonPerformance.prototype.statisticsState).mockResolvedValue({state:"RUNNING"});
    const before = raw("ads_sku_daily.ndjson");
    const promise = expect(adsSku()).rejects.toThrow("Не обновлены кампании");
    if (kind === "timeout") await vi.runAllTimersAsync();
    await promise;
    expect(raw("ads_sku_daily.ndjson")).toBe(before); expect(JSON.parse(raw("ads_sku_state.json"))).toEqual({"1":"2026-10-18"});
  });
  it("успех повторяем, CPO исключён из очереди, история вне окна сохранена", async () => {
    vi.mocked(OzonPerformance.prototype.campaigns).mockResolvedValue([{id:"1",paymentType:"CPC"},{id:"2",paymentType:"CPO"}] as any);
    vi.mocked(OzonPerformance.prototype.dailyStats).mockResolvedValue([{id:"1",date:"2026-10-20",spent:100},{id:"2",date:"2026-10-20",spent:1000}] as any);
    put("ads_sku_daily.ndjson",[{d:"2026-07-01",cid:"1",sku:"123",sp:20,om:5,ca:0}]);
    await adsSku(); const first = raw("ads_sku_daily.ndjson"); await adsSku(); expect(raw("ads_sku_daily.ndjson")).toBe(first);
    expect(first).toContain("2026-07-01"); expect(OzonPerformance.prototype.requestStatistics).not.toHaveBeenCalledWith(["2"],expect.anything(),expect.anything(),expect.anything());
  });
  it("успех B не скрывает сбой A: A повторяется следующим прогоном", async () => {
    vi.mocked(OzonPerformance.prototype.campaigns).mockResolvedValue([{id:"1",paymentType:"CPC"},{id:"2",paymentType:"CPC"}] as any);
    put("ads_periods.json",{p7:{top_spend:[{id:"1"},{id:"2"}]}},false);
    vi.mocked(OzonPerformance.prototype.requestStatistics).mockImplementation(async (ids,from,to) => { if(ids[0]==="1") throw new Error("503"); return `${from}|${to}`; });
    await expect(attr()).rejects.toThrow("1");
    expect(JSON.parse(raw("ads_attr_state.json"))["1"]).toBeUndefined(); expect(JSON.parse(raw("ads_attr_state.json"))["2"].through).toBe("2026-10-20");
    vi.mocked(OzonPerformance.prototype.requestStatistics).mockClear().mockImplementation(async(_ids,from,to)=>`${from}|${to}`);
    await attr(); expect(OzonPerformance.prototype.requestStatistics).toHaveBeenCalledWith(["1"],"2026-08-27","2026-10-20","DATE");
    const first=raw("ads_attr_daily.ndjson"); await attr(); expect(raw("ads_attr_daily.ndjson")).toBe(first);
  });
  it("дедлайн не позволяет скачать незавершённый отчёт", async () => {
    await expect(attributionReport(new OzonPerformance({clientId:"x",clientSecret:"y"}),"1","2026-10-20","2026-10-20",Date.now())).rejects.toThrow("дедлайна");
    expect(OzonPerformance.prototype.downloadStatistics).not.toHaveBeenCalled();
  });
});

it("проверка источников видит отдельную дыру кампании и не выдаёт старый CPO за ноль", () => {
  put("ads_daily.ndjson",[{d:"2026-10-20",id:"1",sp:100}]);
  put("ads_periods.json",{p7:{top_spend:[{id:"1"}],camp_meta:{"1":{instr:"Оплата за клик"}}}},false);
  put("cpo_sku_status.ndjson",[{date:"2026-09-17",art:"A",bid_percent:23}]);
  const rows = sourceHealth(join(fixture.dir,"data"));
  expect(rows.find(r=>r.source==="Полнота атрибуции кампаний")?.status).toBe("error");
  expect(rows.find(r=>r.source==="CPO: ставки и позиции")?.through).toBe("2026-09-17");
  const html = healthHtml(join(fixture.dir,"data")); expect(html).toContain("Более поздние даты не подтверждены"); expect(html).not.toContain("0 позиций");
});
