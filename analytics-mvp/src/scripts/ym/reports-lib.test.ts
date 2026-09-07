// Гвоздь для разбора отчётов Маркета: заголовки в fixtures/ym/report-headers.json сняты с живых
// выгрузок 2026-09-04 (data-ym/_probe/*). Живой факт: Маркет отдаёт АНГЛИЙСКИЕ коды колонок
// (TRANSACTION_SUM, SHOWS, DELIVERED_COUNT), а не русские подписи - первый прогон разобрал 0 строк
// именно из-за этого. Если колонки снова разъедутся, тест упадёт до ночного синка, а не после.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { findCol } from "../../util/table.js";
import { realizationRole, isRateLimit, dedupeNetting } from "./reports-lib.js";

const COLS = JSON.parse(readFileSync("src/scripts/ym/report-columns.json", "utf-8")) as Record<string, Record<string, string[]>>;
const H = JSON.parse(readFileSync("fixtures/ym/report-headers.json", "utf-8")) as Record<string, string[]>;
const col = (type: string, key: string, headers: string[]) => findCol(headers, COLS[type]![key]!);

describe("колонки отчётов Маркета (живые заголовки)", () => {
  it("реализация: delivered.csv даёт sku/sold/amount, returned.csv - sku/returned/amount_returned", () => {
    const d = H["goods-realization/delivered.csv"]!;
    expect(col("goods-realization", "sku", d)).toBe(d.indexOf("YOUR_SKU"));
    expect(col("goods-realization", "sold", d)).toBe(d.indexOf("DELIVERED_COUNT"));
    expect(col("goods-realization", "amount", d)).toBe(d.indexOf("DELIVERED_PRICE_SUM_WITH_VAT_AND_DISCOUNTS"));
    const r = H["goods-realization/returned.csv"]!;
    expect(col("goods-realization", "returned", r)).toBe(r.indexOf("RETURNED_COUNT"));
    expect(col("goods-realization", "amount_returned", r)).toBe(r.indexOf("RETURN_PRICE_SUM_WITH_VAT_AND_DISCOUNTS"));
  });
  it("реализация: «продано» НЕ цепляется за TRANSFERRED_TO_DELIVERY_COUNT (иначе тройной счёт)", () => {
    const t = H["goods-realization/transferred_to_delivery.csv"]!;
    expect(t).toContain("TRANSFERRED_TO_DELIVERY_COUNT");
    expect(col("goods-realization", "sold", t)).toBe(-1); // в этом файле колонки DELIVERED_COUNT нет
  });
  it("роли файлов архива реализации: в штуки идут только delivered и returned", () => {
    expect(realizationRole("delivered.csv", H["goods-realization/delivered.csv"]!)).toBe("delivered");
    expect(realizationRole("returned.csv", H["goods-realization/returned.csv"]!)).toBe("returned");
    expect(realizationRole("transferred_to_delivery.csv", H["goods-realization/transferred_to_delivery.csv"]!)).toBe(null);
    expect(realizationRole("unredeemed.csv", H["goods-realization/unredeemed.csv"]!)).toBe(null);
    expect(realizationRole("lost_items.csv", H["goods-realization/lost_items.csv"]!)).toBe(null);
  });
  it("взаиморасчёты: дата, сумма, заказ, SKU и номер п/п находятся", () => {
    const n = H["united-netting/transaction_date.csv"]!;
    expect(col("united-netting", "date", n)).toBe(n.indexOf("TRANSACTION_DATE"));
    expect(col("united-netting", "amount", n)).toBe(n.indexOf("TRANSACTION_SUM"));
    expect(col("united-netting", "order", n)).toBe(n.indexOf("ORDER_ID"));
    expect(col("united-netting", "sku", n)).toBe(n.indexOf("SHOP_SKU"));
    expect(col("united-netting", "payment_order", n)).toBe(n.indexOf("BANK_ORDER_ID"));
    expect(col("united-netting", "type", n)).toBe(n.indexOf("TRANSACTION_TYPE"));
  });
  it("воронка: показы/клики/корзина/заказы и дата из DAY+MONTH+YEAR (отдельной колонки даты нет)", () => {
    const v = H["shows-sales/sales_funnel_report.csv"]!;
    expect(col("shows-sales", "sku", v)).toBe(v.indexOf("OFFER_ID"));
    expect(col("shows-sales", "shows", v)).toBe(v.indexOf("SHOWS"));
    expect(col("shows-sales", "clicks", v)).toBe(v.indexOf("CLICKS"));
    expect(col("shows-sales", "cart", v)).toBe(v.indexOf("TO_CART"));
    expect(col("shows-sales", "units", v)).toBe(v.indexOf("ORDER_ITEMS"));
    expect(col("shows-sales", "date", v)).toBe(-1);
    expect(col("shows-sales", "day", v)).toBe(v.indexOf("DAY"));
    expect(col("shows-sales", "month", v)).toBe(v.indexOf("MONTH"));
    expect(col("shows-sales", "year", v)).toBe(v.indexOf("YEAR"));
    // SHOWS не должен цепляться за SHOWS_WITH_PROMOTION / SHOWS_SHARE
    expect(v[col("shows-sales", "shows", v)]).toBe("SHOWS");
  });
});

