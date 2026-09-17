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

  // Числа сверены с отчётом о платежах и отчётом о реализации. Менялись один раз, 2026-09-16:
  // кабинет зеркал за июль перешёл с отчёта о платежах на АКТ по стоимости услуг. Реестр показывал
  // только снятые деньгами 17 286 ₽ одной строкой «Оплата услуг Маркета», акт - 38 910 ₽ с
  // разбивкой (Полка 23 915, Буст за показы 14 912, Товарные баннеры 83). Разница 21 624 ₽ ушла
  // в общие расходы кабинета и ровно на неё уменьшились поступление, валовая и чистая; выручка,
  // штуки и услуги по заказам не шевельнулись. Это смена источника на более полный, не пересчёт.
  it("июль воспроизводит выверенные числа до рубля", () => {
    setRange("2026-07-01", "2026-07-31");
    expect(num(cell("Штуки"))).toBe(205);
    expect(num(cell("Выручка деньгами"))).toBe(5067076);
    expect(num(cell("Поступление"))).toBe(4049836);
    expect(num(cell("Валовая прибыль (деньги)"))).toBe(1675009);
    expect(num(cell("Чистая прибыль"))).toBe(36130);
  });

  // Причина того сдвига, закреплённая отдельно: если акт снова перестанет доезжать и расходы
  // откатятся к реестру, числа выше молча вернутся к прежним, а этот тест назовёт причину.
  it("общие расходы июля берутся из акта, а не из отчёта о платежах", () => {
    setRange("2026-07-01", "2026-07-31");
    const ohRow = [...T().querySelectorAll("tfoot tr:first-child td")];
    expect(num(ohRow[head().indexOf("Поступление")]?.textContent)).toBe(-65157);
    // Полки, подписки и буст за показы есть только в акте: в отчёте о платежах по этой паре
    // стояли 17 286 ₽ одной строкой «Оплата услуг Маркета».
    expect(D().getElementById("sv-gaps")!.textContent || "")
      .not.toContain("акт по стоимости услуг за этот месяц по ним ещё не собран");
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

  // Ниже - про то, что вся страница отвечает ОДНИМ числом. Пока план и водопад считали по своей
  // базе (проводки реестра + pnl_sku_daily), за июль они давали выручку 15 287 504 ₽ и чистую
  // -294 510 ₽, а таблица под ними - 9 722 328 ₽ и 140 942 ₽. Расхождение ловится только так:
  // взять число из одного блока и сверить с числом из другого на той же странице.
  const planFact = (lab: string): number | null => {
    const rows: any[] = (dom.window as any).planRows(planYm);
    const r = rows.find((x) => x[0] === lab);
    return r ? (r[2] == null ? null : Math.round(r[2])) : null;
  };
  let planYm = "2026-07";

  it("план на месяц берёт факт из свода: те же числа, что в ИТОГО таблицы", () => {
    const bad: string[] = [];
    let compared = 0;
    for (const m of MONTHS) {
      planYm = m;
      setRange(`${m}-01`, monthEnd(m));
      // Верхний фильтр подрезает запрошенный период под окно данных (февраль начинается с 06-го,
      // сентябрь кончается вчерашним днём). План считает КАЛЕНДАРНЫЙ месяц, поэтому сравнивать
      // его с таблицей можно только там, где фильтр отдал весь месяц целиком - иначе тест ловил
      // бы подрезку, а не расхождение источников.
      const w = (dom.window as any).__guruPeriod || {};
      if (w.curFrom !== `${m}-01` || w.curTo !== monthEnd(m)) continue;
      compared++;
      const pairs: Array<[string, string]> = [
        ["Реализация", "Штуки"], ["Выручка деньгами", "Выручка деньгами"],
        ["Валовая прибыль", "Валовая прибыль (деньги)"], ["Чистая прибыль", "Чистая прибыль"],
      ];
      for (const [pl, tb] of pairs) {
        const a = planFact(pl), b = num(cell(tb));
        if (a === null || b === null) { bad.push(`${m} ${pl}: нет числа (план ${a}, таблица ${b})`); continue; }
        if (Math.abs(a - b) > 1) bad.push(`${m} ${pl}: план ${a} против таблицы ${b}`);
      }
    }
    expect(compared, "сравнивать оказалось нечего - тест стал пустым").toBeGreaterThanOrEqual(5);
    expect(bad).toEqual([]);
  }, 60_000);

  it("план показывает только текущий и будущие месяцы, и текущий сходится с таблицей", () => {
    const sel = D().getElementById("plan-month") as any;
    const opts = [...sel.options].map((o: any) => o.value);
    expect(opts.length, "в плане нет ни одного месяца").toBeGreaterThan(0);
    const cur = (dom.window as any).planCurMon();
    expect(opts).toContain(cur);
    expect(opts.filter((v: string) => v < cur), "в плане месяцы из прошлого").toEqual([]);
    // Текущий месяц - единственный, который пользователь реально видит в этом блоке, поэтому
    // именно он обязан совпадать с таблицей за тот же период.
    planYm = cur;
    setRange(`${cur}-01`, monthEnd(cur));
    expect(planFact("Реализация")).toBe(num(cell("Штуки")));
    expect(Math.abs((planFact("Чистая прибыль") || 0) - (num(cell("Чистая прибыль")) || 0))).toBeLessThanOrEqual(1);
  });

  // §15 п.2: целый закрытый месяц, часть месяца, текущий незакрытый. Граничные периоды - главный
  // источник багов, и именно на них водопад раньше расходился с таблицей сильнее всего.
  const WF_PERIODS: Array<[string, string, string]> = [
    ["2026-07-01", "2026-07-31", "целый закрытый месяц"],
    ["2026-08-01", "2026-08-15", "часть месяца"],
    ["2026-09-01", "2026-09-30", "текущий незакрытый"],
    ["2026-08-17", "2026-09-15", "окно через границу месяцев"],
  ];
  const bars = () => [...D().querySelectorAll("#wf > div")].map((x) => {
    const t = x.getAttribute("title") || "";
    const i = t.lastIndexOf(":");
    return [t.slice(0, i), num(t.slice(i + 1))! ] as [string, number];
  });

  it("водопад: бары складываются в цепочку и последний равен чистой прибыли таблицы", () => {
    const bad: string[] = [];
    for (const [from, to, lab] of WF_PERIODS) {
      setRange(from, to);
      const b = bars();
      if (b.length < 4) { bad.push(`${lab}: водопад не нарисован (${b.length} баров)`); continue; }
      // Промежуточные итоги («Поступление по артикулам») в сумму не идут - это метки уровня,
      // а не шаги. Старт - первый бар, дальше складываются только шаги.
      const steps = b.slice(1).filter((x) => !/^Поступление по артикулам|^Чистая прибыль/.test(x[0]));
      const chain = b[0]![1] + steps.reduce((a, x) => a + x[1], 0);
      const last = b[b.length - 1]!;
      if (!/^Чистая прибыль/.test(last[0])) bad.push(`${lab}: последний бар «${last[0]}», а не чистая прибыль`);
      if (Math.abs(chain - last[1]) > 2) bad.push(`${lab}: цепочка даёт ${Math.round(chain)}, последний бар ${last[1]}`);
      const tbl = num(cell("Чистая прибыль"));
      if (tbl === null || Math.abs(last[1] - tbl) > 2) bad.push(`${lab}: водопад ${last[1]} против таблицы ${tbl}`);
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it("блок «Общие расходы» под Маркет: колонки свои, итог равен строке свода", () => {
    const hdr = () => [...D().querySelectorAll("#acct-h th")].map((x) => (x.textContent || "").trim());
    const rows = () => [...D().querySelectorAll("#acct tr")];
    setRange("2026-07-01", "2026-07-31");
    // Колонок OZON тут быть не должно: у Маркета нет ни рекламы за клик, ни realFBS, ни гибкого
    // графика - все пять колонок стояли пустыми, а вся сумма падала в «Прочее».
    for (const ozon of ["Реклама (клик+заказ)", "Штрафы + гибкий график", "realFBS + сервис + страховка", "Бейдж/сеть/отзывы/Premium", "Доставка от покупателя"]) {
      expect(hdr(), `колонка OZON «${ozon}» осталась на Маркете`).not.toContain(ozon);
    }
    expect(hdr()).toContain("Продвижение");
    // Разбивка обязана быть НЕ пустой. Если derive перестанет писать статьи по дням, итог всё
    // равно сойдётся (остаток уезжает в «Вне групп») - и без этой проверки потеря разбивки
    // прошла бы молча: пользователь снова видел бы одну кучу вместо статей.
    {
      const tot = rows().find((r) => (r.textContent || "").startsWith("Всего"))!;
      const cells = [...tot.children].slice(1, -1).map((c) => Math.abs(num(c.textContent) || 0));
      const named = hdr().slice(1, -1).map((h, i) => (h === "Вне групп" ? 0 : cells[i] || 0));
      expect(named.reduce((a, b) => a + b, 0), "все расходы легли в «Вне групп»: разбивки по статьям нет").toBeGreaterThan(0);
      expect(hdr(), "колонка «Вне групп» появилась - статья не попала ни в одну группу").not.toContain("Вне групп");
    }
    const bad: string[] = [];
    for (const [from, to, lab] of WF_PERIODS) {
      setRange(from, to);
      const tot = rows().find((r) => (r.textContent || "").startsWith("Всего"));
      // строка свода «Общие расходы кабинета» - первая в подвале
      const ohCell = [...T().querySelectorAll("tfoot tr:first-child td")][head().indexOf("Поступление")];
      const svodOh = Math.abs(num(ohCell?.textContent) || 0);
      const blockOh = tot ? Math.abs(num([...tot.children].pop()!.textContent) || 0) : 0;
      if (Math.abs(blockOh - svodOh) > 1) bad.push(`${lab}: блок ${blockOh} против свода ${svodOh}`);
      // Деньгами + Баллами обязаны дать «Всего»: иначе часть расходов не видна ни в одной строке.
      if (tot) {
        const m = rows().find((r) => (r.textContent || "").startsWith("Деньгами"));
        const p = rows().find((r) => (r.textContent || "").startsWith("Баллами"));
        const sum = (num([...m!.children].pop()!.textContent) || 0) + (num([...p!.children].pop()!.textContent) || 0);
        const tt = num([...tot.children].pop()!.textContent) || 0;
        if (Math.abs(sum - tt) > 1) bad.push(`${lab}: деньгами+баллами ${Math.round(sum)} против «Всего» ${tt}`);
      }
    }
    expect(bad).toEqual([]);
  }, 60_000);

  // ФЕНИКС, аудит 2026-09-17, gap 1: на окне без доставленных заказов водопад молча уходил на
  // старый базис и заявлял прибыль там, где таблица показывает пустоту. За 28.02 это было
  // «Чистая прибыль 147 464 ₽» при нуле строк свода - ровно то противоречие, ради снятия
  // которого водопад и переводили на свод. Ни один из прежних тестов пустое окно не трогал.
  it("пустое окно: водопад и план молчат, а не считают по другому источнику", () => {
    for (const day of ["2026-02-28", "2026-09-15"]) {
      setRange(day, day);
      expect(T().querySelectorAll("tbody tr").length, `${day}: в своде есть строки, окно не пустое`).toBe(0);
      const wf = D().getElementById("wf")!;
      expect(wf.querySelectorAll("div.bar").length, `${day}: водопад нарисовал бары на пустом окне`).toBe(0);
      expect(wf.textContent || "").toContain("доставленных заказов в снимке нет");
    }
  });

  it("месяц без доставленных заказов: план показывает прочерки, а не числа по дате проводки", () => {
    const svod = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf-8"));
    const empty = ["2026-01", "2025-12"].find((m) =>
      !svod.months.some((x: any) => x.ym === m && (x.rows || []).length));
    expect(empty, "в снимке не нашлось месяца без строк свода - проверять нечего").toBeTruthy();
    const rows: any[] = (dom.window as any).planRows(empty!);
    for (const r of rows) expect(r[2], `${empty}: план показал факт «${r[0]}» на пустом месяце`).toBeNull();
  });

  // ФЕНИКС, gap 4: в заметке стояли числа замера, и они прокисли в тот же день (9 722 328 было
  // названо выручкой свода, хотя это справочная колонка «Продажи»). Теперь считается на месте.
  it("заметка о скрытой таблице показывает живое расхождение, а не замер", () => {
    setRange("2026-07-01", "2026-07-31");
    const gap = D().getElementById("skuan-gap")!;
    const txt = gap.textContent || "";
    expect(txt, "заметка пуста - разбор ИТОГО скрытой таблицы сломан").toContain("базы расходятся");
    // Сравниваем с тем, что НАРИСОВАНО в ИТОГО: форматирование у обоих одно (fmtRu).
    const shown = (cell("Чистая прибыль") || "").replace(/\u00A0/g, " ").trim();
    expect(shown, "в ИТОГО нет чистой прибыли").not.toBe("");
    expect(txt.replace(/\u00A0/g, " "), `в заметке нет числа свода «${shown}»`).toContain(shown);
    // Числа разового замера не должны стоять в видимом тексте: он читается как факт.
    const visible = [...D().querySelectorAll("section.card")].map((x) => x.textContent || "").join(" ");
    expect(visible).not.toContain("9 722 328 ₽ и 140 942 ₽");
    expect(visible, "колонка «Продажи» снова названа выручкой").not.toContain("выручка 15 287 504");
  });

  // ФЕНИКС, gap 2: страница отрицала отчёт по баллам, считая по нему.
  it("страница не отрицает отчёт по баллам, когда считает по нему", () => {
    setRange("2026-07-01", "2026-07-31");
    setLay("pts");
    const note = D().getElementById("sv-note")!.textContent || "";
    expect(note, "устаревшее утверждение осталось").not.toContain("отдельного отчёта по баллам у Маркета нет");
    const svod = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf-8"));
    const byReport = svod.months.filter((m: any) => m.points_src === "report").length;
    if (byReport > 0) expect(note).toContain("отчёт по баллам Маркета");
    setLay("pnl");
  });

  it("второй таблицы по артикулам на Маркете нет: она расходилась со сводом", () => {
    // Раздел остаётся на месте с объяснением - но именно таблицы с другими числами быть не должно.
    expect(D().getElementById("skuan-t")!.closest(".kt-scroll")!.getAttribute("style") || "").toContain("display:none");
    expect(D().body.textContent).toContain("Свод по дате заказа");
  });

  it("переключатель площадки: обе подписи разные и ведут на ту же вкладку", () => {
    const chips = [...D().querySelectorAll("#gg-nav a")].filter((a) => /^(OZON|Яндекс Маркет)$/.test((a.textContent || "").trim()));
    expect(chips.length, "переключателя площадки нет").toBe(2);
    // platformize() в сборке Маркета меняет каждое «OZON» на «Яндекс Маркет»; без сторожа
    // KEEP_OZON обе кнопки подписывались одинаково.
    expect((chips[0]!.textContent || "").trim()).toBe("OZON");
    expect((chips[1]!.textContent || "").trim()).toBe("Яндекс Маркет");
    expect(chips[0]!.getAttribute("href")).toBe("../katya-money.html");
    expect(chips[1]!.getAttribute("href")).toBe("katya-money.html");
    // Вкладки «Реакция» на Маркете нет: файла katya-reakciya.html в public/market/ не существует.
    expect([...D().querySelectorAll("#gg-nav a")].map((a) => a.getAttribute("href")))
      .not.toContain("katya-reakciya.html");
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
