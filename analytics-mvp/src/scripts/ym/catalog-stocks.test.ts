import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyStocks } from "./catalog.js";
import { buildSkusLive } from "./derive-lib.js";

// Остаток, которого Маркет не назвал, хранился нулём и был неотличим от настоящего нуля. На
// снимке это 114 артикулов из 148: страница объявляла их закончившимися, не зная о них ничего.

const items = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { stock: 7 as number | null }]));

describe("остатки каталога: «не назван» это не ноль", () => {
  it("артикул, которого нет в ответе, получает null, а не ноль", () => {
    const it = items(["A", "B"]);
    const r = applyStocks(it, new Map([["A|w1", 5]]), new Set(["A"]), true);
    expect(it["A"]!.stock).toBe(5);
    expect(it["B"]!.stock, "Маркет про B ничего не сказал - это «нет данных»").toBeNull();
    expect(r).toEqual({ applied: true, known: 1 });
  });

  it("настоящий ноль сохраняется нулём и не превращается в «нет данных»", () => {
    const it = items(["A"]);
    applyStocks(it, new Map([["A|w1", 0]]), new Set(["A"]), true);
    expect(it["A"]!.stock).toBe(0);
  });

  it("общий склад двух кампаний не задваивается, разные склады складываются", () => {
    const it = items(["A"]);
    // w1 назван дважды (двумя кампаниями) - пара «артикул|склад» одна, значение перезаписывается.
    const at = new Map<string, number>();
    at.set("A|w1", 4); at.set("A|w1", 4); at.set("A|w2", 3);
    applyStocks(it, at, new Set(["A"]), true);
    expect(it["A"]!.stock).toBe(7);
  });

  it("ни одна кампания не ответила - прошлые значения не стираются", () => {
    const it = items(["A"]);
    const r = applyStocks(it, new Map(), new Set(), false);
    expect(it["A"]!.stock, "сетевой отказ не повод терять данные").toBe(7);
    expect(r.applied).toBe(false);
  });

  it("«закончился» ставится только на известный ноль", () => {
    const facts: any[] = [
      { date: "2026-07-01", sku: "A", name: "A", line: "л", revenue: 100, units: 1, views: 0, to_cart: 0, delivered: 1, returns: 0, cancellations: 0, accruals: 100, flying: 0, rev_canc: 0, rev_fly: 0, rev_ret: 0, rev_service: 0, offer_id: "A", platform: "ym" },
      { date: "2026-07-01", sku: "B", name: "B", line: "л", revenue: 100, units: 1, views: 0, to_cart: 0, delivered: 1, returns: 0, cancellations: 0, accruals: 100, flying: 0, rev_canc: 0, rev_fly: 0, rev_ret: 0, rev_service: 0, offer_id: "B", platform: "ym" },
    ];
    const cat = { items: { A: { stock: 0 }, B: { stock: null } } };
    const live = buildSkusLive([], facts, cat as any, "2026-07-01", "2026-07-31");
    const by = Object.fromEntries(live.sku_table.map((s: any) => [s.sku, s]));
    expect(by["A"].oos, "Маркет сказал ноль - товар правда закончился").toBe(1);
    expect(by["B"].oos, "остаток неизвестен - объявлять «закончился» нельзя").toBe(0);
    expect(by["B"].stock).toBeNull();
  });
});

// Честное «нет данных» - правка ПОД МАРКЕТ. У OZON снимок собирается другим пайплайном, там
// «неизвестно» не отличается от нуля, и страницы OZON обязаны остаться байт-в-байт (гейт в
// ym-snapshots.yml). Дважды за одну правку null протекал в OZON: сперва через stockOf, потом
// через артикул, которого вообще нет в живом снимке. Сторож ловит оба пути сразу.
describe("остаток OZON не трогаем", () => {
  it("на страницах OZON stockQty остаётся числом, null туда не протекает", () => {
    const out = mkdtempSync(join(tmpdir(), "oz-stock-"));
    execFileSync("npx", ["tsx", "src/scripts/build-katya.ts"], { env: { ...process.env, OUT_DIR: out }, stdio: "pipe" });
    for (const f of ["katya.html", "katya-tovary.html"]) {
      const html = readFileSync(join(out, f), "utf8");
      expect(html.includes('"stockQty":null'), `${f}: у OZON остаток обязан быть числом`).toBe(false);
    }
  }, 120_000);
});
