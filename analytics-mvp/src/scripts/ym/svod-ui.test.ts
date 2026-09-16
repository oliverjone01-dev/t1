import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";

// Числа свода живут в браузерном JS внутри собранной страницы, поэтому vitest над модулями их не
// видит: 220 зелёных тестов и smoke на 17 страниц проходили, пока свод показывал возвращённый
// товар как прибыль со 100% маржой, а категория не сходилась с суммой своих артикулов.
// Этот тест собирает страницу и проверяет сами числа.
//
// Своих фильтров у свода больше нет: период задаёт ЕДИНЫЙ фильтр наверху страницы, кабинеты
// показываются все сразу. Поэтому тест管 водит страницу так же, как человек - кнопками периода.

let dom: JSDOM;
const errs: string[] = [];

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
  await new Promise((r) => setTimeout(r, 1400));
}, 60_000);

const D = () => dom.window.document;
const T = () => D().getElementById("sv-t")!;
const head = () => [...T().querySelectorAll("thead th")].map((x) => x.textContent || "");
const foot = () => [...T().querySelectorAll("tfoot tr:last-child td")].map((x) => (x.textContent || "").trim());
const cell = (c: string) => foot()[head().indexOf(c)];
const catRow = (i: number) => T().querySelector(`tbody tr.sv-cat[data-cat="${i}"]`) as any;
const click = (el: any) => el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
const setLay = (v: string) => { const e = D().getElementById("sv-lay") as any; e.value = v; e.onchange(); };
// Период задаётся тем же способом, что и человеком: панель «Свой» наверху страницы.
const setRange = (from: string, to: string) => {
  (D().getElementById("range-from") as any).value = from;
  (D().getElementById("range-to") as any).value = to;
  click(D().getElementById("range-apply"));
};
const MONTHS = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];
const monthEnd = (m: string) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);

