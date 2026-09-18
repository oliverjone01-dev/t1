import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";

// Карточка «Оборот» на командном центре показывала одно число - заказанное. У Маркета это врёт:
// за 01-16.09 заказано 10,28 млн, а доставлено 2,33 млн, потому что треть заказов отменяют, а
// половина ещё летит. Теперь чисел два: слева заказано минус отменено, справа доставленное.
// Здесь проверяется, что оба берутся из своих полей daily_totals, а не из одного и того же.

let dom: JSDOM;
let ozonLog = "";
let ozonOut = "";
let staleCommand = "";
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
function setRange(from: string, to: string) {
  (D().getElementById("range-from") as any).value = from;
  (D().getElementById("range-to") as any).value = to;
  D().getElementById("range-apply")!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}
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
  // Сборка OZON отключена (Иван, 18.09.2026), поэтому сторож проверяет не байты его страницы,
  // а что сборщик её и не пишет. При объединении площадок вернуть сравнение разметки.
  ozonOut = mkdtempSync(join(tmpdir(), "warroom-kpi-ozon-"));
  ozonLog = execFileSync("npx", ["tsx", "src/scripts/build-katya.ts"], {
    env: { ...process.env, OUT_DIR: ozonOut }, encoding: "utf8",
  });

  // Снимок daily_totals прошлой версии derive не знает полей о доставке. Проверяем, что сборка
  // на нём не выдаёт молча валовое заказанное под подписью «заказано − отменено».
  const stale = mkdtempSync(join(tmpdir(), "warroom-kpi-stale-"));
  cpSync("data-ym", join(stale, "data"), { recursive: true });
  const dt = join(stale, "data", "daily_totals.ndjson");
  writeFileSync(dt, readFileSync(dt, "utf8").trim().split("\n").filter(Boolean).map((l) => {
    const o = JSON.parse(l);
    for (const k of ["accruals", "rev_canc", "rev_fly", "rev_ret", "rev_service", "flying"]) delete o[k];
    return JSON.stringify(o);
  }).join("\n") + "\n");
  const outS = join(stale, "out");
  mkdirSync(outS, { recursive: true });
  execFileSync("npx", ["tsx", "src/scripts/build-katya.ts"], {
    env: { ...process.env, DATA_DIR: join(stale, "data"), OUT_DIR: outS, PLATFORM: "ym" },
    stdio: "pipe",
  });
  staleCommand = readFileSync(join(outS, "katya-command.html"), "utf8");

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


  it("дельта считается по доставленному, а не по заказанному", () => {
    // Мутация «dlt(v('racc'),p('racc')) -> dlt(gmv-v('rcanc'),gmvP-p('rcanc'))» раньше проходила
    // все тесты молча. На дозревших окнах две базы обычно близки, и отличить их нельзя; окно
    // 01-15.08 - редкий случай, где они расходятся знаком: по доставленному +3.7%, по
    // заказанному −0.3%. Поэтому проверка именно на нём.
    setRange("2026-08-01", "2026-08-15");
    const shown = parseFloat((card().querySelector(".kt-d")!.textContent || "")
      .replace(/[^\d.,-]/g, "").replace(",", "."));
    const w = (a: string, b: string, f: string) =>
      L("data-ym/daily_totals.ndjson").filter((t: any) => t.date >= a && t.date <= b)
        .reduce((s: number, t: any) => s + (t[f] || 0), 0);
    const net = (a: string, b: string) => w(a, b, "revenue") - w(a, b, "rev_canc");
    const CUR = ["2026-08-01", "2026-08-15"] as const, PRV = ["2026-07-17", "2026-07-31"] as const;
    const byDeliv = (w(...CUR, "accruals") / w(...PRV, "accruals") - 1) * 100;
    const byOrdered = (net(...CUR) / net(...PRV) - 1) * 100;
    expect(byDeliv * byOrdered).toBeLessThan(0); // базы действительно расходятся знаком
    expect(Math.abs(shown - byDeliv)).toBeLessThan(1);
    expect(Math.abs(shown - byOrdered)).toBeGreaterThan(2);
    setRange(WIN[0], WIN[1]);
  });

  it("на недозревшем окне вместо дельты стоит пометка, а не красная стрелка", () => {
    // За 10-16.09 дельта по доставленному дала бы ▼91.9% при движении бизнеса −13.8%:
    // 92% заказов окна ещё летят. Такая стрелка на командном центре - ложный триггер P8.
    setRange("2026-09-10", "2026-09-16");
    const d = card().querySelector(".kt-d")!;
    expect(d.textContent).toContain("не дозрело");
    expect(d.className).not.toContain("dn");
    setRange(WIN[0], WIN[1]);
  });

  it("разрыв между числами назван прямо на карточке, а не только в подсказке", () => {
    const t = card().textContent || "";
    expect(t).toContain("разрыв:");
    expect(t).toContain("в пути");
    // на закрытом месяце «в пути» нет, и строка обязана назвать возвраты и услуги
    setRange("2026-07-01", "2026-07-31");
    const july = card().textContent || "";
    expect(july).toContain("возвраты");
    expect(july).toContain("услуги");
    expect(july).not.toContain("в пути");
    setRange(WIN[0], WIN[1]);
  });

  it("соседние поверхности стоят на той же базе, что карточка", () => {
    // До этого на экране было три «оборота» разом: 7,92 и 2,33 на карточке против 10,28 в мосте,
    // а «Средний чек» и ДРР считались от валового заказанного - проверка «оборот ÷ заказы»
    // расходилась с карточкой чека на 23%. Иван выбрал единую базу «заказано − отменено».
    const numOf = (name: string) => {
      const c = [...D().querySelectorAll("#kpis .card")].find((x) => (x.textContent || "").includes(name))!;
      const t = c.querySelector(".kt-v")!.textContent || "";
      const m = t.match(/([\d.,]+)\s*М/);
      return m ? parseFloat(m[1]!.replace(",", ".")) * 1e6
               : parseFloat(t.replace(/[^\d,.-]/g, "").replace(/\s/g, "").replace(",", "."));
    };
    const oborot = pairs()[0]![0], zakazy = numOf("Заказы, шт"), chek = numOf("Средний чек");
    expect(zakazy).toBeGreaterThan(0);
    expect(Math.abs(oborot / zakazy - chek) / chek).toBeLessThan(0.01); // оборот ÷ заказы = чек

    // штуки тоже нетто: иначе чек делился бы на другую базу
    expect(Math.abs(zakazy - (sumWin("units") - sumWin("cancellations")))).toBeLessThan(1);

    // мост «Стало» - то же левое число карточки, а не валовое заказанное
    const bars = [...D().querySelectorAll("#bridge b")].map((b) => b.textContent || "");
    const stalo = bars[bars.length - 1]!;
    const mln2 = parseFloat((stalo.match(/([\d.,]+)\s*М/) || [])[1]?.replace(",", ".") || "0") * 1e6;
    expect(Math.abs(mln2 - oborot)).toBeLessThan(10_000);
    expect(Math.abs(mln2 - sumWin("revenue"))).toBeGreaterThan(100_000); // и точно не валовое

    const tipOf = (name: string) =>
      [...D().querySelectorAll("#kpis .card")].find((c) => (c.textContent || "").includes(name))?.getAttribute("title") || "";
    expect(tipOf("Средний чек")).toContain("заказано минус отменено");
    expect(tipOf("ДРР")).toContain("заказано минус отменено");
  });

  it("снимок без полей о доставке не выдаётся за честные числа", () => {
    // Иначе левое число молча становится валовым заказанным под подписью «заказано − отменено»,
    // то есть ровно тем враньём, которое правка пришла убрать (CLAUDE.md §15 п.3).
    expect(staleCommand).toContain("const MONEY_GAP=true");
    expect(staleCommand).toContain("снимок без полей о доставке");
    // на свежих данных предупреждения быть не должно
    const html = dom.serialize();
    expect(html).toContain("const MONEY_GAP=false");
    expect(card().textContent || "").not.toContain("снимок без полей");
  });

  it("сборка OZON отключена и её страниц не появляется", () => {
    expect(ozonLog).toContain("сборка OZON временно отключена");
    for (const f of ["katya-command.html", "katya.html", "katya-money.html"]) {
      expect(existsSync(join(ozonOut, f)), `${f}: страница OZON писаться не должна`).toBe(false);
    }
  });
});
