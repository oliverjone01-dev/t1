// Эталонные строки спеки knowledge/semantic/metrics/ozon-cpc-card-spread.yaml v2 (сентябрь 2026) на данных data/*.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { cardSpread } from "./cpc-card-spread.js";

const nd = (f: string) => readFileSync("data/" + f, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const ads = nd("ads_sku_daily.ndjson");
const attr = nd("ads_attr_daily.ndjson");
const orders = nd("orders_daily.ndjson").map((r: any) => ({ order: String(r.order), d: r.d, sku: String(r.sku), units: Number(r.units) || 0, revenue: Number(r.revenue) || 0, status: r.status }));
const groups = JSON.parse(readFileSync("data/card_groups.json", "utf-8")).groups;
const R = cardSpread(ads, attr, orders, groups);
const SEP = (d: string) => d >= "2026-09-01" && d <= "2026-09-30";
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const nbOf = (sku: string, o: string) => sum(R.nb.filter((r) => SEP(r[0]) && r[1] === sku && r[2] === o).map((r) => r[3]));
// Округление по SKU x день: на месяц расхождение с эталоном до 1 ₽ на день пары.
const near = (v: number, e: number) => expect(Math.abs(v - e)).toBeLessThanOrEqual(15);

describe("cpc-card-spread: эталон сентября", () => {
  it("1) GGT-47-3-3-80, кампания 37007560: 8 шт по 8 079, отменённый сосед получает долю", () => {
    const p = R.pairs["2026-09|4865596071|37007560"]!;
    expect(p.sold).toBe(3); expect(p.soldM).toBe(5); expect(p.unk).toBe(1);
    expect(Object.keys(p.nb).sort()).toEqual(["0210427575-0149-1", "25046719-0374-1", "37192082-0346-1", "64207726-0637-1"]);
    expect(R.nbOrders["0210427575-0149-1"]!.st).toBe("cancelled");
    for (const o of Object.keys(p.nb)) near(nbOf("4865596071", o), 8079);
  });
  it("2) GGT-03-3-3-O-20090, кампания 40015169: по 35 291 на двух соседей", () => {
    const p = R.pairs["2026-09|3564831766|40015169"]!;
    expect(p.sold).toBe(1); expect(p.soldM).toBe(2); expect(p.unk).toBe(0);
    expect(Object.keys(p.nb).sort()).toEqual(["0202248461-0011-1", "02912987-0407-1"]);
    for (const o of Object.keys(p.nb)) near(nbOf("3564831766", o), 35291);
  });
  // Уточнение 01.10 (v15): в сборе атрибуции у 40047060 22 дня из 26 и все с нулями, продажа соседа на
  // 75 900 из пробы API - в пропущенный день. Пара считается «без продаж», итог тот же: всё на рекламируемых.
  it("3) кампания 40047060: продаж в сборе нет, весь расход на рекламируемых", () => {
    const ks = Object.keys(R.pairs).filter((k) => k.startsWith("2026-09|") && k.endsWith("|40047060"));
    for (const k of ks) { expect(R.pairs[k]!.sold + R.pairs[k]!.soldM).toBe(0); }
    expect(R.nb.some((r) => SEP(r[0]) && ks.some((k) => k.split("|")[1] === r[1]))).toBe(false);
    const sp = sum(ads.filter((r: any) => SEP(r.d) && r.cid === "40047060").map((r: any) => r.sp));
    near(sp, 55737);
  });
  it("4) сентябрь целиком: CPC 791 263, соседи 281 596, не найден 8 079, без продаж 194 831, без атрибуции 44 521", () => {
    const s = R.stat.filter((r) => SEP(r[0]));
    const t = (i: number) => sum(s.map((r) => r[i] as number));
    near(t(1), 791263); near(t(2), 281596); near(t(3), 8079); near(t(4), 194831); near(t(5), 44521);
  });
  it("инвариант: own + соседи = дневной расход SKU (ряд «Денег»)", () => {
    const m: Record<string, number> = {};
    for (const r of ads) m[r.sku + "|" + r.d] = (m[r.sku + "|" + r.d] || 0) + r.sp;
    const n: Record<string, number> = {};
    for (const r of R.nb) n[r[1] + "|" + r[0]] = (n[r[1] + "|" + r[0]] || 0) + r[3];
    for (const [sku, rows] of Object.entries(R.own)) for (const [d, v] of rows) expect(v + (n[sku + "|" + d] || 0)).toBe(Math.round(m[sku + "|" + d]!));
  });
});
