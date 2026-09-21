import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";

// «Товары» Маркета показывали ЗАКАЗАННОЕ: 85,3 млн и 1742 шт, тогда как доставлено 48,9 млн и
// 1059 шт. Треть суммы на странице - отменённые заказы, и ни один тест этого не ловил: smoke
// проверяет отсутствие ошибок JS, а не базис числа. Здесь проверяется сам базис - сумма таблицы
// обязана совпасть со сводом по заказам, а отменённое и летящее обязаны стоять отдельными
// колонками, а не исчезать.

let dom: JSDOM;
const errs: string[] = [];
const num = (s: string | null | undefined): number | null => {
  const v = parseFloat(String(s ?? "").replace(/[^\d,.-]/g, "").replace(/\s/g, "").replace(",", "."));
  return isNaN(v) ? null : v;
};

// Эталон считается ИЗ ФАЙЛА СВОДА тем же правилом, что рисует лист «Деньги»: прайс нетто
// возвратов, штуки нетто. Если правило свода изменится, тест обязан упасть вместе со страницей.
function svodTotals() {
  const sv = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf8"));
  const ms = sv.months || sv;
  let rev = 0, units = 0, flyU = 0, flyR = 0;
  for (const m of ms) {
    for (const r of m.rows || []) {
      const d = r.units_delivered || 0, n = r.units_net || 0;
      rev += d > 0 ? (r.price || 0) * n / d : (r.price || 0);
      units += n;
    }
    for (const r of m.inflight_rows || []) { flyU += r.units || 0; flyR += r.price || 0; }
  }
  return { rev, units, flyU, flyR };
}

beforeAll(async () => {
  const out = mkdtempSync(join(tmpdir(), "tovary-ui-"));
  execFileSync("npx", ["tsx", "src/scripts/build-katya.ts"], {
    env: { ...process.env, DATA_DIR: "data-ym", OUT_DIR: out, PLATFORM: "ym" },
    stdio: "pipe",
  });
  dom = new JSDOM(readFileSync(join(out, "katya-tovary.html"), "utf8"), {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(w: any) {
      w.addEventListener("error", (e: any) => errs.push(String(e.error || e.message)));
      w.console.error = (...a: any[]) => errs.push(a.join(" "));
    },
  });
  await new Promise((r) => setTimeout(r, 1600));
}, 90_000);

const D = () => dom.window.document;
const head = () => [...D().querySelectorAll(".pt-table thead th")].map((x) => (x.textContent || "").trim());
const modelRows = () => [...D().querySelectorAll(".pt-table tbody tr.pt-row")];
const colIdx = (name: string) => head().indexOf(name);
const cellNum = (tr: Element, name: string) => num(tr.children[colIdx(name)]?.textContent);

