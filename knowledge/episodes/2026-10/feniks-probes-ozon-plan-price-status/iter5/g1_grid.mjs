// ФЕНИКС iter5 (381f11d5). G1 строго, по картинке, а не по атрибуту: функции dm, fmt, stOf, gauge, pg и палитра C вырезаны
// из plan-tab.client.js как есть и исполнены в node:vm. Планы - живые числа v7 (карточки 10/день, магазин и оборот - приращение
// пути цели «средне», реклама 47 815,4/день, округление как в gp() сервера). Для каждого дня данных периода n = 1..17 и плотной
// сетки факта (плюс точные границы 70/100/120% плана на дату) из SVG берутся нарисованные дуги (path stroke-width 16) и угол
// стрелки (line stroke-width 3.5). Классы: IN - стрелка внутри нарисованной дуги; GAP - между дугами; ZERO - дуга нулевой длины.
// Сравнение: цвет дуги под стрелкой (или ближайшей при GAP) против цвета статуса (span в g-l2), и data-zone против data-st.
// node g1_grid.mjs <plan-tab.client.js> [метка]      (VERB=1 - все примеры)
import { readFileSync } from "node:fs";
import vm from "node:vm";
const [file, tag = ""] = process.argv.slice(2);
const src = readFileSync(file, "utf-8");
function grab(name) {   // текст function name(...){...} по балансу скобок
  const i = src.indexOf("function " + name + "(");
  if (i < 0) throw new Error("нет функции " + name);
  let j = src.indexOf("{", i), d = 0;
  for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error("скобки " + name);
}
const cdef = src.match(/var C=\{[^}]*\};/)[0];
const code = [cdef, ...["dm", "fmt", "stOf", "gauge", "pg"].map(grab)].join("\n") + "\nthis.pg=pg;this.C=C;";
const ctx = {}; vm.createContext(ctx); vm.runInContext(code, ctx);
const NAME = { "#34d399": "зел", "#e5b567": "жёлт", "#ff7a7e": "красн", "#8b9eae": "сер", "#3a4654": "нет" };
const nm = (c) => NAME[(c || "").toLowerCase()] ?? (c || "-");
const cx = 120, cy = 112, MAX = 150, PXPCT = 82 * Math.PI / MAX;   // 1% шкалы = 1,717 ед. дуги радиуса 82 (viewBox 240)
const pctOf = (x, y) => (1 - Math.atan2(cy - y, x - cx) / Math.PI) * MAX;
const r = (x, nd) => Math.round(x * 10 ** nd) / 10 ** nd;
// живые планы v7
const lo = 300, mid = 355, tlo = 20.9, tmid = 24.2, RATE = (283110 + 51598) / 7;
const gpath = (L, M, d) => L / 31 * d + (M - L) * Math.max(0, Math.min(15, d - 16)) / 15;
const days = Array.from({ length: 17 }, (_, i) => 15 + i);
const KIND = {
  cards: { title: "Заказы 10 карточек", nd: 1, unit: "", div: 1, hiBad: false, day: () => 10, step: 1 },
  store: { title: "Заказы магазина", nd: 1, unit: "", div: 1, hiBad: false, day: (d) => gpath(lo, mid, d) - gpath(lo, mid, d - 1), step: 1 },
  turn: { title: "Оборот магазина", nd: 2, unit: " млн", div: 1, hiBad: false, day: (d) => gpath(tlo, tmid, d) - gpath(tlo, tmid, d - 1), step: 0.01 },
  ads: { title: "Реклама, все клики", nd: 0, unit: " тыс. ₽", div: 1e3, hiBad: true, day: () => RATE, step: null },
};
const tot = {}; const ex = [], exA = [], exG = [];
const firstDays = {};
for (const [kind, K] of Object.entries(KIND)) {
  const plan = r(days.reduce((t, d) => t + K.day(d), 0), K.nd);
  const T = tot[kind] = { states: 0, attr_mis: 0, in_mis: 0, gap: 0, gap_mis: 0, gap_no_status_arc: 0, days_zero: [], boundary_mis: 0, gap_by_n: {}, gapmis_by_n: {} };
  for (let n = 1; n <= 17; n++) {
    const last = `2026-10-${15 + n - 1}`;
    const ptd = r(days.slice(0, n).reduce((t, d) => t + K.day(d), 0), K.nd);
    const facts = new Set();
    if (K.step) { for (let f = 0; f <= 2 * ptd + 1e-9; f += K.step * Math.max(1, Math.round(ptd / 400 / K.step))) facts.add(r(f, K.nd)); }
    else { for (let q = 0; q <= 800; q++) facts.add(Math.round(ptd * q / 400)); }
    const bnd = [];   // точные границы статуса и соседи
    for (const b of K.hiBad ? [1, 1.2] : [0.7, 1]) for (const dlt of [-1, 0, 1]) { const f = r(ptd * b + dlt * (K.step ?? 1), K.nd); facts.add(f); bnd.push(f); }
    let dayZero = 0, ypx = null;
    for (const f of [...facts].sort((a, b) => a - b)) {
      if (f < 0) continue;
      const g = { fact: f, plan, plan_td: ptd, from: "2026-10-15", to: "2026-10-31", last, ref: null };
      const html = ctx.pg(K.title, g, K.unit, K.nd === 2 ? 1 : 0, K.div, K.hiBad);
      const zone = (html.match(/data-zone="([^"]*)"/) ?? [])[1], st = (html.match(/data-st="([^"]*)"/) ?? [])[1];
      const scol = (html.match(/<span style="color:([^"]+)">/) ?? [])[1] ?? "";
      const stt = (html.match(/<span style="color:[^"]+">([^<]+)</) ?? [])[1] ?? "";
      const arcs = [...html.matchAll(/<path d="M([\d.e-]+) ([\d.e-]+) A[\d.]+ [\d.]+ 0 0 1 ([\d.e-]+) ([\d.e-]+)" stroke="([^"]+)" stroke-width="16"/g)]
        .map((m) => ({ a: pctOf(+m[1], +m[2]), b: pctOf(+m[3], +m[4]), col: m[5] }));
      const nl = html.match(/<line x1="120" y1="112" x2="([\d.e-]+)" y2="([\d.e-]+)" stroke="#e8eef2" stroke-width="3.5"/);
      if (!nl || !scol) continue;
      const np = pctOf(+nl[1], +nl[2]);
      const vis = arcs.filter((z) => z.b - z.a > 1e-6), zero = arcs.length - vis.length;
      if (zero) dayZero = Math.max(dayZero, zero);
      const yl = arcs.find((z) => z.col === ctx.C.mid); if (ypx == null && yl) ypx = Math.round((yl.b - yl.a) * PXPCT * 100) / 100;
      T.states++;
      const isB = bnd.includes(f);
      if (zone !== st) { T.attr_mis++; exA.push(`${tag} ${kind} n=${n} факт ${f} план на дату ${ptd}${isB ? " (граница)" : ""} | стрелка ${np.toFixed(4)}% | статус «${stt}» ${nm(scol)} | data-zone ${nm(zone)}, data-st ${nm(st)}`); }
      const inArc = vis.find((z) => np >= z.a && np <= z.b);
      if (inArc) {
        if (inArc.col !== scol) { T.in_mis++; if (isB) T.boundary_mis++; if (ex.length < 40) ex.push(`${tag} ${kind} n=${n} факт ${f} план на дату ${ptd} | стрелка ${np.toFixed(2)}% в дуге ${nm(inArc.col)} | статус «${stt}» ${nm(scol)} | data-zone ${nm(zone)}`); }
      } else {
        T.gap++; T.gap_by_n[n] = (T.gap_by_n[n] ?? 0) + 1;
        const near = vis.map((z) => ({ z, d: Math.min(Math.abs(np - z.a), Math.abs(np - z.b)) })).sort((x, y) => x.d - y.d)[0];
        const stArc = vis.filter((z) => z.col === scol).map((z) => Math.min(Math.abs(np - z.a), Math.abs(np - z.b)))[0];
        if (!near || near.z.col !== scol) {
          T.gap_mis++; T.gapmis_by_n[n] = (T.gapmis_by_n[n] ?? 0) + 1;
          if (exG.length < 14 && n > 1) exG.push(`${tag} ${kind} n=${n} факт ${f} план на дату ${ptd} | стрелка ${np.toFixed(2)}% в промежутке, ближе ${nm(near?.z.col)} (${near?.d.toFixed(2)} п. = ${(near?.d * PXPCT).toFixed(1)} ед.) | статус «${stt}» ${nm(scol)}, его дуга в ${stArc == null ? "-" : (stArc * PXPCT).toFixed(1)} ед.`);
        }
        if (stArc == null) { T.gap_no_status_arc++; if (ex.length < 40 && n <= 2) ex.push(`${tag} ${kind} n=${n} факт ${f} план на дату ${ptd} | стрелка ${np.toFixed(2)}% в промежутке, дуги цвета статуса нет (нулевая) | статус «${stt}» ${nm(scol)} | data-zone ${nm(zone)}`); }
      }
    }
    if (dayZero) T.days_zero.push(n);
    if (n <= 3) (firstDays[kind] ??= []).push(`n=${n}: метка ${(ptd / plan * 100).toFixed(2)}%, жёлтая ${ypx} ед.`);
  }
}
console.log(`== ${tag} ${file}`);
for (const [k, T] of Object.entries(tot)) console.log(`${k.padEnd(5)} состояний ${T.states} | data-zone != data-st ${T.attr_mis} | стрелка в дуге чужого цвета ${T.in_mis} (на границе ${T.boundary_mis}) | в промежутке ${T.gap}, ближайшая дуга не цвета статуса ${T.gap_mis}, дуги цвета статуса нет ${T.gap_no_status_arc} | дни с дугой нулевой длины ${JSON.stringify(T.days_zero)} | ${firstDays[k].join("; ")}`);
for (const [k, T] of Object.entries(tot)) console.log(`  ${k}: в промежутке по дням ${JSON.stringify(T.gap_by_n)}; из них ближайшая чужого цвета ${JSON.stringify(T.gapmis_by_n)}`);
const VERB = process.env.VERB === "1";
for (const e of VERB ? ex : ex.slice(0, 4)) console.log("  ", e);
console.log("  data-zone != data-st:"); for (const e of exA) console.log("    ", e);
console.log("  промежуток, ближайшая дуга чужого цвета (n>1):"); for (const e of exG) console.log("    ", e);
const S = Object.values(tot).reduce((a, T) => ({ attr: a.attr + T.attr_mis, inm: a.inm + T.in_mis, nost: a.nost + T.gap_no_status_arc }), { attr: 0, inm: 0, nost: 0 });
console.log(`ИТОГ ${tag}: data-zone != data-st ${S.attr}; стрелка в дуге чужого цвета ${S.inm}; стрелка без дуги цвета статуса (нулевая дуга) ${S.nost}`);
