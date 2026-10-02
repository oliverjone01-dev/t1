// Вкладка «Отчет» Маркета (спека knowledge/semantic/metrics/ym-monthly-report.yaml). Клиентский код
// исполняется здесь как есть: общие функции OZON-отчёта, вырезанные по имени, и код отчёта Маркета.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPORT_JS } from "../report-page.js";
import { pickJs, reportDataYm, reportJsYm, RP_SHARED, campaignPoints } from "./report-page-ym.js";
import { accLedgerFullTo } from "./derive-lib.js";

const F = ["sold", "ret", "units", "pay", "dlv", "accruals", "commission", "delivery", "acquiring", "storage", "cofin", "promo", "otherSvc", "amount", "got", "back", "cogs"];
// Строка блока «Аналитика по артикулам» так, как её отдаёт accAgg «Денег» (поля + производные).
const accRow = (sku: string, cat: string, v: Record<string, number>) => {
  const o: any = { sku, cat }; for (const f of F) o[f] = v[f] || 0;
  o.fee = -(o.commission + o.delivery + o.acquiring + o.storage + o.promo + o.otherSvc);
  o.gp = o.amount - o.cogs; o.adm = o.amount * 0.3; o.tax = (o.pay + o.dlv) * 0.15; o.np = o.gp - o.adm - o.tax;
  return o;
};

// Страница: REPY + заглушки кода «Денег» (accAgg по окну, ACC для подсчёта строк, ACC_DOC).
function page(repy: any, byPer: (per: { from: string; to: string }) => any[], accDays: string[], doc: any[] = []) {
  // Общие функции страница кладёт в window (глобальная область браузера); здесь это globalThis.
  const win: any = globalThis;
  const body = `var window=W;${reportJsYm()};return {rpyCalc,rpyMonths,rpPeriods:W.rpPeriods,rpyLines,rpyPtsLines,rpyRefLines};`;
  const R = { svc: [], gen: [], pts: [], drr: [], ...repy };
  return new Function("W", "REPY", "accAgg", "ACC", "ACC_DOC", "ACC_RATE", "fmtRu", "document", body)(
    win, R, byPer, accDays.map((d) => [d, "X"]), doc, { adm: 0.3, tax: 0.15 }, (n: number) => String(Math.round(n)), {});
}

describe("отчёт Маркета: общие функции берутся из OZON-отчёта, а не копируются", () => {
  it("все имена находятся в REPORT_JS, скобки сбалансированы", () => {
    const js = pickJs(REPORT_JS, RP_SHARED);
    for (const n of RP_SHARED) expect(js).toMatch(new RegExp(`(function ${n}\\(|\\b${n}=)`));
    expect(() => new Function(js)).not.toThrow();
  });
  it("переименованная в OZON-отчёте функция роняет сборку, а не тихо пропадает", () => {
    expect(() => pickJs(REPORT_JS, ["rpNetTakogoNet"])).toThrow(/нет «rpNetTakogoNet»/);
  });
  it("периоды считаются от последнего дня реестра, а не от даты заказов (сентябрь по 29.09 - к 1-29.08)", () => {
    const f = page({ to: "2026-09-29", pts: [], gmv: [] }, () => [], []);
    const P = f.rpPeriods("2026-09");
    expect(P.partial).toBe(true);
    expect(P.prev).toEqual({ from: "2026-08-01", to: "2026-08-29" });
  });
});

describe("отчёт Маркета: карточка оборота", () => {
  it("«реализовано» OZON-карточки заменено на «продано за вычетом возвратов» (H1)", () => {
    const win: any = globalThis;
    const card = new Function("W", "REPY", "fmtRu", `var window=W;${reportJsYm()};return rpyTurnCard('Всего',100000,120000,10,12);`)(win, { to: "2026-09-29", svc: [], gen: [], pts: [], drr: [], cab: {} }, (n: number) => String(Math.round(n)));
    expect(card).toContain("продано за вычетом возвратов");
    expect(card).not.toContain("реализовано");
  });
});

