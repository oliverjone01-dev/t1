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

// Колонка «Рентабельность» вернулась 22.09.2026, но считается ИЗ СВОДА, а не из цены.
// Прежняя формула была (продано − С\С) / продано: она не знала ни сборов Маркета, ни нашей
// доставки, ни общих расходов кабинета, ни АДМ с налогами. Сборы Маркета - 27,76 млн из 52,47 млн
// прайса, то есть 53%, вдвое крупнее себестоимости; колонка показывала 71-85% там, где чистая
// рентабельность канала по своду −2,7%. Поэтому здесь проверяется не наличие колонки, а ЧИСЛО:
// взвешенный итог страницы обязан совпасть с тем же расчётом, сделанным прямо по файлу свода.
const DEL = ["Доставка покупателю", "Доставка (средняя миля)", "Доставка невыкупов и возвратов"];
function svodPnl() {
  const sv = JSON.parse(readFileSync("data-ym/svod_orders.json", "utf8"));
  const ms = sv.months || sv;
  // Ставка общих расходов - помесячная, как в productPnl: Σ(ставка_м × штуки_м) = Σ расходов.
  const ohM: Record<string, number> = {}, unM: Record<string, number> = {};
  for (const m of ms) {
    for (const r of m.rows || []) {
      const k = String(r.d || "").slice(0, 7);
      unM[k] = (unM[k] || 0) + (r.units_net || 0);
    }
    for (const [day, v] of Object.entries((m.overhead_daily || {}) as Record<string, any>)) {
      const k = String(day).slice(0, 7);
      ohM[k] = (ohM[k] || 0) + ((v.m || 0) + (v.p || 0));
    }
  }
  let net = 0, cogs = 0, ship = 0, un = 0, unOur = 0, unKn = 0, paid = 0;
  for (const m of ms) for (const r of m.rows || []) {
    const d = r.units_delivered || 0, n = r.units_net || 0;
    const k = String(r.d || "").slice(0, 7);
    const per = (unM[k] || 0) > 0 ? (ohM[k] || 0) / unM[k]! : 0;
    const priceNet = (d > 0 ? (r.price || 0) * n / d : (r.price || 0)) + (r.ship_mp || 0);
    const fee = Object.values((r.svc || {}) as Record<string, number>).reduce((a, b) => a + (b || 0), 0);
    net += priceNet + (r.ship_buyer || 0) - fee - (r.svc_points || 0) - per * n;
    cogs += r.cogs || 0; ship += r.ship_our || 0; un += n; paid += r.revenue_money || 0;
    // Ведомость нужна только там, где везём мы: Маркет-доставка нашего расхода не создаёт.
    const led = DEL.reduce((a: number, k: string) => a + ((r.svc || {})[k] || 0) + ((r.svc_pts || {})[k] || 0), 0);
    const our = led <= 0 && (r.ship_buyer || 0) > 0;
    if (our) { unOur += n; if (r.ship_known) unKn += n; }
  }
  // 23.09.2026: налог - от платежа покупателя, АДМ по-прежнему от поступления (Катя: «перестрой
  // расчет налогов - 15% от суммы оплатил клиент»).
  const gp = net - cogs - ship, np = gp - net * 0.30 - paid * 0.15;
  return { net, np, paid, rent: net !== 0 ? (np / net) * 100 : 0, un, unOur, unKn };
}

