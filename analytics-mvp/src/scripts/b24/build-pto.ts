// @ts-nocheck
// Дашборд ПТО: все запуски стадии «Расчёт» в воронке C49 и что с ними стало.
//
// Вопрос, ради которого собрано: правда ли, что к концу месяца сделок передают
// в расчёт больше. Страница отвечает на него не мнением, а распределением по дням
// месяца, нормированным на рабочие дни, плюс перестановочный тест.
//
// Источник: rop.json из ветки rop-dashboard-v1 (тот же снимок, что и РОП-дашборд).
// Запуск: ROP_JSON=/путь/rop.json npx tsx src/scripts/b24/build-pto.ts
import { readFileSync, writeFileSync } from "node:fs";

const ROP = process.env.ROP_JSON || "../rop.json";
const TPL = "pto/pto.template.html";
const OUT = "public/pto-command.html";

// Стадия «Расчёт» воронки «GG RF Заказы» (категория 49).
const CALC = "C49:UC_OGZUU0";
// Март 2026 - месяц переезда из amoCRM: 20k+ сделок перенесли пачкой на те же стадии,
// даты переходов у них искусственные. В статистику не берём (решение Ивана 2026-09-22).
const FROM = "2026-04-01";

const rop = JSON.parse(readFileSync(ROP, "utf-8"));
const ST: Record<string, string> = rop.refs.dealStages;

const deals = rop.deals.filter((d: any) => String(d.category) === "49");

// В истории встречаются коды стадий, которых уже нет в воронке: их удалили из Bitrix,
// а переходы в карточках остались. Показывать сырой код пользователю нельзя, выдумывать
// название тоже. Подписываем как удалённую стадию и даём срок её жизни по данным.
const gone: Record<string, { first: string; last: string; n: number }> = {};
for (const d of deals) for (const [c, t] of (d.hist || []) as [string, string][]) {
  if (ST[c]) continue;
  const day = String(t).slice(0, 10);
  const g = (gone[c] ||= { first: day, last: day, n: 0 });
  g.n++; if (day < g.first) g.first = day; if (day > g.last) g.last = day;
}
const ru = (s: string) => s.split("-").reverse().join(".");
const nameOf = (c: string | null) => {
  if (!c) return "";
  if (ST[c]) return ST[c];
  const g = gone[c];
  return g ? `удалённая стадия (была ${ru(g.first)} - ${ru(g.last)})` : c;
};
const byId: Record<string, any> = {};
for (const d of deals) byId[d.id] = d;

type Run = {
  d: string; id: string; title: string; mgr: string; budget: number;
  dir: string; assort: string; from: string; to: string; days: number | null;
  cur: string; out: "won" | "lost" | "open";
};
const runs: Run[] = [];
let noHist = 0;
for (const d of deals) {
  const h: [string, string][] = d.hist || [];
  if (!h.length) { noHist++; continue; }
  h.forEach(([code, ts], i) => {
    if (code !== CALC) return;
    const day = String(ts).slice(0, 10);
    if (day < FROM) return;
    const nx = h[i + 1];
    const days = nx ? Math.round((Date.parse(nx[1].slice(0, 10)) - Date.parse(day)) / 864e5) : null;
    runs.push({
      d: day, id: String(d.id), title: d.title || "", mgr: d.mgr || "не указан",
      budget: Number(d.budget) || 0, dir: d.dir || "", assort: d.assort || "",
      from: nameOf(h[i - 1] ? h[i - 1][0] : null), to: nameOf(nx ? nx[0] : null), days,
      cur: d.stage || "", out: d.won ? "won" : d.lost ? "lost" : "open",
    });
  });
}
runs.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));

// --- календарь рабочих дней -------------------------------------------------
// Рабочий день = пн-пт. Производственный календарь РФ с праздниками не заводим:
// он сместил бы 8-10 дней за полгода, а вывод строится на отношении декад, где
// такой сдвиг тонет. Помечено как допущение в самой странице.
const isWd = (s: string) => { const w = new Date(s + "T00:00:00Z").getUTCDay(); return w >= 1 && w <= 5; };
const daysInMonth = (m: string) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
const dayStr = (m: string, day: number) => `${m}-${String(day).padStart(2, "0")}`;

const months = Array.from(new Set(runs.map(r => r.d.slice(0, 7)))).sort();
// Последний месяц снимка не закрыт, значит его конец ещё не наблюдался.
// Включать его в проверку «конца месяца» нельзя: это занизит хвост.
const today = String(rop.generated_at || "").slice(0, 10);
const openMonth = today.slice(0, 7);
const closedMonths = months.filter(m => m < openMonth);

function last5wd(m: string): string[] {
  const out: string[] = [];
  for (let day = daysInMonth(m); day >= 1 && out.length < 5; day--) {
    const s = dayStr(m, day); if (isWd(s)) out.push(s);
  }
  return out;
}

// Календарь: по каждому месяцу счётчик на каждый день.
const cal = months.map(m => {
  const n = daysInMonth(m);
  const cnt: number[] = Array(n + 1).fill(0);
  const rub: number[] = Array(n + 1).fill(0);
  for (const r of runs) if (r.d.slice(0, 7) === m) { const dd = +r.d.slice(8, 10); cnt[dd]++; rub[dd] += r.budget; }
  const L = new Set(last5wd(m));
  return {
    m, n, cnt: cnt.slice(1), rub: rub.slice(1),
    wd: Array.from({ length: n }, (_, i) => isWd(dayStr(m, i + 1))),
    last5: Array.from({ length: n }, (_, i) => L.has(dayStr(m, i + 1))),
    partial: m === openMonth ? +today.slice(8, 10) : 0,
  };
});

