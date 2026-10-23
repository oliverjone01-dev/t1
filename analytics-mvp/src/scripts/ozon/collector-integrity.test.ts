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
import { adsFullDay } from "../plan-tab.js";
import { attributionReport, saveCorrections } from "./attribution-report.js";
import { main as acq } from "./acq-sku-daily.js";
import { main as pnl } from "./pnl-accrual-daily.js";
import { main as skuPnl } from "./pnl-sku-accrual-daily.js";
import { main as adsSku } from "./ad-sku-daily.js";
import { main as attr } from "./ad-attribution-daily.js";
import { main as adsDaily } from "./ads-daily.js";
import { main as views } from "./sku-views.js";
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

describe("свежая реклама раньше истории", () => {
  it("свежий день сохраняется при сбое истории, full-window checkpoint не сдвигается", async () => {
    put("ads_sku_daily.ndjson", [{d:"2026-09-01",cid:"1",sku:"123",sp:100,om:500,ca:0}]);
    put("ads_sku_state.json", {"1":"2026-10-19"}, false);
    const oldCorrection = {from:"2026-09-01",to:"2026-09-02",values:{"расход":-25}};
    put("ads_report_adjustments.json", {sku:{"1":{reports:[oldCorrection]}}}, false);
    vi.spyOn(OzonPerformance.prototype,"dailyStats").mockResolvedValue([
      {id:"1",date:"2026-09-02",spent:100}, {id:"1",date:"2026-10-20",spent:100},
    ] as any);
    await expect(adsSku()).rejects.toThrow("Не обновлены кампании");
    const rows = raw("ads_sku_daily.ndjson").trim().split("\n").map(s=>JSON.parse(s));
    expect(rows.map(r=>r.d)).toEqual(["2026-09-01","2026-10-20"]);
    expect(JSON.parse(raw("ads_sku_state.json"))).toEqual({"1":"2026-10-19"});
    expect(JSON.parse(raw("ads_report_adjustments.json")).sku["1"].reports).toEqual([oldCorrection]);
    expect(JSON.parse(raw("ads_report_adjustments.json")).sku["1"].accepted_windows).toEqual([{from:"2026-10-14",to:"2026-10-20",loaded_at:"2026-10-21T12:00:00.000Z"}]);
    expect(vi.mocked(OzonPerformance.prototype.requestStatistics).mock.calls[0]!.slice(1,3)).toEqual(["2026-10-14","2026-10-20"]);
  });
  it("следующее принятое окно не скрывает ранее допущенный день и не обновляет чужую дату приёмки", () => {
    const daily = [{d:"2026-10-22",id:"1",sp:100}];
    const sku = new Map([["1|2026-10-22",100]]), state = {"1":"2026-10-22"};
    const read = () => JSON.parse(raw("ads_report_adjustments.json")).sku;
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
    saveCorrections("sku", {"1":[]}, {"1":[["2026-10-22","2026-10-22"]]});
    expect(adsFullDay(daily,state,"9","",sku,read())).toBe("");
    vi.setSystemTime(new Date("2026-10-23T07:00:00Z"));
    saveCorrections("sku", {"1":[]}, {"1":[["2026-10-16","2026-10-22"]]});
    expect(adsFullDay(daily,state,"9","",sku,read())).toBe("2026-10-22");
    vi.setSystemTime(new Date("2026-10-30T07:00:00Z"));
    saveCorrections("sku", {"1":[]}, {"1":[["2026-10-23","2026-10-29"]]});
    expect(adsFullDay(daily,state,"9","",sku,read())).toBe("2026-10-22");
    expect(read()["1"].accepted_windows).toEqual([
      {from:"2026-10-22",to:"2026-10-22",loaded_at:"2026-10-22T12:00:00.000Z"},
      {from:"2026-10-16",to:"2026-10-22",loaded_at:"2026-10-23T07:00:00.000Z"},
      {from:"2026-10-23",to:"2026-10-29",loaded_at:"2026-10-30T07:00:00.000Z"},
    ]);
    // Обновление global loaded_at не превращает раннюю приёмку другого окна в закрытый день.
    expect(adsFullDay(daily,state,"9","",sku,{"1":{...read()["1"],accepted_windows:[read()["1"].accepted_windows[0]]}})).toBe("");
    saveCorrections("sku", {"1":[]}, {"1":[["2026-10-16","2026-10-22"]]});
    expect(read()["1"].accepted_windows).toHaveLength(3);
    expect(read()["1"].accepted_windows[1].loaded_at).toBe("2026-10-30T07:00:00.000Z");
    expect(read()["1"].accepted_windows[0].loaded_at).toBe("2026-10-22T12:00:00.000Z");
    sku.set("1|2026-10-22",94);
    expect(adsFullDay(daily,state,"9","",sku,read())).toBe("");
  });
  it("частичный положительный расход не заменяет прежний полный день", async () => {
    put("ads_sku_daily.ndjson", [{d:"2026-10-20",cid:"1",sku:"123",sp:100,om:500,ca:0}]);
    put("ads_sku_state.json", {"1":"2026-10-20"}, false);
    vi.spyOn(OzonPerformance.prototype,"downloadStatistics").mockResolvedValue(csv().replace(";100;1;500", ";1;1;500"));
    const before = raw("ads_sku_daily.ndjson");
    await expect(adsSku()).rejects.toThrow("Не обновлены кампании");
    expect(raw("ads_sku_daily.ndjson")).toBe(before);
    expect(JSON.parse(raw("ads_sku_state.json"))).toEqual({"1":"2026-10-20"});
  });
});