describe("отчёт Маркета: итоги месяца", () => {
  const sep = [
    accRow("GGM-01", "Зеркала", { units: 2, pay: 90_000, dlv: 10_000, accruals: 100_000, commission: -5_000, promo: -3_000, amount: 92_000, cogs: 40_000 }),
    accRow("GGT-01", "Столы", { units: 1, pay: 50_000, accruals: 50_000, acquiring: -1_000, amount: 49_000, cogs: 20_000 }),
  ];
  // Услуги Маркета по дням: [день, поле блока, услуга, сумма со знаком реестра]; cofin:<поле> - баллами.
  const svc = [
    ["2026-09-03", "commission", "Размещение товарных предложений", -5_000],
    ["2026-09-03", "promo", "Буст продаж, оплата за продажи", -3_200],
    ["2026-09-04", "promo", "Скидка за лояльность", 200],
    ["2026-09-04", "acquiring", "Перевод платежа", -1_000],
    ["2026-09-04", "cofin:commission", "Размещение товарных предложений", -6_000],
  ];
  // Без заказа: [день, удержания, премия, внесено продавцом].
  const gen = [["2026-09-28", -1_500, 500, 0], ["2026-09-29", -43_086, 0, 43_086], ["2026-08-31", -9_000, 0, 0]];
  const repy = { to: "2026-09-29", pts: [["2026-09-03", 7_000, -6_000]], svc, gen };
  const f = page(repy, (per) => (per.from === "2026-09-01" ? sep : []), ["2026-09-03", "2026-09-04"]);
  const c = f.rpyCalc({ from: "2026-09-01", to: "2026-09-29" });
  it("ИТОГО = сумма строк accAgg; зеркала + мебель = ИТОГО; мебель - всё, кроме зеркал", () => {
    expect(c.grand.acc).toBe(150_000);
    expect(c.grand.units).toBe(3);
    expect(c.g.mir.acc + c.g.fur.acc).toBe(c.grand.acc);
    expect(c.g.fur.acc).toBe(50_000);
    expect(c.bad).toBe(false);
  });
  it("тождество Начислено − Всего сборов = К выплате держится, сборы положительными", () => {
    expect(c.grand.fee).toBe(9_000);
    expect(c.grand.acc - c.grand.fee).toBe(c.grand.amount);
    expect(c.badId).toBe(false);
  });
  it("общие расходы кабинета (2а): удержания и премия за дни окна; взнос продавца не гасит удержание (G2 ФЕНИКСА)", () => {
    expect(c.grand.gen).toBe(-1_000 - 43_086); // 31.08 в сентябрь не попадает; +43 086 взноса - не доход
    expect(c.grand.seller).toBe(43_086);
    expect(c.grand.netAll).toBeCloseTo(c.grand.np - 44_086, 6);
  });
  it("услуги Маркета (1а) складываются в колонку блока; баллы по услуге - справкой", () => {
    expect(c.grand.svc["commission|Размещение товарных предложений"]).toBe(5_000);
    expect(c.grand.svcSum.promo).toBe(3_000);
    expect(c.grand.mpromo).toBe(3_000);
    expect(c.grand.pts["cofin:commission|Размещение товарных предложений"]).toBe(6_000);
    expect(c.svBad).toEqual([]);
    const ls = f.rpyLines([c]).map((l: any) => l.l);
    expect(ls).toContain("Размещение товарных предложений");
    expect(ls).toContain("Перевод платежа");
    expect(ls).not.toContain("Комиссия");
    expect(ls).not.toContain("Эквайринг");
    expect(ls).not.toContain("Хранение"); // группы без услуг и без суммы не показываются
    expect(ls).toContain("АДМ 30% от К выплате");
  });
  it("услуга, не сложившаяся с колонкой блока, поднимает флаг", () => {
    const g = page({ to: "2026-09-29", svc: [["2026-09-03", "commission", "Размещение товарных предложений", -9_999]] },
      (per) => (per.from === "2026-09-01" ? sep : []), ["2026-09-03"]);
    // Размещение 9 999 против 5 000 в блоке; продвижение и эквайринг без услуг тоже не сходятся - флаг на каждую группу.
    const bad = g.rpyCalc({ from: "2026-09-01", to: "2026-09-29" }).svBad;
    expect(bad.length).toBe(3);
    expect(bad[0]).toMatch(/^Размещение товарных предложений 4999 ₽$/);
  });
  it("порог флага услуг - 0,5 ₽ × строк окна, но не выше 100 ₽ (H4, G2 ФЕНИКСА)", () => {
    const days = Array.from({ length: 300 }, (_, i) => `2026-09-${String(1 + (i % 29)).padStart(2, "0")}`);
    const flag = (diff: number) => page({ to: "2026-09-29", svc: [["2026-09-03", "commission", "Размещение товарных предложений", -5_000 - diff],
      ["2026-09-03", "promo", "Буст", -3_000], ["2026-09-04", "acquiring", "Перевод платежа", -1_000]] },
      (per) => (per.from === "2026-09-01" ? sep : []), days).rpyCalc({ from: "2026-09-01", to: "2026-09-29" }).svBad;
    expect(flag(90), "шум до 100 ₽ при 300 строках - не флаг").toEqual([]);
    expect(flag(120).length, "120 ₽ при 300 строках - флаг (порог «число строк» = 300 и «0,5 × строк» = 150 его пропускали)").toBe(1);
  });
  it("реклама = статья «Продвижение» по категориям; баллы - справкой, в оборот не входят", () => {
    expect(c.grand.mpromo).toBe(3_000);
    expect(c.g.mir.promo).toBe(3_000);
    expect(c.g.fur.promo).toBe(0);
    expect(c.grand.ptsIn).toBe(7_000);
    expect(c.grand.saldo).toBe(1_000);
    expect(c.grand.acc).toBe(150_000);
  });
  it("месяц без проводок - null («нет данных»), а не нули", () => {
    expect(f.rpyCalc({ from: "2026-07-01", to: "2026-07-31" }).grand).toBeNull();
  });
  // G1 ФЕНИКСА iter2: месяц, собранный без статуса платежа, - «Оплачено и отменено» нет данных, не 0.
  it("«Оплачено и отменено» в месяце без статуса - null, со статусом - число", () => {
    const g: any = globalThis;
    const L = (t: any) => f.rpyRefLines().filter((x: any) => x.k === "cgot" || x.k === "csold" || x.k === "cback").map((x: any) => x.fn(t));
    try {
      g.ACC_NOST = ["74986385/2026-09"];
      const cn = f.rpyCalc({ from: "2026-09-01", to: "2026-09-29" });
      expect(cn.grand.nost).toEqual(["74986385/2026-09"]);
      expect(L(cn.grand)).toEqual([null, null, null]);
      g.ACC_NOST = ["74986385/2026-08"]; g.ACC_NOST_OLD = ["74986385/2026-01"];
      const cs = f.rpyCalc({ from: "2026-09-01", to: "2026-09-29" });
      expect(cs.grand.nost).toEqual([]);
      expect(L(cs.grand)).toEqual([0, 0, 0]);
    } finally { delete g.ACC_NOST; delete g.ACC_NOST_OLD; }
  });
  // Решение 02.10 «два столбца»: первый столбец (acc1, amount1) и наша доставка доходят до итога отчёта.
  it("два столбца: справочный первый и наша доставка суммируются в итог", () => {
    const rows = [Object.assign(accRow("A", "Зеркала", { accruals: 100, pay: 100, amount: 90 }), { acc1: 70, amount1: 60, ship: 15 }),
      Object.assign(accRow("B", "Столы", { accruals: 50, pay: 50, amount: 45 }), { acc1: 80, amount1: 75, ship: 5 })];
    const f2 = page({ to: "2026-09-29" }, () => rows, ["2026-09-03"]);
    const g2 = f2.rpyCalc({ from: "2026-09-01", to: "2026-09-29" }).grand;
    expect([g2.acc, g2.acc1, g2.amount1, g2.ship]).toEqual([150, 150, 135, 20]);
    const ks = f2.rpyLines([]).map((x: any) => x.k);
    expect(ks.indexOf("acc1")).toBeLessThan(ks.indexOf("acc"));
    expect(ks).toContain("ship");
    // Основные строки - фиолетовым жирным (просьба пользователя 02.10).
    expect(f2.rpyLines([]).filter((x: any) => x.main).map((x: any) => x.k)).toEqual(["acc", "fee", "amount", "np", "netAll"]);
    expect(f2.rpyPtsLines([]).filter((x: any) => x.main).map((x: any) => x.k)).toEqual(["ptsIn", "ptsOut", "saldo"]);
  });
});