describe("лимит генерации отчётов Маркета - мягкая остановка, а не падение", () => {
  it("HTTP 420 и METHOD_FAILURE распознаются как лимит, обычные ошибки - нет", () => {
    expect(isRateLimit(new Error('Market POST /reports/united-netting/generate -> HTTP 420: {"errors":[{"code":"METHOD_FAILURE","message":"Hit rate limit of 1 points per 2 minutes"}]}'))).toBe(true);
    expect(isRateLimit(new Error("HTTP 403: API_DISABLED"))).toBe(false);
    expect(isRateLimit(new Error("ECONNRESET"))).toBe(false);
  });
});

describe("дедуп проводок взаиморасчётов", () => {
  it("схлопывает по TRANSACTION_ID: пересекающиеся месячные окна не удваивают суммы", () => {
    // Живой факт 2026-09-04: выгрузка за месяц несёт проводки и за соседний, поэтому соседние
    // запросы пересекаются. Без дедупа задвоилось 2935 строк на 17.6 млн ₽.
    const rows = [
      { d: "2026-03-18", tx: "t1", order: "1", amount: 30530 },
      { d: "2026-03-18", tx: "t2", order: "1", amount: 13267 },
      { d: "2026-03-18", tx: "t1", order: "1", amount: 30530 }, // тот же tx из соседнего окна
      { d: "2026-03-30", tx: "t3", order: "1", amount: -1007 },
    ];
    const out = dedupeNetting(rows);
    expect(out.map((r) => r.tx)).toEqual(["t1", "t2", "t3"]);
    expect(out.reduce((s, r) => s + r.amount, 0)).toBe(30530 + 13267 - 1007);
  });
  it("первым идёт свежее: при совпадении id остаётся строка из новой выгрузки", () => {
    const fresh = [{ d: "2026-03-18", tx: "t1", amount: 100, service: "новое" }];
    const old = [{ d: "2026-03-18", tx: "t1", amount: 100, service: "старое" }];
    expect(dedupeNetting(fresh.concat(old))[0]!.service).toBe("новое");
  });
  it("без TRANSACTION_ID работает запасной составной ключ (старые выгрузки)", () => {
    const rows = [
      { d: "2026-03-18", order: "1", sku: "A", type: "Начисление", service: "стол", amount: 100, po: "9" },
      { d: "2026-03-18", order: "1", sku: "A", type: "Начисление", service: "стол", amount: 100, po: "9" },
      { d: "2026-03-18", order: "1", sku: "A", type: "Начисление", service: "стол", amount: 200, po: "9" },
    ];
    expect(dedupeNetting(rows).length).toBe(2);
  });
});

describe("лимит Маркета - это ожидание, а не отказ", () => {
  // Живой факт 2026-09-07: шаг реализации отработал 1 мин 49 с и вышел на первом же 420, собрав один
  // отчёт. Прогон использовал 10 минут из 120 доступных, и бэкфилл августа стоял на 0 из 7 магазинов.
  // Лимит Маркета - 1 генерация на 2 минуты: его надо переждать, а не сдаваться.
  it("после ожидания попытка повторяется и возвращает результат", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) throw new Error('HTTP 420: {"errors":[{"code":"METHOD_FAILURE","message":"Hit rate limit of 1 points per 2 minutes"}]}');
      return "отчёт";
    };
    // ожидание подменяем нулевым, чтобы тест не спал две минуты
    const prev = process.env.YM_REPORT_WAIT_MS;
    process.env.YM_REPORT_WAIT_MS = "0";
    const mod = await import("./reports-wait.js");
    const out = await mod.retryOnRateLimit(fn, "тест", { waitMs: 0, timeLeft: () => 10 * 60_000 });
    expect(out).toBe("отчёт");
    expect(calls).toBe(3);
    if (prev === undefined) delete process.env.YM_REPORT_WAIT_MS; else process.env.YM_REPORT_WAIT_MS = prev;
  });
  it("не ждёт, если до дедлайна прогона уже не хватает времени", async () => {
    const mod = await import("./reports-wait.js");
    const fn = async () => { throw new Error("HTTP 420: rate limit"); };
    const out = await mod.retryOnRateLimit(fn, "тест", { waitMs: 125_000, timeLeft: () => 30_000 });
    expect(out).toBe(mod.RATE_LIMITED);
  });
  it("обычная ошибка пробрасывается, а не ждёт", async () => {
    const mod = await import("./reports-wait.js");
    const fn = async () => { throw new Error("HTTP 403: API_DISABLED"); };
    await expect(mod.retryOnRateLimit(fn, "тест", { waitMs: 0, timeLeft: () => 10 * 60_000 })).rejects.toThrow("API_DISABLED");
  });
});