describe("целостность дневных загрузок", () => {
  it("настоящий sku-views сохраняет явную нулевую коррекцию API", async () => {
    put("sku_views.ndjson",[{date:"2026-10-20",sku:"123",views:10}]);
    const load=vi.spyOn(OzonSeller.prototype,"skuViewsDay").mockImplementation(async day=>[{date:day,sku:"123",views:0,cart:0,units:0,ret:0,canc:0}] as any);
    await views(); expect(load).toHaveBeenCalled();
    expect(raw("sku_views.ndjson")).toContain('"views":0');
    expect(JSON.parse(raw("sku_views.ndjson.completed.json"))).toContain("2026-10-20");
  });
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
    expect(() => validateRows([{date:"2026-10-20"}],(r:any)=>`${r.date}|${r.sku}`)).toThrow();
    expect(() => replaceSlice([{d:"a",sp:10}], [],()=>true,r=>r.d)).toThrow();
  });
});

describe("финансовый полный пересбор", () => {
  for (const [name,run,file] of [["acq",acq,"acq_sku_daily.ndjson"],["pnl",pnl,"pnl_account_accrual_daily.ndjson"]] as const) {
    it(`${name}: сбой дня не удаляет сохранённые строки и не пишет checkpoint`, async () => {
      put(file,[{d:"2026-10-19",sku:"123",sum:10},{d:"2026-10-20",sku:"123",sum:20}]);
      const before = raw(file); await expect(run()).rejects.toThrow("503");
      expect(raw(file)).toBe(before); expect(existsSync("data/collector_status.json")).toBe(false);
    });
    it(`${name}: незаметный пустой второй день не удаляет прежний ненулевой ключ`, async () => {
      vi.mocked(OzonSeller.prototype.accrualByDay).mockImplementation(async day => day === "2026-10-19" ? [{date:day,item_fees:{fees:[{sku:"123",fees:[{type_id:1,accrued:{amount:-10}}]}]},non_item_fee:{type_id:1,accrued:{amount:-10}}}] : []);
      put(file,[{d:"2026-10-19",sku:"123",sum:-10},{d:"2026-10-20",sku:"123",sum:-20}]);
      const before=raw(file); await expect(run()).rejects.toThrow("Неполный ответ");
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
  it("реальная строка Корректировка учитывается отдельно, неизвестный SKU не становится служебным", async () => {
    const perf=new OzonPerformance({clientId:"x",clientSecret:"y"}), callback=vi.fn();
    vi.mocked(OzonPerformance.prototype.downloadStatistics).mockResolvedValue(csv()+"Корректировка;;;-25;;\nВсего;;;75;1;500\n");
    await expect(attributionReport(perf,"1","2026-10-20","2026-10-20",Date.now()+60000)).rejects.toThrow("отдельного учёта");
    const rows=await attributionReport(perf,"1","2026-10-20","2026-10-20",Date.now()+60000,callback);
    expect(rows).toHaveLength(1); expect(callback).toHaveBeenCalledWith({from:"2026-10-20",to:"2026-10-20",values:{"расход":-25,"продано товаров":null,"продажи в продвижении":null}});
    callback.mockClear();
    vi.mocked(OzonPerformance.prototype.downloadStatistics).mockResolvedValue(csv()+"Корректировка;;;-25;;\n20.10.2026;;Корректировка;10;1;20\n");
    await expect(attributionReport(perf,"1","2026-10-20","2026-10-20",Date.now()+60000,callback)).rejects.toThrow("SKU/даты");
    expect(callback).not.toHaveBeenCalled();
  });
  it("невалидное число корректировки блокирует запись, успешная metadata видна в health", async () => {
    vi.mocked(OzonPerformance.prototype.downloadStatistics).mockResolvedValue(csv()+"Корректировка;;;BROKEN;;\n");
    const perf=new OzonPerformance({clientId:"x",clientSecret:"y"});
    await expect(attributionReport(perf,"1","2026-10-20","2026-10-20",Date.now()+60000,()=>{})).rejects.toThrow("число корректировки");
    // Разные окна отчётов: не смешиваем недатированную сумму с дневным SKU рядом.
    vi.mocked(OzonPerformance.prototype.downloadStatistics).mockImplementation(async uuid=>csv(uuid.split("|")[1])+"Корректировка;;;-25;;\n");
    await adsSku();
    expect(raw("ads_sku_daily.ndjson")).not.toContain("-25");
    expect(raw("ads_report_adjustments.json")).toContain('"расход":-25');
    expect(sourceHealth(join(fixture.dir,"data")).find(r=>r.source==="Недатированные корректировки CSV")?.status).toBe("warning");
    const metadata=raw("ads_report_adjustments.json");
    vi.mocked(OzonPerformance.prototype.requestStatistics).mockRejectedValue(new Error("503"));
    await expect(adsSku()).rejects.toThrow(); expect(raw("ads_report_adjustments.json")).toBe(metadata);
  });
  it("название товара Итого не отключает проверку чисел; настоящие totals не становятся SKU", async () => {
    vi.mocked(OzonPerformance.prototype.downloadStatistics).mockResolvedValue(csv().split("\n")[0]+";Добавления в корзину\n20.10.2026;123;Итого;BROKEN;1;500;BROKEN\n");
    const perf=new OzonPerformance({clientId:"x",clientSecret:"y"});
    await expect(attributionReport(perf,"1","2026-10-20","2026-10-20",Date.now()+60000)).rejects.toThrow("число");
    vi.mocked(OzonPerformance.prototype.downloadStatistics).mockResolvedValue(csv()+"Всего;;;100;1;500\n");
    expect(await attributionReport(perf,"1","2026-10-20","2026-10-20",Date.now()+60000)).toHaveLength(1);
  });
  it.each(["blank-sku","bad-cart"])("%s не проходит как успешный частичный отчёт", async kind => {
    put("ads_sku_daily.ndjson",[{d:"2026-10-20",cid:"1",sku:"123",sp:100,om:500,ca:0},{d:"2026-10-20",cid:"1",sku:"456",sp:25,om:100,ca:0}]);
    put("ads_sku_state.json",{"1":"2026-10-18"},false);
    vi.mocked(OzonPerformance.prototype.downloadStatistics).mockResolvedValue(kind==="blank-sku" ? csv()+"20.10.2026;;повреждённая строка;25;1;100\n" : csv().split("\n")[0]+";Добавления в корзину\n20.10.2026;123;Товар;100;1;500;BROKEN\n");
    const before=raw("ads_sku_daily.ndjson"); await expect(adsSku()).rejects.toThrow("Не обновлены кампании");
    expect(raw("ads_sku_daily.ndjson")).toBe(before); expect(JSON.parse(raw("ads_sku_state.json"))["1"]).toBe("2026-10-18");
  });
  it("частичный dailyStats не удаляет вторую кампанию из непустого дня", async () => {
    put("ads_daily.ndjson",[{d:"2026-10-20",id:"1",sp:100,vw:1},{d:"2026-10-20",id:"2",sp:50,vw:1}]);
    vi.mocked(OzonPerformance.prototype.campaigns).mockResolvedValue([{id:"1"},{id:"2"}] as any);
    vi.mocked(OzonPerformance.prototype.dailyStats).mockResolvedValue([{id:"1",date:"2026-10-20",spent:100,orders:0,ordersMoney:0,views:1,clicks:0,toCart:0,title:"A"}]);
    const before=raw("ads_daily.ndjson"); await expect(adsDaily()).rejects.toThrow("Неполный ответ");
    expect(raw("ads_daily.ndjson")).toBe(before);
  });
  it("явный ноль допустим, отсутствие старого ненулевого ключа требует проверки", () => {
    expect(replaceSlice([{id:"1",sp:100}],[{id:"1",sp:0}],()=>true,r=>r.id)).toEqual([{id:"1",sp:0}]);
    expect(() => replaceSlice([{id:"1",sp:100},{id:"2",sp:50}],[{id:"1",sp:10}],()=>true,r=>r.id)).toThrow("Неполный ответ");
  });
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
  expect(rows.find(r=>r.source==="Полнота расхода CPC по SKU")?.status).toBe("error");
  expect(rows.find(r=>r.source==="CPO: ставки и позиции")?.through).toBe("2026-09-17");
  const html = healthHtml(join(fixture.dir,"data")); expect(html).toContain("Более поздние даты не подтверждены"); expect(html).not.toContain("0 позиций");
});

it("последняя неудачная попытка видна даже при свежей максимальной дате", () => {
  put("collector_failures.json",{attempted_at:"2026-10-21T12:00:00Z",failures:["реклама по дням не обновлена"]},false);
  expect(sourceHealth(join(fixture.dir,"data")).find(r=>r.source==="Последняя загрузка")?.status).toBe("error");
  expect(healthHtml(join(fixture.dir,"data"))).toContain("реклама по дням не обновлена");
});