// Декады, нормированные на рабочий день. Незакрытый месяц считаем отдельно и
// в сводную строку не берём.
function decades(ms: string[]) {
  const cnt = [0, 0, 0], wd = [0, 0, 0];
  for (const m of ms) {
    const n = daysInMonth(m);
    for (let day = 1; day <= n; day++) {
      const i = day <= 10 ? 0 : day <= 20 ? 1 : 2;
      if (isWd(dayStr(m, day))) wd[i]++;
    }
    for (const r of runs) if (r.d.slice(0, 7) === m) { const day = +r.d.slice(8, 10); cnt[day <= 10 ? 0 : day <= 20 ? 1 : 2]++; }
  }
  return [0, 1, 2].map(i => ({ n: cnt[i], wd: wd[i], perDay: wd[i] ? cnt[i] / wd[i] : 0 }));
}
const decAll = decades(closedMonths);
const decByMonth = months.map(m => ({ m, dec: decades([m]), closed: closedMonths.includes(m) }));

// Хвост месяца: последние 5 рабочих дней против остальных рабочих дней.
const Lall = new Set(closedMonths.flatMap(last5wd));
const wdAll: string[] = [];
for (const m of closedMonths) for (let day = 1; day <= daysInMonth(m); day++) { const s = dayStr(m, day); if (isWd(s)) wdAll.push(s); }
const inL = runs.filter(r => Lall.has(r.d)).length;
const outL = runs.filter(r => !Lall.has(r.d) && isWd(r.d) && closedMonths.includes(r.d.slice(0, 7))).length;
const nL = Lall.size, nO = wdAll.length - nL;
const rateL = nL ? inL / nL : 0, rateO = nO ? outL / nO : 0;

// Перестановочный тест: раскидываем то же число запусков случайно по рабочим дням
// периода и смотрим, как часто в хвост попадает не меньше, чем на самом деле.
// Детерминированный ГПСЧ, чтобы сборка была воспроизводимой.
// mulberry32: 32-битная арифметика через Math.imul. Наивный LCG здесь использовать нельзя -
// произведение seed*1103515245 выходит за 2^53 и double теряет младшие биты, отчего тест
// давал p=0.018 вместо 0.062 (сверено с независимым прогоном на Python).
let seed = 20260924 >>> 0;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const R = 20000, N = inL + outL;
let ge = 0;
for (let k = 0; k < R; k++) {
  let s = 0;
  for (let j = 0; j < N; j++) if (Lall.has(wdAll[Math.floor(rnd() * wdAll.length)])) s++;
  if (s >= inL) ge++;
}
const pTail = ge / R;

// Куда уходят из Расчёта и где стоят сейчас.
const tally = (key: (r: Run) => string) => {
  const m: Record<string, { n: number; rub: number }> = {};
  for (const r of runs) { const k = key(r) || "(не указано)"; (m[k] ||= { n: 0, rub: 0 }); m[k].n++; m[k].rub += r.budget; }
  return Object.entries(m).map(([k, v]) => ({ k, ...v })).sort((a, b) => b.n - a.n);
};
const uniq = new Set(runs.map(r => r.id));
const dwell = runs.filter(r => r.days != null).map(r => r.days as number).sort((a, b) => a - b);
const q = (p: number) => (dwell.length ? dwell[Math.min(dwell.length - 1, Math.floor(dwell.length * p))] : 0);

const DATA = {
  bakedAt: new Date().toISOString(),
  snapshot: rop.generated_at, today, from: FROM,
  runs, cal, months, closedMonths, openMonth,
  decAll, decByMonth,
  tail: { inL, outL, nL, nO, rateL, rateO, ratio: rateO ? rateL / rateO : 0, p: pTail, rounds: R },
  totals: {
    runs: runs.length, deals: uniq.size,
    repeat: runs.length - uniq.size,
    // Сумма по УНИКАЛЬНЫМ сделкам: 115 сделок заходили в расчёт повторно, и суммирование
    // по запускам задвоило бы их бюджет.
    rub: [...uniq].reduce((s, id) => s + (Number(byId[id].budget) || 0), 0),
    noHist,
    dwellMed: q(0.5), dwellP75: q(0.75), dwellP90: q(0.9),
    stuck: runs.filter(r => r.days == null).length,
  },
  toStage: tally(r => r.to || "(перехода ещё не было)"),
  fromStage: tally(r => r.from || "(создана сразу здесь)"),
  curStage: (() => {
    const m: Record<string, { n: number; rub: number }> = {};
    for (const id of uniq) { const d = byId[id]; const k = d.stage || "(нет)"; (m[k] ||= { n: 0, rub: 0 }); m[k].n++; m[k].rub += Number(d.budget) || 0; }
    return Object.entries(m).map(([k, v]) => ({ k, ...v })).sort((a, b) => b.n - a.n);
  })(),
  mgrs: tally(r => r.mgr),
  gone: Object.entries(gone).map(([c, g]) => ({ c, ...g })).sort((a, b) => b.n - a.n),
};

const html = readFileSync(TPL, "utf-8").replace("__PTO_DATA__", JSON.stringify(DATA));
writeFileSync(OUT, html);
console.log(`-> ${OUT} (${(html.length / 1024).toFixed(0)} КБ) · запусков ${runs.length}, сделок ${uniq.size}, месяцев ${months.length}`);
console.log(`   хвост месяца: ${rateL.toFixed(2)}/дн против ${rateO.toFixed(2)}/дн, отношение ${(rateL / rateO).toFixed(2)}x, p=${pTail.toFixed(4)}`);