describe("отчёт Маркета: данные сборщика", () => {
  const dir = mkdtempSync(join(tmpdir(), "ymrep-"));
  const nd = (rows: any[]) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(join(dir, "pnl_sku_netting_daily.ndjson"), nd([
    { d: "2026-09-29", business: "1", sku: "A", points: 100, cofin: -50 }, // только баллы: день ещё не полный
    { d: "2026-09-28", business: "2", sku: "B", points: 0, cofin: 0, commission: -10 },
    { d: "2026-09-27", business: "1", sku: "A", points: 5, cofin: -1, acquiring: -20 },
  ]));
  writeFileSync(join(dir, "sku_views.ndjson"), nd([
    { date: "2026-09-06", period_from: "2026-08-31", aggregate: true, sku: "A", views: 300, pdp: 6, cart: 1 },
    { date: "2026-09-07", sku: "A", views: 10, pdp: 1, cart: 0 },
  ]));
  writeFileSync(join(dir, "orders.ndjson"), nd([
    { sku: "A", created: "2026-07-01", status: "DELIVERED" },
    { sku: "A", created: "2026-09-10", status: "CANCELLED_IN_DELIVERY" },
    { sku: "A", created: "2026-09-11", status: "DELIVERY", service: true },
  ]));
  writeFileSync(join(dir, "netting.ndjson"), nd([
    { d: "2026-09-27", business: "1", order: "o1", sku: "A", type: "Начисление", service: "Зеркало", src: "Платёж покупателя", amount: 1000 },
    { d: "2026-09-27", business: "1", order: "o1", sku: "", type: "Удержание", service: "Перевод платежа", src: "Оплата услуг Маркета", amount: -20 },
    { d: "2026-09-27", business: "1", order: "o1", sku: "", type: "Списание", service: "Размещение товарных предложений", src: "Скидка за участие в совместных акциях", amount: -300 },
    { d: "2026-09-27", business: "1", order: "", type: "Удержание", service: "", src: "Оплата услуг Маркета", amount: -50 },
    { d: "2026-09-27", business: "1", order: "", type: "Начисление", service: "", src: "Внесено продавцом", amount: 50 },
    { d: "2026-09-29", business: "1", order: "o2", sku: "A", type: "Удержание", service: "Перевод платежа", src: "Оплата услуг Маркета", amount: -7 },
    { d: "2026-09-27", business: "1", order: "o3", sku: "A", type: "Начисление", service: "GEN GROUP Столик консольный ARFEO черный", src: "Компенсация за потерянный заказ", amount: 36457 },
    { d: "2026-09-28", business: "1", order: "o4", sku: "", type: "Удержание", service: "Перевод платежа", src: "Оплата услуг Маркета", amount: -9 },
    // Заказ отменён: удержания не будет (ответ «1а» 02.10) - в услуги не идёт.
    { d: "2026-09-27", business: "1", order: "o5", sku: "", type: "Удержание", service: "Перевод платежа", src: "Оплата услуг Маркета", amount: -99, status: "Не будет удержан из-за отмены заказа" },
  ]));
  // Отчёт по баллам: списание баллами за кампанию без заказа (ответ «2а» 02.10) и строка по заказу (её
  // реестр уже несёт - отсюда не берётся).
  writeFileSync(join(dir, "bonuses_monthly.ndjson"), nd([
    { ym: "2026-09", business: "2", d: "2026-09-20", type: "Списание", src: "Скидка за участие в совместных акциях", service: "Полки", order: "", amount: -500 },
    { ym: "2026-09", business: "1", d: "2026-09-27", type: "Списание", src: "Скидка за участие в совместных акциях", service: "Размещение товарных предложений", order: "o1", amount: -300 },
    { ym: "2026-09", business: "2", d: "2026-09-29", type: "Списание", src: "Скидка за участие в совместных акциях", service: "Полки", order: "", amount: -700 }, // после границы
  ]));
  writeFileSync(join(dir, "svod_orders.json"), JSON.stringify({ months: [{ ym: "2026-09", business: "1", rows: [{ s: 10, b: 200 }] }] }));
  // Заглушка кода «Маркетинга» в том же виде, что promoYm().js: объявления с начала строки.
  const promoJs = "var PM=null;\nvar PM_ART=[\"Буст продаж\"];\nvar PM_NAMES={\"2\":\"GEN GROUP (мебель)\",\"1\":\"GENGLASS (зеркала)\"};\nfunction pmRow(m){\n  var sp=0,b=0;m.rows.forEach(function(r){sp+=r.s;b+=r.b;});\n  return {ym:m.ym,business:m.business,sm:sp,sp:0,oh:0,spend:sp,base:b,settled:true,partial:false};\n}\nfunction pmDraw(){}";
  const r = reportDataYm({ dp: (f) => join(dir, f), maxD: "2026-09-30", catOf: () => "Зеркала", skuName: {}, promoJs });
  it("последний ПОЛНЫЙ день реестра (вариант «а»): по отстающему кабинету, последний день с денежными сборами", () => {
    expect(r.to).toBe("2026-09-27");
    expect(r.lastBy).toEqual({ "1": "2026-09-29", "2": "2026-09-28" });
  });
  it("кабинеты зеркал и мебели - из PM_NAMES «Маркетинга», не литералами (H3)", () => {
    expect(r.cab).toEqual({ mir: "1", fur: "2" });
  });
  it("свёрнутая неделя показов суммируется с дневными (4а), а не отбрасывается", () => {
    expect(r.views.A!.m["2026-09"]).toEqual([310, 7, 1]);
    expect(r.viewsFrom).toBe("2026-08-31");
  });
  it("отменённые заказы и строки доставки - не продажа", () => {
    expect(r.ord.A).toEqual(["2026-07-01"]);
  });
  it("услуги - по классификации блока ACC; платёж покупателя не услуга; баллы по услуге отдельно; дни после реестра не берутся", () => {
    expect(r.svc).toEqual([
      // 2а: кампания баллами из отчёта по баллам - в «Продвижение», справкой; 29.09 - после границы
      ["2026-09-20", "cofin:promo", "Полки (кампания)", -500],
      ["2026-09-27", "acquiring", "Перевод платежа", -20],
      ["2026-09-27", "cofin:commission", "Размещение товарных предложений", -300],
      // H2: компенсация подписана типом операции, товар в скобках; 28.09 - уже после границы
      // Товар в подписи компенсации не нужен (просьба пользователя 02.10) - только вид операции.
      ["2026-09-27", "otherSvc", "Компенсация за потерянный заказ", 36457],
    ]);
  });
  it("проводки без заказа: удержание и взнос продавца раздельно", () => {
    expect(r.gen).toEqual([["2026-09-27", -50, 0, 50]]);
  });
  it("ДРР - функцией pmRow вкладки «Маркетинг» по своду заказов", () => {
    expect(r.drr).toEqual([{ ym: "2026-09", b: "1", sm: 10, sp: 0, oh: 0, spend: 10, base: 200, settled: true, partial: false }]);
  });
  it("отменённые заказы по артикулу собираются отдельно (3а)", () => {
    expect(r.ordC.A).toEqual(["2026-09-10"]);
  });
  it("баллы за дни после последнего полного дня реестра не берутся", () => {
    expect(r.pts).toEqual([["2026-09-20", 0, -500], ["2026-09-27", 5, -1]]);
  });
  it("сбой выреза pmRow роняет сборку, а не даёт молча «нет данных» (H1)", () => {
    expect(() => reportDataYm({ dp: (f) => join(dir, f), maxD: "2026-09-30", catOf: () => "Зеркала", skuName: {}, promoJs: promoJs.replace("function pmRow(", "function pmRowNew(") }))
      .toThrow(/promoYm\(\)\.js «Маркетинга» нет «pmRow»/);
    expect(() => reportDataYm({ dp: (f) => join(dir, f), maxD: "2026-09-30", catOf: () => "Зеркала", skuName: {}, promoJs: promoJs.replace("spend:sp", "spend:undefined") }))
      .toThrow(/pmRow «Маркетинга» вернул не то/);
  });
});

