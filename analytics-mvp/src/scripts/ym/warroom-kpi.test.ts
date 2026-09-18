import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";

// Карточка «Оборот» на командном центре показывала одно число - заказанное. У Маркета это врёт:
// за 01-16.09 заказано 10,28 млн, а доставлено 2,33 млн, потому что треть заказов отменяют, а
// половина ещё летит. Теперь чисел два: слева заказано минус отменено, справа доставленное.
// Здесь проверяется, что оба берутся из своих полей daily_totals, а не из одного и того же.

let dom: JSDOM;
let ozonCommand = "";
const errs: string[] = [];
const WIN = ["2026-09-01", "2026-09-16"] as const;
const L = (p: string) => readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
// Сумма поля daily_totals за окно. Это тот же файл, который читает сборщик: тест ловит не
// «мою формулу против его формулы», а подключённое не то поле.
const sumWin = (field: string): number =>
  L("data-ym/daily_totals.ndjson")
    .filter((t: any) => t.date >= WIN[0] && t.date <= WIN[1])
    .reduce((s: number, t: any) => s + (t[field] || 0), 0);

const D = () => dom.window.document;
const card = () => {
  const c = [...D().querySelectorAll("#kpis .card")].find((x) => /Оборот/.test(x.textContent || ""));
  if (!c) throw new Error("карточки «Оборот» нет");
  return c;
};
// «12.94 М» / «6.74 М» -> рубли. Карточка округляет до сотых миллиона, поэтому и допуск - 5 тыс.
const mln = (s: string): number | null => {
  const m = String(s).match(/([\d.,]+)\s*М/);
  return m ? parseFloat(m[1]!.replace(",", ".")) * 1e6 : null;
};
const pairs = (): Array<[number, string]> => {
  const c = card();
  const vals = [...c.querySelectorAll(".kt-v")];
  return vals.map((v) => {
    const cap = v.nextElementSibling?.textContent?.trim() || "";
    return [mln(v.textContent || "") as number, cap] as [number, string];
  });
};

beforeAll(async () => {
  const out = mkdtempSync(join(tmpdir(), "warroom-kpi-"));
  execFileSync("npx", ["tsx", "src/scripts/build-katya.ts"], {
    env: { ...process.env, DATA_DIR: "data-ym", OUT_DIR: out, PLATFORM: "ym" },
    stdio: "pipe",
  });
  const outO = mkdtempSync(join(tmpdir(), "warroom-kpi-ozon-"));
  execFileSync("npx", ["tsx", "src/scripts/build-katya.ts"], { env: { ...process.env, OUT_DIR: outO }, stdio: "pipe" });
  ozonCommand = readFileSync(join(outO, "katya-command.html"), "utf8");

  dom = new JSDOM(readFileSync(join(out, "katya-command.html"), "utf8"), {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(w: any) {
      w.addEventListener("error", (e: any) => errs.push(String(e.error || e.message)));
      w.console.error = (...a: any[]) => errs.push(a.join(" "));
    },
  });
  await new Promise((r) => setTimeout(r, 4000));
  (D().getElementById("range-from") as any).value = WIN[0];
  (D().getElementById("range-to") as any).value = WIN[1];
  D().getElementById("range-apply")!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
}, 180_000);

describe("карточка «Оборот» Маркета: заказано минус отменено и рядом доставлено", () => {
  it("страница отрисовалась без ошибок JS", () => {
    expect(errs).toEqual([]);
    expect(D().querySelectorAll("#kpis .card").length).toBeGreaterThan(4);
  });

  it("на карточке два числа со своими подписями", () => {
    const p = pairs();
    expect(p.length).toBe(2);
    expect(p[0]![1]).toBe("заказано − отменено");
    expect(p[1]![1]).toBe("доставлено");
  });

  it("левое число = заказано минус отменено за период", () => {
    const want = sumWin("revenue") - sumWin("rev_canc");
    expect(want).toBeGreaterThan(0);
    expect(Math.abs(pairs()[0]![0] - want)).toBeLessThan(5000);
  });

  it("правое число = доставленное за вычетом возвратов за период", () => {
    const want = sumWin("accruals");
    expect(want).toBeGreaterThan(0);
    expect(Math.abs(pairs()[1]![0] - want)).toBeLessThan(5000);
  });

  it("числа разные: разрыв - это заказы, которые ещё в пути", () => {
    const [ordered, delivered] = [pairs()[0]![0], pairs()[1]![0]];
    expect(ordered).toBeGreaterThan(delivered);
    // остаток сходится с «в пути» и возвратами из тех же суток, до округления карточки
    const gap = sumWin("revenue") - sumWin("rev_canc") - sumWin("accruals");
    const rest = sumWin("rev_fly") + sumWin("rev_ret") + sumWin("rev_service");
    expect(Math.abs(gap - rest)).toBeLessThan(1);
    expect(Math.abs(ordered - delivered - gap)).toBeLessThan(10_000);
  });

  it("ни одно из чисел не равно старому «заказано» целиком", () => {
    const gross = sumWin("revenue");
    for (const [v] of pairs()) expect(Math.abs(v - gross)).toBeGreaterThan(5000);
  });

  it("у OZON карточка прежняя: ни второго числа, ни денежных серий", () => {
    expect(ozonCommand).not.toContain("kpi2");
    expect(ozonCommand).not.toContain('"rcanc"');
    expect(ozonCommand).not.toContain("заказано − отменено");
  });
});
