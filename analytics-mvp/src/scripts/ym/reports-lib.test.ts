// Гвоздь для разбора отчётов Маркета: заголовки в fixtures/ym/report-headers.json сняты с живых
// выгрузок 2026-09-04 (data-ym/_probe/*). Живой факт: Маркет отдаёт АНГЛИЙСКИЕ коды колонок
// (TRANSACTION_SUM, SHOWS, DELIVERED_COUNT), а не русские подписи - первый прогон разобрал 0 строк
// именно из-за этого. Если колонки снова разъедутся, тест упадёт до ночного синка, а не после.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { findCol } from "../../util/table.js";
import { realizationRole, isRateLimit, dedupeNetting, reportMonthsToDo } from "./reports-lib.js";

const COLS = JSON.parse(readFileSync("src/scripts/ym/report-columns.json", "utf-8")) as Record<string, Record<string, string[]>>;
const H = JSON.parse(readFileSync("fixtures/ym/report-headers.json", "utf-8")) as Record<string, string[]>;
const col = (type: string, key: string, headers: string[]) => findCol(headers, COLS[type]![key]!);
const col_ = col;

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

// Акт по стоимости услуг. Прогон 2026-09-16 скачал все 9 таблиц по обоим кабинетам и разобрал
// НОЛЬ строк: карта колонок была снята с русской выгрузки кабинета, а API отдаёт английские
// UPPER_SNAKE. Шаг при этом отчитался успехом, дашборд молча остался на реестре платежей.
// Заголовки ниже выписаны из лога того прогона - если карта снова разъедется, падать будет тут.
describe("акт по стоимости услуг: колонки по живым заголовкам API", () => {
  const FILES = ["placement", "boost", "shelf", "cpm-boost", "delivery",
    "payment_accepting", "payment_transfer", "order_processing", "storage_of_returns"];
  it("сумма услуги находится во ВСЕХ девяти таблицах акта", () => {
    const miss: string[] = [];
    for (const f of FILES) {
      const h = H[`united-marketplace-services/${f}.csv`]!;
      expect(h, `нет фикстуры заголовков для ${f}.csv`).toBeTruthy();
      const i = col("united-marketplace-services", "amount", h);
      if (i < 0) miss.push(f);
      else expect(h[i], `${f}.csv: сумма зацепилась за «${h[i]}»`).toMatch(/^(SERVICE_PRICE|TOTAL_AMOUNT)$/);
    }
    expect(miss).toEqual([]);
  });
  it("placement.csv берёт TOTAL_AMOUNT, а не AMOUNT_WITHOUT_BONUSES - иначе теряется оплаченное баллами", () => {
    const h = H["united-marketplace-services/placement.csv"]!;
    expect(h[col("united-marketplace-services", "amount", h)]).toBe("TOTAL_AMOUNT");
  });
  it("оплаченное баллами - это BONUS_PAID, и только там, где оно есть", () => {
    for (const f of ["boost", "shelf", "cpm-boost"]) {
      const h = H[`united-marketplace-services/${f}.csv`]!;
      expect(h[col("united-marketplace-services", "amount_points", h)], f).toBe("BONUS_PAID");
    }
    // В акте размещения колонка называется «сумма БЕЗ баллов» - это не баллы, цеплять её нельзя.
    const p = H["united-marketplace-services/placement.csv"]!;
    expect(col("united-marketplace-services", "amount_points", p)).toBe(-1);
  });
  it("три таблицы не имеют названия услуги вовсе - его даёт имя файла", () => {
    for (const f of ["payment_accepting", "payment_transfer", "storage_of_returns"]) {
      const h = H[`united-marketplace-services/${f}.csv`]!;
      expect(col("united-marketplace-services", "service", h), `${f}.csv`).toBe(-1);
    }
    for (const f of ["placement", "boost", "shelf", "cpm-boost", "delivery", "order_processing"]) {
      const h = H[`united-marketplace-services/${f}.csv`]!;
      expect(h[col("united-marketplace-services", "service", h)], f).toBe("SERVICE_NAME");
    }
  });
  // Дата ОКАЗАНИЯ услуги, а не дата акта. ACT_DATE - всегда последнее число месяца: с ней весь
  // акт схлопывался в 7 уникальных дат на 6588 строк, и свод нельзя было посчитать ни за какой
  // период короче месяца. Обе колонки лежат рядом во всех таблицах, поэтому промах тихий.
  it("дата - это дата оказания услуги, а не дата акта", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const h = H[`united-marketplace-services/${f}.csv`]!;
      const i = col("united-marketplace-services", "date", h);
      expect(i, f).toBeGreaterThanOrEqual(0);
      // ACT_DATE есть в каждой таблице, поэтому выбор её - это всегда ошибка приоритета.
      expect(h, `${f}.csv: в фикстуре нет ACT_DATE, проверять нечего`).toContain("ACT_DATE");
      if (!/^SERVICE_DATE(_TIME)?$/.test(h[i]!)) bad.push(`${f}.csv -> ${h[i]}`);
    }
    expect(bad, "взята дата акта вместо даты оказания").toEqual([]);
  });
});