describe("«Товары» Маркета: базис - доставленное, как в своде", () => {
  it("страница отрисовалась без ошибок JS", () => {
    expect(errs).toEqual([]);
    expect(modelRows().length).toBeGreaterThan(0);
  });

  it("колонки названы по базису и отменённое с летящим стоят своими", () => {
    const h = head();
    expect(h, "продажи - это доставленное, а не «Выручка» всех статусов").toContain("Продано");
    expect(h).toContain("Доставлено");
    expect(h, "отменённые 26,8 млн прятать нельзя").toContain("Отменено");
    expect(h, "то, чем месяц ещё дорастёт").toContain("В пути");
    expect(h).not.toContain("Выручка");
  });

  // Деньги в ячейке округлены до 0,1 млн, поэтому сумма ТЕКСТА по 300+ строкам не сходится с
  // копейками свода по построению - проверять надо число, из которого ячейка нарисована.
  it("продажи, из которых рисуется таблица, совпадают со сводом по заказам", () => {
    const want = svodTotals();
    const got = Number(dom.window.eval(
      "PRODUCTS.reduce(function(a,p){return a+productPeriod(p,getDateRange()).rev;},0)"));
    expect(Math.abs(got - want.rev / 1e6), `страница ${got.toFixed(4)} млн против свода ${(want.rev / 1e6).toFixed(4)} млн`).toBeLessThan(0.01);
  });

  it("ячейка «Продано» первой строки - это её же число из данных, а не чужое", () => {
    const tr = modelRows()[0]!;
    const nm = (tr.querySelector(".pt-name-main")?.textContent || "").trim();
    const want = Number(dom.window.eval(
      `productPeriod(PRODUCTS.filter(function(p){return p.nm===${JSON.stringify(nm)};})[0], getDateRange()).rev`));
    expect(cellNum(tr, "Продано")).toBeCloseTo(Math.round(want * 10) / 10, 5);
  });

  it("сумма «Доставлено, шт» совпадает со сводом", () => {
    const want = svodTotals();
    const got = modelRows().reduce((a, tr) => a + (cellNum(tr, "Доставлено") || 0), 0);
    expect(got).toBe(want.units);
  });

  it("«В пути» на странице - те же строки, что у свода", () => {
    const want = svodTotals();
    const idx = colIdx("В пути");
    const got = modelRows().reduce((a, tr) => {
      const m = (tr.children[idx]?.textContent || "").match(/([\d\s]+)\s*шт/);
      return a + (m ? Number(m[1]!.replace(/\s/g, "")) : 0);
    }, 0);
    expect(got).toBe(want.flyU);
  });

  // Остаток Маркет отдаёт по 34 артикулам из 148. В снимке на диске у остальных стоит ноль
  // (поле каталога было ненулевым по умолчанию), поэтому увидеть «нет данных» на странице можно
  // только после свежего сбора каталога. Проверяем, что сама страница это УМЕЕТ.
  it("«На складе» умеет сказать «нет данных», а не выдумывать ноль", () => {
    const html = dom.serialize();
    expect(html, "без этой ветки неизвестный остаток снова станет «нет на складе»").toContain("if(stockQty == null)");
  });

  it("отменённое ненулевое и НЕ попало в продажи", () => {
    const want = svodTotals();
    const canc = modelRows().reduce((a, tr) => a + (cellNum(tr, "Отменено") || 0), 0);
    const sold = modelRows().reduce((a, tr) => a + (cellNum(tr, "Продано") || 0), 0);
    expect(canc, "по снимку отменено 26,8 млн - ноль означал бы, что колонка не считается").toBeGreaterThan(1);
    expect(sold).toBeLessThan(canc + want.rev / 1e6 + 1);
    expect(sold, "продажи не должны включать отменённое").toBeLessThan(want.rev / 1e6 + 1);
  });
});

// Колонка «Рентабельность» снята с «Товаров» (Катя 21.09.2026). Она считалась как
// (продано − С\С) / продано и не знала ни сборов Маркета, ни нашей доставки, ни АДМ с налогами.
// Сборы Маркета - 27,76 млн из 52,47 млн прайса, то есть 53%: вдвое крупнее себестоимости.
// Колонка показывала 71-85% там, где чистая рентабельность канала по своду -2,7%, и слово
// «рентабельность» значило на одном дашборде две разные вещи.
describe("«Товары»: рентабельности по одной себестоимости больше нет", () => {
  const goodsTable = () => [...D().querySelectorAll("table")]
    .find((t) => /Себестоимость/.test(t.textContent || ""))!;

  it("колонки «Рентабельность» в таблице нет", () => {
    const hs = [...goodsTable().querySelectorAll("thead th")].map((x) => (x.textContent || "").trim());
    expect(hs, "таблица товаров не найдена").toContain("Себестоимость");
    expect(hs).not.toContain("Рентабельность");
  });

  it("число колонок сошлось с числом ячеек: снятая колонка не сдвинула строки", () => {
    const t = goodsTable();
    const n = t.querySelectorAll("thead th").length;
    const rows = [...t.querySelectorAll("tbody tr")].slice(0, 20);
    expect(rows.length, "в таблице нет строк").toBeGreaterThan(0);
    const bad = rows.filter((r) => r.children.length !== n)
      .map((r) => `${(r.children[0]?.textContent || "").trim()}: ячеек ${r.children.length}, колонок ${n}`);
    expect(bad).toEqual([]);
  });

  it("сортировки по снятой колонке не осталось", () => {
    expect(D().querySelector('[data-sort="margin"]'), "заголовок сортировки по margin остался").toBeNull();
  });
});