describe("свод Маркета: числа на странице", () => {
  it("страница отрисовалась без ошибок JS и без своих фильтров", () => {
    expect(errs).toEqual([]);
    expect(D().getElementById("sv-b"), "выбор кабинета должен быть убран").toBeNull();
    expect(D().getElementById("sv-m"), "выбор месяца должен быть убран").toBeNull();
    expect(T().querySelectorAll("tbody tr.sv-cat").length).toBeGreaterThan(0);
  });

  it("период берётся из верхнего фильтра: смена периода меняет числа", () => {
    setRange("2026-07-01", "2026-07-31");
    const jul = num(cell("Выручка деньгами"));
    setRange("2026-08-01", "2026-08-31");
    const aug = num(cell("Выручка деньгами"));
    expect(jul).toBeGreaterThan(0);
    expect(aug).toBeGreaterThan(0);
    expect(jul).not.toBe(aug);
  });

  it("июль воспроизводит выверенные числа до рубля", () => {
    setRange("2026-07-01", "2026-07-31");
    expect(num(cell("Штуки"))).toBe(205);
    expect(num(cell("Выручка деньгами"))).toBe(5067076);
    expect(num(cell("Поступление"))).toBe(4071460);
    expect(num(cell("Валовая прибыль (деньги)"))).toBe(1696634);
    expect(num(cell("Чистая прибыль"))).toBe(57754);
  });

  it("категория равна сумме своих артикулов - по каждому месяцу", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const m of MONTHS) {
      setRange(`${m}-01`, monthEnd(m));
      const iGP = head().indexOf("Валовая прибыль (деньги)"), iNP = head().indexOf("Чистая прибыль");
      const n = T().querySelectorAll("tbody tr.sv-cat").length;
      for (let i = 0; i < n; i++) {
        const c = catRow(i);
        const nm = `${m} ${(c.children[0].textContent || "").split("(")[0].trim()}`;
        const gGP = (c.children[iGP].textContent || "").trim(), gNP = (c.children[iNP].textContent || "").trim();
        click(c);
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
        if (nRows === 0) { bad.push(`${nm}: категория не раскрылась`); click(catRow(i)); continue; }
        // «не считается» у категории законно, только если не считается ни одна её строка.
        if (gGP === "не считается") {
          if (nCalc > 0) bad.push(`${nm}: категория «не считается», а ${nCalc} из ${nRows} строк считаются`);
          click(catRow(i)); continue;
        }
        const lim = Math.max(2, nRows);   // допуск на округление вывода: до рубля на строку
        if (Math.abs((num(gGP) || 0) - sGP) > lim) bad.push(`${nm}: ВП ${num(gGP)} против ${Math.round(sGP)} по строкам`);
        if (Math.abs((num(gNP) || 0) - sNP) > lim) bad.push(`${nm}: ЧП ${num(gNP)} против ${Math.round(sNP)} по строкам`);
        click(catRow(i));
      }
    }
    expect(checked).toBeGreaterThan(20);
    expect(bad).toEqual([]);
  }, 120_000);

  it("возвращённый товар не показывается прибылью", () => {
    const bad: string[] = [];
    for (const m of MONTHS) {
      setRange(`${m}-01`, monthEnd(m));
      const iGP = head().indexOf("Валовая прибыль (деньги)"), iU = head().indexOf("Штуки");
      const n = T().querySelectorAll("tbody tr.sv-cat").length;
      for (let i = 0; i < n; i++) click(catRow(i));
      for (const r of [...T().querySelectorAll("tbody tr")]) {
        if (r.classList.contains("sv-cat")) continue;
        const u = num(r.children[iU]!.textContent), gp = num(r.children[iGP]!.textContent);
        if (u !== null && u <= 0 && gp !== null && gp > 0) bad.push(`${m} ${r.children[0]!.textContent}: штук ${u}, валовая ${gp}`);
      }
    }
    expect(bad).toEqual([]);
  }, 90_000);

  it("база поступления - выручка деньгами, из неё возвраты уже вычтены", () => {
    const svod = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf-8"));
    setRange("2026-07-01", "2026-07-31");
    const want = svod.months.filter((m: any) => m.ym === "2026-07")
      .flatMap((m: any) => m.rows).reduce((a: number, r: any) => a + (r.revenue_money || 0), 0);
    expect(Math.abs((num(cell("Выручка деньгами")) || 0) - want)).toBeLessThan(2);
    // Цена продажи возвраты не учитывает и базой быть не может: разница за июль - 109 809 ₽.
    expect(num(cell("Продажи"))).toBeGreaterThan(num(cell("Выручка деньгами"))!);
  });

  it("период без заказов не называется убытком: таблицы нет, есть внятное сообщение", () => {
    setRange("2026-01-01", "2026-01-31");   // до начала данных
    expect(T().querySelectorAll("tbody tr").length).toBe(0);
    expect(T().querySelectorAll("tfoot td").length, "подвал с числами на пустом периоде").toBe(0);
    const cov = (D().getElementById("sv-cov")!.textContent || "");
    expect(cov).toContain("За выбранный период доставленных заказов в снимке нет");
    // Ни одной денежной величины на экране быть не должно - иначе пустоту можно принять за убыток.
    expect(T().textContent!.trim()).toBe("");
  });

  // Ради этого всё и делалось: период короче месяца. На ЦЕЛОМ месяце фильтр строк по дате
  // ничего не меняет (в месяце и так только его дни), поэтому без этой проверки можно было
  // выбросить фильтрацию и не заметить - мутация проходила молча.
  it("половинки месяца складываются в месяц: 1-15 плюс 16-31 = весь июль", () => {
    const grab = () => ({
      un: num(cell("Штуки")) || 0,
      rev: num(cell("Выручка деньгами")) || 0,
      price: num(cell("Продажи")) || 0,
      cogs: num(cell("СС")) || 0,
    });
    setRange("2026-07-01", "2026-07-31"); const full = grab();
    setRange("2026-07-01", "2026-07-15"); const h1 = grab();
    setRange("2026-07-16", "2026-07-31"); const h2 = grab();
    expect(full.un).toBe(205);
    // Каждая половина строго меньше целого - иначе строки не фильтруются по дате.
    expect(h1.un, "первая половина не меньше месяца").toBeLessThan(full.un);
    expect(h2.un, "вторая половина не меньше месяца").toBeLessThan(full.un);
    expect(h1.un + h2.un).toBe(full.un);
    for (const k of ["rev", "price", "cogs"] as const) {
      expect(Math.abs(h1[k] + h2[k] - full[k]), `${k}: половинки не сходятся с месяцем`).toBeLessThan(2);
    }
  });

  it("общие расходы кабинета следуют периоду, а не месяцу целиком", () => {
    const svod = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf-8"));
    const jul = svod.months.filter((m: any) => m.ym === "2026-07");
    const daysWith = jul.flatMap((m: any) => Object.keys(m.overhead_daily || {})).sort();
    expect(daysWith.length, "у июля нет дневной разбивки расходов").toBeGreaterThan(0);
    const ohRow = () => [...T().querySelectorAll("tfoot tr:first-child td")].map((x) => (x.textContent || "").trim());
    setRange("2026-07-01", "2026-07-31");
    const full = num(ohRow()[head().indexOf("Поступление")]);
    // Окно до первого дня с расходами обязано дать ноль общих расходов.
    const firstDay = daysWith[0]!;
    setRange("2026-07-01", firstDay > "2026-07-01" ? new Date(Date.parse(firstDay) - 86400000).toISOString().slice(0, 10) : "2026-07-01");
    const partial = num(ohRow()[head().indexOf("Поступление")]);
    expect(full).not.toBe(0);
    expect(Math.abs(partial || 0), "расходы дней вне окна попали в период").toBeLessThan(Math.abs(full || 0));
  });

  it("две раскладки называют валовую прибыль по-разному - базы у них разные", () => {
    setRange("2026-07-01", "2026-07-31");
    expect(head()).toContain("Валовая прибыль (деньги)");
    setLay("pts");
    expect(head()).toContain("Валовая прибыль (деньги + баллы)");
    expect(head()).not.toContain("Валовая прибыль (деньги)");
    setLay("pnl");
    expect(errs).toEqual([]);
  });
});