// Отчёт по баллам Маркета. Заголовки сняты с живой выгрузки прогона 2026-09-16: файл
// netting_bonuses.csv, 22 английские колонки. Метод - reports/united-netting/generate с телом
// monthOfYear (в кабинете это третий тип отчёта «По платежам»); пять имён эндпоинтов, которые
// перебирались раньше, были выдуманы и отдавали 404.
describe("отчёт по баллам: колонки по живым заголовкам API", () => {
  const h = () => H["ym-bonuses/netting_bonuses.csv"]!;
  it("все нужные колонки находятся", () => {
    const want: Array<[string, string]> = [
      ["date", "TRANSACTION_DATE"], ["type", "TRANSACTION_TYPE"], ["source", "TRANSACTION_SOURCE"],
      ["amount", "TRANSACTION_SUM"], ["order", "ORDER_ID"], ["sku", "SHOP_SKU"],
      ["service", "OFFER_OR_SERVICE_NAME"], ["business", "BUSINESS_ID"], ["count", "COUNT"],
    ];
    const bad: string[] = [];
    for (const [key, col] of want) {
      const i = col_("ym-bonuses", key, h());
      if (i < 0) bad.push(`${key}: не найдена`);
      else if (h()[i] !== col) bad.push(`${key}: зацепилась за ${h()[i]}, а нужна ${col}`);
    }
    expect(bad).toEqual([]);
  });
  it("дата - дата транзакции, а не дата создания или доставки заказа", () => {
    const i = col_("ym-bonuses", "date", h());
    expect(h()).toContain("ORDER_CREATION_DATE");
    expect(h()).toContain("ORDER_DELIVERY_DATE");
    expect(h()[i]).toBe("TRANSACTION_DATE");
  });
  it("сумма - TRANSACTION_SUM, а не COUNT", () => {
    expect(h()[col_("ym-bonuses", "amount", h())]).toBe("TRANSACTION_SUM");
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



describe("пересбор месяца идемпотентен, обычный прогон ничего не переоткрывает (ФЕНИКС veto 5.6)", () => {
  // Переоткрытие по косвенному признаку проваливалось дважды: признак читался из состояния
  // (пустого у старых месяцев), потом из поля from (которое писатель проставляет ВСЕМ строкам,
  // включая поднятые из файла с пустым множеством - через один прогон from: [] стоял бы у всех 177
  // строк и переоткрылись бы 14 пар на 4 830 709 ₽). Косвенный признак заменён явной командой.
  const run = (existing: any[], donePairs: string[], months: string[], rebuild: boolean) => {
    const done = new Set(donePairs);
    if (rebuild) for (const ym of months) for (const p of [...done]) if (p.startsWith(`${ym}/`)) done.delete(p);
    const byMonth: Record<string, Record<string, { sold: number }>> = {};
    for (const r of existing) {
      if (rebuild && months.includes(r.ym)) continue;              // месяц не засеваем накопленным
      (byMonth[r.ym] ||= {})[r.sku] = { sold: r.sold };
    }
    return { open: [...done].sort(), seeded: byMonth };
  };
  const existing = [{ ym: "2026-02", sku: "S", sold: 10, from: [] }];
  const pairs = ["2026-02/A", "2026-02/B", "2026-03/C"];

  it("обычный прогон: ни одна пара не открывается, даже если from пуст у всех строк", () => {
    const r = run(existing, pairs, ["2026-02"], false);
    expect(r.open).toEqual(pairs);                                  // ничего не переоткрыто
    expect(r.seeded["2026-02"]!["S"]!.sold).toBe(10);               // месяц засеян накопленным
  });
  it("пересбор: пары месяца открыты, накопленное месяца отброшено - складывать не на что", () => {
    const r = run(existing, pairs, ["2026-02"], true);
    expect(r.open).toEqual(["2026-03/C"]);                          // открыт только целевой месяц
    expect(r.seeded["2026-02"]).toBeUndefined();                    // второго слоя быть не из чего
  });
  it("пересбор одного месяца не трогает соседние", () => {
    const two = [{ ym: "2026-02", sku: "S", sold: 10 }, { ym: "2026-03", sku: "T", sold: 5 }];
    const r = run(two, pairs, ["2026-02"], true);
    expect(r.seeded["2026-03"]!["T"]!.sold).toBe(5);
  });
});

// Акт по стоимости услуг: какие месяцы брать в прогон. Прогон 37 (2026-09-16) отработал этот шаг
// за 4 секунды и не добрал ничего, хотя в состоянии были собраны только две августовские пары:
// список месяцев считался по «схема сменилась / файл пуст», а не по тому, что реально осталось.
describe("акт услуг: список месяцев берётся из состояния, а не из схемы", () => {
  const ALL = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
  const CUR = "2026-09", PREV = "2026-08";

  it("живой случай прогона 37: собран только август - остальные месяцы обязаны попасть в прогон", () => {
    const done = ["1023124/2026-08", "74986385/2026-08"];
    expect(reportMonthsToDo(ALL, done, CUR, PREV)).toEqual(ALL);
  });

  it("всё собрано - берём только текущий и прошлый: акт за них ещё дополняется", () => {
    const done = ALL.flatMap((m) => [`1023124/${m}`, `74986385/${m}`]);
    expect(reportMonthsToDo(ALL, done, CUR, PREV)).toEqual([PREV, CUR]);
  });

  it("месяц, где успел отработать один кабинет из двух, закрытым не считается", () => {
    const done = ALL.flatMap((m) => (m === "2026-05" ? [`1023124/${m}`] : [`1023124/${m}`, `74986385/${m}`]));
    expect(reportMonthsToDo(ALL, done, CUR, PREV)).toEqual(["2026-05", PREV, CUR]);
  });

  it("пустое состояние и признак «пересобрать всё» дают всю историю", () => {
    expect(reportMonthsToDo(ALL, [], CUR, PREV)).toEqual(ALL);
    const done = ALL.flatMap((m) => [`1023124/${m}`, `74986385/${m}`]);
    expect(reportMonthsToDo(ALL, done, CUR, PREV, true)).toEqual(ALL);
  });

  it("текущий и прошлый месяц не выпадают, даже когда собраны полностью", () => {
    const done = ALL.flatMap((m) => [`1023124/${m}`, `74986385/${m}`]);
    const got = reportMonthsToDo(ALL, done, CUR, PREV);
    expect(got).toContain(CUR);
    expect(got).toContain(PREV);
  });
});

// Разбор карты колонок целиком, как это делает cols() в продьюсере. Прогон 38 (2026-09-16)
// СКАЧАЛ отчёт по баллам - netting_bonuses.csv, 277 строк, имя метода и тело подтвердились - и
// упал на разборе: `ym-reports FAILED: Invalid regular expression: /(/i: Unterminated group`.
// Причина: ключ _live хранит прозу (откуда сняты заголовки), а не список шаблонов, и уходил в
// findCol наравне с колонками. Тот перебирал СИМВОЛЫ прозы как регулярки; у остальных отчётов
// какой-нибудь символ совпадал с заголовком и перебор выходил раньше, а у баллов заголовки
// английские, русская проза не совпала ничем, и дело дошло до скобки.
describe("карта колонок: документация не уходит в разбор", () => {
  // Точная копия цикла из cols(): ключи на «_» пропускаются.
  const mapAll = (type: string, headers: string[]) => {
    const out: Record<string, number> = {};
    for (const [k, pats] of Object.entries(COLS[type]!)) {
      if (k.startsWith("_")) continue;
      out[k] = findCol(headers, pats as string[]);
    }
    return out;
  };

  it("каждый отчёт разбирается целиком, без исключения на прозе _live", () => {
    const pairs: Array<[string, string]> = [
      ["ym-bonuses", "ym-bonuses/netting_bonuses.csv"],
      ["united-netting", "united-netting/transaction_date.csv"],
      ["goods-realization", "goods-realization/delivered.csv"],
      ["shows-sales", "shows-sales/sales_funnel_report.csv"],
      ["united-marketplace-services", "united-marketplace-services/placement.csv"],
    ];
    for (const [type, file] of pairs) {
      expect(() => mapAll(type, H[file]!), `${type}: разбор карты колонок упал`).not.toThrow();
      expect(Object.keys(mapAll(type, H[file]!)), `${type}: _live попал в результат разбора`).not.toContain("_live");
    }
  });

  it("у баллов проза _live не совпадает с английскими заголовками и содержит скобку - ровно тот случай", () => {
    const live = (COLS["ym-bonuses"] as any)._live as string;
    expect(typeof live).toBe("string");
    expect(live).toContain("(");
    const heads = H["ym-bonuses/netting_bonuses.csv"]!;
    // ни один символ прозы ДО первой скобки не совпадает с заголовками - поэтому перебор и
    // доходил до неё. Если это перестанет быть так, падение спрячется, а тест это покажет.
    const before = [...live.slice(0, live.indexOf("("))];
    const hit = before.some((ch) => { try { const re = new RegExp(ch, "i"); return heads.some((h) => re.test(h)); } catch { return false; } });
    expect(hit, "символ прозы совпал с заголовком - падение снова станет случайным").toBe(false);
  });

  it("findCol не роняет разбор ни на битой регулярке, ни на строке вместо списка", () => {
    const heads = ["TRANSACTION_SUM", "ORDER_ID"];
    expect(findCol(heads, ["(", "^ORDER_ID$"])).toBe(1);   // битый шаблон пропускается, следующий работает
    expect(findCol(heads, ["("])).toBe(-1);
    expect(findCol(heads, "проза (а не список)" as unknown as string[])).toBe(-1);
  });
});