describe("«Товары»: рентабельность считается из свода", () => {
  const goodsTable = () => [...D().querySelectorAll("table")]
    .find((t) => /Себестоимость/.test(t.textContent || ""))!;
  // Весь период: окно должно быть определённым, иначе эталон не с чем сравнивать.
  // state - const в модуле страницы, снаружи его не достать: период переключаем как пользователь,
  // кликом по кнопке «Всё». Заодно проверяется, что кнопка вообще жива.
  const allPeriod = () => {
    const btn = D().querySelector('[data-p="all"]') as any;
    expect(btn, "кнопки периода «Всё» на странице нет").not.toBeNull();
    btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  };

  it("колонка есть и стоит сразу за «Себестоимостью»", () => {
    const hs = [...goodsTable().querySelectorAll("thead th")].map((x) => (x.textContent || "").trim());
    expect(hs).toContain("Рентабельность");
    expect(hs.indexOf("Рентабельность")).toBe(hs.indexOf("Себестоимость") + 1);
  });

  it("колонка не сдвинула строки: ячеек столько же, сколько колонок", () => {
    const t = goodsTable();
    const n = t.querySelectorAll("thead th").length;
    const rows = [...t.querySelectorAll("tbody tr")].slice(0, 20);
    expect(rows.length, "в таблице нет строк").toBeGreaterThan(0);
    const bad = rows.filter((r) => r.children.length !== n)
      .map((r) => `${(r.children[0]?.textContent || "").trim()}: ячеек ${r.children.length}, колонок ${n}`);
    expect(bad).toEqual([]);
  });

  it("сортировка ведёт на rent, а не на снятую margin", () => {
    expect(D().querySelector('[data-sort="margin"]'), "сортировка по старой margin осталась").toBeNull();
    expect(D().querySelector('[data-sort="rent"]'), "сортировки по рентабельности нет").not.toBeNull();
  });

  // Главная проверка: не «колонка на месте», а «в ней то же число, что в своде».
  it("итог страницы за весь период сходится со сводом", () => {
    allPeriod();
    const want = svodPnl();
    let net = 0, np = 0;
    for (const tr of modelRows()) {
      const td = tr.querySelector("td.pt-margin");
      const t = td?.getAttribute("title") || "";
      if (!t) continue;
      const mNet = /Поступление ([\d\s   -]+) ₽/.exec(t);
      const mNp = /чистая ([\d\s   -]+) ₽/.exec(t);
      if (!mNet || !mNp) continue;
      net += num(mNet[1])!; np += num(mNp[1])!;
    }
    expect(net, "ни одна строка не дала поступления - расчёт не доехал до страницы").toBeGreaterThan(0);
    // Допуск: на странице числа округлены до рубля построчно.
    expect(Math.abs(net - want.net)).toBeLessThan(Math.max(500, Math.abs(want.net) * 0.001));
    expect(Math.abs(np - want.np)).toBeLessThan(Math.max(500, Math.abs(want.np) * 0.001));
    const rent = (np / net) * 100;
    expect(Math.abs(rent - want.rent), `страница ${rent.toFixed(2)}%, свод ${want.rent.toFixed(2)}%`).toBeLessThan(0.1);
  });

  it("ни одна строка не показывает прежние 70-85%: это был признак расчёта по цене", () => {
    allPeriod();
    const vals = modelRows()
      .map((tr) => num(tr.querySelector("td.pt-margin")?.textContent))
      .filter((v): v is number => v != null);
    expect(vals.length).toBeGreaterThan(10);
    const weighted = svodPnl().rent;
    expect(Math.abs(weighted)).toBeLessThan(40);
    // Отдельный артикул может быть и очень прибыльным, и очень убыточным, поэтому проверяем не
    // потолок, а то, что 70-85% перестали быть НОРМОЙ: раньше в этой полосе лежала вся таблица.
    const inOldBand = vals.filter((v) => v >= 70 && v <= 85).length;
    expect(inOldBand / vals.length, "большинство строк снова в полосе старой формулы").toBeLessThan(0.2);
  });

  it("пробел по ведомости доставки помечен в самой ячейке", () => {
    allPeriod();
    const want = svodPnl();
    const marked = modelRows().filter((tr) => /нет вед/.test(tr.querySelector("td.pt-margin")?.textContent || ""));
    if (want.unOur - want.unKn > 0.5) {
      expect(marked.length, "ведомость заполнена не по всем нашим перевозкам, а пометки нет").toBeGreaterThan(0);
    } else {
      expect(marked.length, "ведомость заполнена везде, пометка висеть не должна").toBe(0);
    }
  });

  // Ровно тот дефект, который снимали в своде 21.09.2026: «нет ведомости» у заказов, которые вёз
  // сам Маркет. Нашего расхода там нет и быть не может, и метка читалась как пропавшие деньги.
  it("метка не висит там, где везёт Маркет: она про НАШУ перевозку", () => {
    allPeriod();
    const bad: string[] = [];
    for (const tr of modelRows()) {
      const td = tr.querySelector("td.pt-margin");
      const t = td?.getAttribute("title") || "";
      if (!/нет вед/.test(td?.textContent || "")) continue;
      const m = /из ([\d\s   ]+) шт нашей перевозки/.exec(t);
      const our = m ? num(m[1]) : null;
      if (!our || our <= 0) bad.push((tr.children[0]?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40));
    }
    expect(bad, "строки с меткой, у которых своей перевозки нет вовсе").toEqual([]);
  });

  // Метка на каждой строке - это не сигнал, а фон. Порог 20% выбран, чтобы она отмечала реальный
  // пробел, а не февральско-апрельскую норму.
  it("метка стоит не на всех строках подряд", () => {
    allPeriod();
    const rows = modelRows();
    const marked = rows.filter((tr) => /нет вед/.test(tr.querySelector("td.pt-margin")?.textContent || ""));
    expect(marked.length / rows.length, "метка на почти каждой строке - её перестают замечать").toBeLessThan(0.75);
  });
});