describe("ключ чистки накопительного файла = ключ возобновляемости", () => {
  // Живой факт 2026-09-07: чистка реестра шла по месяцу, а возобновляемость - по паре
  // (кабинет, месяц). Перезабор 1023124/2026-04 снёс 74986385 за 2026-03..2026-06:
  // 11 407 строк -> 6 509, 27 932 124 ₽ -> 18 577 394 ₽. Прогон при этом завершился зелёным.
  const purge = (fresh: any[], old: any[]) => {
    const covered = new Set(fresh.map((r) => `${r.business}/${r.d.slice(0, 7)}`));
    return old.filter((r) => !covered.has(`${r.business}/${r.d.slice(0, 7)}`));
  };
  it("перезабор одного кабинета не трогает другой за тот же месяц", () => {
    const old = [
      { business: "1023124", d: "2026-04-10", amount: 1 },
      { business: "74986385", d: "2026-04-11", amount: 2 },
      { business: "74986385", d: "2026-05-01", amount: 3 },
    ];
    const fresh = [{ business: "1023124", d: "2026-04-15", amount: 9 }];
    const keep = purge(fresh, old);
    expect(keep.map((r) => `${r.business}/${r.d.slice(0, 7)}`)).toEqual(["74986385/2026-04", "74986385/2026-05"]);
    expect(keep.some((r) => r.business === "1023124")).toBe(false); // свой месяц заменяется свежим
  });
  it("чистится ЗАПРОШЕННАЯ пара, а не месяц, пришедший в ответе", () => {
    // Отчёт Маркета отдаёт проводки за пределами окна: запрос июля приносит и майские строки.
    // Живой факт 2026-09-07 (прогон 17): список чистки строился из ответа, поэтому запрос июля
    // помечал май «перезабранным», приносил оттуда 568 строк из 2380 - и сносил остальные 1812.
    const old = [
      { business: "B", d: "2026-05-10", amount: 1 }, { business: "B", d: "2026-05-11", amount: 1 },
      { business: "B", d: "2026-07-01", amount: 1 },
    ];
    const requested = new Set(["B/2026-07"]);          // запрошен ТОЛЬКО июль
    const fresh = [{ business: "B", d: "2026-07-02" }, { business: "B", d: "2026-05-30" }]; // а пришёл и май
    const keepByRequest = old.filter((r) => !requested.has(`${r.business}/${r.d.slice(0, 7)}`));
    expect(keepByRequest.filter((r) => r.d.startsWith("2026-05"))).toHaveLength(2); // май цел
    const coveredFromRows = new Set(fresh.map((r) => `${r.business}/${r.d.slice(0, 7)}`));
    expect(old.filter((r) => !coveredFromRows.has(`${r.business}/${r.d.slice(0, 7)}`))
      .filter((r) => r.d.startsWith("2026-05"))).toHaveLength(0); // старое поведение теряло май
  });
  it("чистка по одному месяцу (старое поведение) сносила бы чужой кабинет", () => {
    const old = [{ business: "74986385", d: "2026-04-11", amount: 2 }];
    const fresh = [{ business: "1023124", d: "2026-04-15", amount: 9 }];
    const byMonthOnly = new Set(fresh.map((r) => r.d.slice(0, 7)));
    expect(old.filter((r) => !byMonthOnly.has(r.d.slice(0, 7)))).toHaveLength(0); // вот она, потеря
    expect(purge(fresh, old)).toHaveLength(1);                                    // исправленный ключ бережёт
  });
});

describe("состояние не запирает бэкфилл навсегда", () => {
  // Пара, закрытая пустым отчётом, раньше не открывалась никогда: donePairs пропускает её до
  // запроса. Август встал на 1/7 магазинов не из-за лимита Маркета, а из-за этого.
  const reopen = (pairs: string[], byMonth: Record<string, any>) => {
    const done = new Set(pairs);
    for (const [ym, cov] of Object.entries(byMonth)) {
      const withRows = new Set<string>(cov.shops_with_rows || []);
      for (const c of (cov.shops_sold || []) as string[]) if (!withRows.has(c)) done.delete(`${ym}/${c}`);
    }
    return [...done].sort();
  };
  it("пара без строк переоткрывается, чужие месяцы не трогаются", () => {
    const byMonth = { "2026-08": { shops_sold: ["A", "B"], shops_with_rows: ["A"] } };
    // B за август переоткрыт; A за август и C за июль остались закрытыми
    expect(reopen(["2026-08/A", "2026-08/B", "2026-07/C"], byMonth)).toEqual(["2026-07/C", "2026-08/A"]);
  });
  it("переоткрытие не может задвоить цифры: у переоткрытых пар вклад нулевой", () => {
    const byMonth = { "2026-08": { shops_sold: ["A", "B"], shops_with_rows: ["A"] } };
    const left = reopen(["2026-08/A", "2026-08/B"], byMonth);
    expect(left).toContain("2026-08/A");     // дала строки - повторно не тянем
    expect(left).not.toContain("2026-08/B"); // строк не дала - тянем снова, прибавлять нечего
  });
});