describe("граница полного реестра (вариант «а», общая для отчёта и блока на «Деньгах»)", () => {
  const fee = (d: string, business: string, f: Record<string, number> = { commission: -100 }) => ({ d, business, ...f });
  it("последний день без денежных сборов (только платежи и списания баллами) не берётся - снимок 01.10", () => {
    const rows = [fee("2026-09-29", "1023124"), { d: "2026-09-30", business: "1023124", accruals: 19_903, cofin: -31_451 },
      fee("2026-09-29", "74986385"), { d: "2026-09-30", business: "74986385", cofin: -56_966 }];
    expect(accLedgerFullTo(rows).to).toBe("2026-09-29");
  });
  it("кабинет, который не догнал, тянет границу назад; закрытый (без проводок 30 дней) - нет", () => {
    const rows = [fee("2026-09-30", "a"), fee("2026-09-27", "b"), fee("2026-07-01", "closed")];
    expect(accLedgerFullTo(rows)).toMatchObject({ to: "2026-09-27", lastBy: { a: "2026-09-30", b: "2026-09-27", closed: "2026-07-01" } });
  });
  it("сборы любой группы считаются (компенсация в «прочих»), баллы - нет", () => {
    expect(accLedgerFullTo([fee("2026-09-28", "a"), fee("2026-09-29", "a", { otherSvc: 36_457 }), fee("2026-09-30", "a", { cofin: -5 })]).to).toBe("2026-09-29");
  });
  it("кабинет без денежных сборов вообще - последний день минус один, а не пропуск", () => {
    expect(accLedgerFullTo([{ d: "2026-10-01", business: "a", accruals: 1 }]).to).toBe("2026-09-30");
  });
  it("строки «по выгрузке заказов» (оценочные сборы) не сдвигают границу (ревью Codex #450)", () => {
    expect(accLedgerFullTo([fee("2026-09-28", "a"), { d: "2026-09-29", business: "a", accruals: 100 }, { ...fee("2026-09-29", "a"), basis: "orders" }]).to).toBe("2026-09-28");
  });
  it("пустой реестр - пустая граница, а не выдуманная дата", () => {
    expect(accLedgerFullTo([]).to).toBe("");
  });
});

