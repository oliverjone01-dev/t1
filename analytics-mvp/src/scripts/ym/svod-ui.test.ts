import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";

// Числа свода живут в браузерном JS внутри собранной страницы, поэтому vitest над модулями их не
// видит: 220 зелёных тестов и smoke на 17 страниц проходили, пока свод показывал возвращённый
// товар как прибыль со 100% маржой, а категория не сходилась с суммой своих артикулов.
// Этот тест собирает страницу и проверяет сами числа - на всех кабинетах и всех месяцах сразу.
// Страницу строим сами (около 1.5 с), чтобы тест не молчал, когда артефакта нет.

let dom: JSDOM;
let errs: string[] = [];

const num = (s: string | null | undefined): number | null => {
  const v = parseFloat(String(s ?? "").replace(/[^\d,.-]/g, "").replace(/ |\s/g, "").replace(",", "."));
  return isNaN(v) ? null : v;
};

beforeAll(async () => {
  const out = mkdtempSync(join(tmpdir(), "svod-ui-"));
  execFileSync("npx", ["tsx", "src/scripts/build-katya.ts"], {
    env: { ...process.env, DATA_DIR: "data-ym", OUT_DIR: out, PLATFORM: "ym" },
    stdio: "pipe",
  });
  dom = new JSDOM(readFileSync(join(out, "katya-money.html"), "utf8"), {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(w: any) {
      w.addEventListener("error", (e: any) => errs.push(String(e.error || e.message)));
      w.console.error = (...a: any[]) => errs.push(a.join(" "));
    },
  });
  await new Promise((r) => setTimeout(r, 1200));
}, 60_000);

const D = () => dom.window.document;
const T = () => D().getElementById("sv-t")!;
const head = () => [...T().querySelectorAll("thead th")].map((x) => x.textContent || "");
const foot = () => [...T().querySelectorAll("tfoot tr:last-child td")].map((x) => (x.textContent || "").trim());
const catRow = (i: number) => T().querySelector(`tbody tr.sv-cat[data-cat="${i}"]`) as any;
const click = (i: number) => catRow(i).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
const opts = (id: string) => [...(D().getElementById(id) as any).options].map((o: any) => o.value);
const set = (id: string, v: string) => { const e = D().getElementById(id) as any; e.value = v; e.onchange(); };

describe("свод Маркета: числа на странице", () => {
  it("страница отрисовалась без ошибок JS", () => {
    expect(errs).toEqual([]);
    expect(T().querySelectorAll("tbody tr.sv-cat").length).toBeGreaterThan(0);
  });

  it("категория равна сумме своих артикулов - по всем кабинетам и месяцам", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const bz of opts("sv-b")) for (const ym of opts("sv-m")) {
      set("sv-b", bz); set("sv-m", ym);
      const iGP = head().indexOf("Валовая прибыль (деньги)"), iNP = head().indexOf("Чистая прибыль");
      const n = T().querySelectorAll("tbody tr.sv-cat").length;
      for (let i = 0; i < n; i++) {
        const c = catRow(i);
        const nm = `${bz} ${ym} ${(c.children[0].textContent || "").split("(")[0].trim()}`;
        const gGP = (c.children[iGP].textContent || "").trim(), gNP = (c.children[iNP].textContent || "").trim();
        click(i);
        const all = [...T().querySelectorAll("tbody tr")];
        const gi = all.indexOf(catRow(i));
        let sGP = 0, sNP = 0, nCalc = 0, nRows = 0;
        for (let j = gi + 1; j < all.length && !all[j]!.classList.contains("sv-cat"); j++) {
          nRows++;
          if ((all[j]!.children[iGP]!.textContent || "").trim() !== "не считается") {
            sGP += num(all[j]!.children[iGP]!.textContent) || 0;
            sNP += num(all[j]!.children[iNP]!.textContent) || 0;
            nCalc++;
          }
        }
        checked++;
        if (nRows === 0) { bad.push(`${nm}: категория не раскрылась`); click(i); continue; }
        // «не считается» у категории законно, только если не считается ни одна её строка. Иначе
        // это дыра: у «Столов» 9 SKU из 57 без С/С уводили в прочерк всю категорию.
        if (gGP === "не считается") {
          if (nCalc > 0) bad.push(`${nm}: категория «не считается», а ${nCalc} из ${nRows} строк считаются`);
          click(i); continue;
        }
        // Допуск - округление вывода, до 1 рубля на строку.
        const lim = Math.max(2, nRows);
        if (Math.abs((num(gGP) || 0) - sGP) > lim) bad.push(`${nm}: ВП категории ${num(gGP)} против ${Math.round(sGP)} по строкам`);
        if (Math.abs((num(gNP) || 0) - sNP) > lim) bad.push(`${nm}: ЧП категории ${num(gNP)} против ${Math.round(sNP)} по строкам`);
        click(i);
      }
    }
    expect(checked).toBeGreaterThan(20);
    expect(bad).toEqual([]);
  }, 120_000);

  it("возвращённый товар не показывается прибылью", () => {
    const bad: string[] = [];
    for (const ym of opts("sv-m")) {
      set("sv-b", "all"); set("sv-m", ym);
      const iGP = head().indexOf("Валовая прибыль (деньги)"), iU = head().indexOf("Штуки");
      const n = T().querySelectorAll("tbody tr.sv-cat").length;
      for (let i = 0; i < n; i++) click(i);
      for (const r of [...T().querySelectorAll("tbody tr")]) {
        if (r.classList.contains("sv-cat")) continue;
        const u = num(r.children[iU]!.textContent), gp = num(r.children[iGP]!.textContent);
        if (u !== null && u <= 0 && gp !== null && gp > 0) bad.push(`${ym} ${r.children[0]!.textContent}: штук ${u}, валовая ${gp}`);
      }
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it("база поступления - выручка деньгами, из неё возвраты уже вычтены", () => {
    const svod = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf8"));
    set("sv-b", "all"); set("sv-m", "2026-07");
    const iRev = head().indexOf("Выручка деньгами");
    const want = svod.months.filter((m: any) => m.ym === "2026-07")
      .flatMap((m: any) => m.rows).reduce((a: number, r: any) => a + (r.revenue_money || 0), 0);
    expect(Math.abs((num(foot()[iRev]) || 0) - want)).toBeLessThan(2);
    // Цена продажи возвраты не учитывает и базой быть не может: разница за июль - 109 809 ₽.
    expect(num(foot()[head().indexOf("Продажи")])).toBeGreaterThan(num(foot()[iRev])!);
  });

  it("месяц без заказов не называется убытком по валовой прибыли", () => {
    set("sv-b", "1023124"); set("sv-m", "2026-02");
    expect(T().querySelectorAll("tbody tr").length).toBe(0);
    const f = foot();
    for (const c of ["Валовая прибыль (деньги)", "Маржа", "Чистая прибыль", "Рентаб."]) {
      expect(f[head().indexOf(c)], `${c} на пустом месяце`).toBe("—");
    }
  });

  it("две раскладки называют валовую прибыль по-разному - базы у них разные", () => {
    set("sv-b", "all"); set("sv-m", "2026-07");
    expect(head()).toContain("Валовая прибыль (деньги)");
    set("sv-lay", "pts");
    expect(head()).toContain("Валовая прибыль (деньги + баллы)");
    expect(head()).not.toContain("Валовая прибыль (деньги)");
    expect(errs).toEqual([]);
  });
});
