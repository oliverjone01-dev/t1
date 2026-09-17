import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";

// «Воронка продаж» и «Воронка по категориям» стояли на одной странице и давали разные числа:
// 386 868 показов против 702 634, 162 заказа против 151, выкуплено 125 против 151. Smoke это не
// ловил - ошибок JS не было, просто два блока читали разные файлы и один из них дважды.
// Здесь проверяется, что оба блока считают ОДНО и что каждое число берётся из своего источника.

let dom: JSDOM;
const errs: string[] = [];
const num = (s: string | null | undefined): number | null => {
  const v = parseFloat(String(s ?? "").replace(/[^\d,.-]/g, "").replace(/\s/g, "").replace(",", "."));
  return isNaN(v) ? null : v;
};
const L = (p: string) => readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const WIN = ["2026-09-01", "2026-09-16"] as const;
const inWin = (d: string) => d >= WIN[0] && d <= WIN[1];

beforeAll(async () => {
  const out = mkdtempSync(join(tmpdir(), "voronka-ui-"));
  execFileSync("npx", ["tsx", "src/scripts/build-katya.ts"], {
    env: { ...process.env, DATA_DIR: "data-ym", OUT_DIR: out, PLATFORM: "ym" },
    stdio: "pipe",
  });
  dom = new JSDOM(readFileSync(join(out, "katya-voronka.html"), "utf8"), {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(w: any) {
      w.addEventListener("error", (e: any) => errs.push(String(e.error || e.message)));
      w.console.error = (...a: any[]) => errs.push(a.join(" "));
    },
  });
  await new Promise((r) => setTimeout(r, 1400));
  setRange(WIN[0], WIN[1]);
}, 90_000);

const D = () => dom.window.document;
function setRange(from: string, to: string) {
  (D().getElementById("range-from") as any).value = from;
  (D().getElementById("range-to") as any).value = to;
  D().getElementById("range-apply")!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}
// Шаг воронки продаж по подписи: в разметке подпись и число лежат в соседних узлах одной строки.
const funnelStep = (name: string): number | null => {
  const t = (D().getElementById("funnel")!.textContent || "").replace(/\s+/g, " ");
  const m = t.match(new RegExp(name + "\\s*([\\d \\u00a0]+)"));
  return m ? num(m[1]) : null;
};
const totalCells = () => {
  const tr = [...D().querySelectorAll("#catfun tr")].find((x) => /Итого/.test(x.textContent || ""));
  return tr ? [...tr.children].map((c) => num(c.textContent)) : [];
};
// Колонки таблицы: 0 имя, 1 показы, 3 в поиске, 5 карточка, 7 корзина, 9 заказано, 11 выкуплено.
const T = { views: 1, vsearch: 3, pdp: 5, cart: 7, units: 9, deliv: 11 };

describe("воронка Маркета: два блока считают одно", () => {
  it("страница отрисовалась без ошибок JS", () => {
    expect(errs).toEqual([]);
    expect(totalCells().length).toBeGreaterThan(10);
  });

  it("итог по категориям совпадает с воронкой продаж на каждом шаге", () => {
    const c = totalCells();
    const bad: string[] = [];
    const pairs: Array<[string, string, number]> = [
      ["Показы, всего", "показы", T.views],
      ["Посещения карточки товара", "карточка", T.pdp],
      ["Добавления в корзину", "корзина", T.cart],
      ["Заказано товаров", "заказано", T.units],
      ["Выкуплено", "выкуплено", T.deliv],
    ];
    for (const [step, lab, col] of pairs) {
      const a = funnelStep(step), b = c[col];
      if (a !== b) bad.push(`${lab}: воронка ${a}, таблица ${b}`);
    }
    expect(bad).toEqual([]);
  });

  // Причина расхождения показов, закреплённая числом: агрегатная строка отчёта несёт СВЁРНУТОЕ
  // окно (31.08-06.09 датой 06.09), и таблица складывала его с дневными - неделя считалась дважды.
  it("агрегатные строки отчёта показов в счёт не идут", () => {
    const V = L("data-ym/sku_views.ndjson").filter((r: any) => inWin(r.date));
    const day = V.filter((r: any) => !r.aggregate).reduce((a: number, r: any) => a + (r.views || 0), 0);
    const agg = V.filter((r: any) => r.aggregate).reduce((a: number, r: any) => a + (r.views || 0), 0);
    expect(agg, "в снимке нет агрегатных строк - проверять нечего, тест перестал ловить дефект").toBeGreaterThan(0);
    expect(totalCells()[T.views]).toBe(day);
    expect(totalCells()[T.views]).not.toBe(day + agg);
  });

  // Решение Ивана 17.09: «по 3 пункту считай по реально доставленному».
  it("«Выкуплено» - реально доставленное, а не «заказано минус отмены»", () => {
    const T2 = L("data-ym/daily_totals.ndjson").filter((t: any) => inWin(t.date));
    const s = (k: string) => T2.reduce((a: number, t: any) => a + (t[k] || 0), 0);
    const deliv = s("delivered"), notCancelled = s("units") - s("cancellations");
    expect(deliv, "доставленное и «заказано − отмены» совпали - тест перестал различать формулы").not.toBe(notCancelled);
    expect(funnelStep("Выкуплено")).toBe(deliv);
    expect(totalCells()[T.deliv]).toBe(deliv);
  });

  // Заказы берутся из выгрузки заказов, а не из отчёта показов, который знает их меньше.
  it("«Заказано» берётся из заказов, а не из отчёта показов", () => {
    const T2 = L("data-ym/daily_totals.ndjson").filter((t: any) => inWin(t.date));
    const orders = T2.reduce((a: number, t: any) => a + (t.units || 0), 0);
    const fromViews = L("data-ym/sku_views.ndjson").filter((r: any) => inWin(r.date))
      .reduce((a: number, r: any) => a + (r.units || 0), 0);
    expect(orders, "источники сошлись - тест больше не различает их").not.toBe(fromViews);
    expect(funnelStep("Заказано товаров")).toBe(orders);
    expect(totalCells()[T.units]).toBe(orders);
  });

  // Знаменатель падал на «или единица», и пустая база сравнения давала ровно −100%.
  it("при нулевой базе конверсия говорит «нет базы», а не процент", () => {
    const prev = L("data-ym/daily_totals.ndjson").filter((t: any) => t.date >= "2026-08-16" && t.date <= "2026-08-31");
    expect(prev.reduce((a: number, t: any) => a + (t.views || 0), 0), "в базе появились показы - случай не воспроизводится").toBe(0);
    const cards = [...D().querySelectorAll("#kpis .card")];
    const conv = cards.find((c) => /Конверсия/.test(c.textContent || ""))!;
    expect(conv.textContent).toContain("нет базы");
    expect(conv.textContent, "сравнение с пустой базой снова печатает процент").not.toMatch(/100[.,]0%/);
  });

  it("подпись называет, сколько штук периода ещё едет", () => {
    const T2 = L("data-ym/daily_totals.ndjson").filter((t: any) => inWin(t.date));
    const s = (k: string) => T2.reduce((a: number, t: any) => a + (t[k] || 0), 0);
    const fly = s("units") - s("delivered") - s("cancellations") - s("returns");
    expect(fly).toBeGreaterThan(0);
    expect((D().getElementById("fsub")!.textContent || "").replace(/\s/g, ""))
      .toContain("впути" + String(fly));
  });
});