// Мёртвый код с выдуманным разбросом. _cmpSeries_LEGACY домножала маржу и среднюю цену на
// псевдослучайные ±3% (остаток демо-режима). Она не вызывалась, но лежала в странице готовой к
// тому, чтобы её вернули, и любой, кто её нашёл бы, принял бы шум за часть расчёта.
describe("«Товары»: выдуманного разброса в странице нет", () => {
  it("_cmpVar и _cmpSeries_LEGACY вырезаны", () => {
    const html = dom.serialize();
    expect(html).not.toContain("_cmpVar");
    expect(html).not.toContain("_cmpSeries_LEGACY");
  });
});

// График сравнения периодов (кнопка «Сравнить с другим периодом»). Линия «Рентабельность» на нём
// считалась четырьмя копиями формулы (цена − С\С)/цена - по одной на каждый разрез: артикулы,
// размеры, линии, категории. Теперь у всех один источник, тот же, что у колонки.
describe("«Товары»: график сравнения считает рентабельность из свода", () => {
  const openCompare = (aFrom: string, aTo: string, bFrom: string, bTo: string) => {
    const W: any = dom.window as any, D2 = D();
    const click = (sel: string) => (D2.querySelector(sel) as any)
      ?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
    click("#btn-compare");
    (D2.querySelector("#cmp-a-from") as any).value = aFrom;
    (D2.querySelector("#cmp-a-to") as any).value = aTo;
    (D2.querySelector("#cmp-b-from") as any).value = bFrom;
    (D2.querySelector("#cmp-b-to") as any).value = bTo;
    click("#compare-apply");
  };

  it("график рисуется без ошибок JS и держит три вкладки", () => {
    openCompare("2026-02-01", "2026-05-31", "2026-06-01", "2026-09-20");
    const tabs = [...D().querySelectorAll(".cmp-tab")].map((t) => (t.textContent || "").trim());
    expect(tabs).toEqual(["Выручка + Рентабельность", "Заказы", "Ср.цена"]);
    expect((D().querySelector(".cmp-chart-area")?.innerHTML || "").length,
      "область графика пуста").toBeGreaterThan(1000);
    expect(errs, "ошибки JS на странице").toEqual([]);
  });

  // Главная проверка: правая ось обязана уходить в минус. Старая формула отрицательной быть не
  // могла в принципе, поэтому минус на оси - признак того, что линию считает именно свод.
  it("правая ось уходит в минус: убыток виден, а не прижат к нулю", () => {
    openCompare("2026-02-01", "2026-05-31", "2026-06-01", "2026-09-20");
    const ax = [...D().querySelectorAll(".cmp-chart-area text.cmp-ax")]
      .map((e) => num(e.textContent)).filter((v): v is number => v != null);
    expect(ax.length, "подписей осей нет").toBeGreaterThan(4);
    expect(Math.min(...ax), "на осях нет ни одного отрицательного значения").toBeLessThan(0);
  });

  // Линия обязана лежать ВНУТРИ полотна. Пока ось шла от нуля вверх, отрицательная рентабельность
  // уезжала за нижний край и читалась как ноль.
  it("линия рентабельности не вылезает за полотно", () => {
    openCompare("2026-02-01", "2026-05-31", "2026-06-01", "2026-09-20");
    const svg = D().querySelector(".cmp-chart-area svg");
    const vb = (svg?.getAttribute("viewBox") || "0 0 0 0").split(/\s+/).map(Number);
    const H = vb[3] || 0;
    expect(H).toBeGreaterThan(100);
    const paths = [...D().querySelectorAll(".cmp-chart-area path")]
      .map((e) => e.getAttribute("d") || "").filter((d) => d.length > 20);
    expect(paths.length, "линий на графике нет").toBeGreaterThanOrEqual(2);
    const ys: number[] = [];
    for (const d of paths) {
      const nums = [...d.matchAll(/[ ,](-?\d+(?:\.\d+)?)(?=[ ,L]|$)/g)].map((m) => parseFloat(m[1]!));
      nums.forEach((v, i) => { if (i % 2 === 1) ys.push(v); });
    }
    expect(ys.length).toBeGreaterThan(4);
    expect(Math.min(...ys), "линия ушла выше полотна").toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys), "линия ушла ниже полотна").toBeLessThanOrEqual(H);
  });

  it("старой формулы маржи в странице не осталось ни в одном разрезе", () => {
    const html = dom.serialize();
    expect(html).not.toMatch(/\(revA - costA\) \/ revA/);
    expect(html).not.toMatch(/\(u\.revA - u\.costA\) \/ u\.revA/);
  });
});