// G5 ФЕНИКСА iter2 (мутанты M13, M21): кампании баллами из отчёта по баллам.
describe("отчёт Маркета: кампании баллами без заказа (2а)", () => {
  const bon = (d: string, b: string, extra: any = {}) => ({ d, business: b, order: "", src: "Скидка за участие в совместных акциях", service: "Полки", amount: -1_000, ...extra });
  it("берутся только списания «Скидка за участие…» без заказа, не отменённые, по границу реестра", () => {
    const out = campaignPoints([], [bon("2026-09-03", "1"), bon("2026-09-04", "1", { src: "Баллы за скидку Маркета" }), bon("2026-09-05", "1", { order: "123" }),
      bon("2026-09-06", "1", { status: "Справочно: не будет пополнен баланс" }), bon("2026-09-30", "1")], "2026-09-29");
    expect(out).toEqual([{ d: "2026-09-03", b: "1", svc: "Полки", a: -1_000 }]);
  });
  it("пара, где реестр платежей уже несёт такие списания, не берётся (не задвоить)", () => {
    const net = [{ d: "2026-09-10", business: "1", order: "", type: "Списание", src: "Скидка за участие в совместных акциях", service: "Полки", amount: -500 }];
    const out = campaignPoints(net as any, [bon("2026-09-03", "1"), bon("2026-09-03", "2"), bon("2026-08-03", "1")], "2026-09-29");
    expect(out.map((x) => `${x.b}/${x.d}`)).toEqual(["2/2026-09-03", "1/2026-08-03"]);
  });
});
