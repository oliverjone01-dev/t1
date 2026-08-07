#!/usr/bin/env node
// Kostya-AI: дайджест дня из результата kostya-audit.mjs.
//
// Запуск:
//   node kostya-digest.mjs kostya.json > digest.md
// Опции:
//   --top N             сколько косяков показывать на менеджера (default 5)
//   --prev prev.json    вчерашний результат, чтобы посчитать дельту и раздел «стало лучше»
//   --mgr "Имя"         дайджест по одному менеджеру
//   --format md|json    формат вывода (default md)

import { readFileSync } from "node:fs";

const VALUE_OPTS = new Set(["--top", "--prev", "--mgr", "--format"]);
const argv = process.argv.slice(2);
const opts = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUE_OPTS.has(a)) { opts[a] = argv[++i]; continue; }
  if (a.startsWith("--")) { console.error(`Неизвестная опция: ${a}`); process.exit(1); }
  positional.push(a);
}
const src = positional[0];
if (!src) {
  console.error("Нужен путь к результату kostya-audit. Пример: node kostya-digest.mjs kostya.json > digest.md");
  process.exit(1);
}

const A = JSON.parse(readFileSync(src, "utf8"));
const TOP = Number(opts["--top"] || 5);
const onlyMgr = opts["--mgr"];
const prev = opts["--prev"] ? JSON.parse(readFileSync(opts["--prev"], "utf8")) : null;

const CODE_NAME = {
  D01: "ЗАВИС НА СТАДИИ", D02: "ТИШИНА", D03: "ПРОСРОЧЕНО ДЕЛО",
  D04: "БЕЗ СЛЕДУЮЩЕГО ШАГА", D05: "РЕШЕНИЕ БЕЗ ДАТЫ", D06: "ОТКАЗ БЕЗ ПРИЧИНЫ",
  D07: "БЮДЖЕТ НОЛЬ", D08: "СТАДИЯ НЕ АКТУАЛЬНА", D09: "РЕГРЕСС СТАДИИ",
  D10: "ПУСТЫЕ КЛАССИФИКАТОРЫ", D11: "ДОЛГОСТРОЙ БЕЗ ДВИЖЕНИЯ", D12: "СВАЛКА",
  D13: "БЕЗ ДАТЫ СЛЕДУЮЩЕГО КОНТАКТА", D14: "СНИМОК ПРОТУХ",
};
// Дефекты, которые чинит не менеджер, а РОП или интегратор: невнедрённое ТЗ, справочники.
const SYSTEMIC = new Set(["D10", "D13"]);

const money = (n) => (Number(n) || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";
const sevMark = { crit: "!!!", high: "!!", med: "!", low: "." };
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));

const managers = A.managers.filter((m) => m.openDeals > 0 && (!onlyMgr || m.mgr === onlyMgr));
const flags = A.flags.filter((f) => !onlyMgr || f.mgr === onlyMgr);
const prevIdx = {};
if (prev) for (const m of prev.managers || []) prevIdx[m.mgr] = m.index;

const band = (b) => managers.filter((m) => m.band === b);
const fmtMgr = (m) => {
  const p = prevIdx[m.mgr];
  const delta = p == null || m.index == null ? "" :
    ` (${m.index > p ? "+" : ""}${Math.round((m.index - p) * 10) / 10} ко вчера)`;
  return `${m.mgr} ${m.index}/10${delta}, сделок ${m.openDeals}`;
};

const L = [];
const p = (s = "") => L.push(s);

// --- Шапка ---
p(`# Разбор дня ${A.meta.audit_date}`);
p();
if (A.meta.snapshot_stale) {
  p(`> **[D14 СНИМОК ПРОТУХ]** Снимку Bitrix ${A.meta.snapshot_age_hours} ч. (порог 36 ч.). ` +
    `Разбор ведётся на устаревших данных: проверить workflow \`b24-snapshots.yml\`.`);
  p();
}
p(`Снимок Bitrix: ${A.meta.snapshot_at} (${A.meta.snapshot_age_hours} ч. назад). ` +
  `Открытых сделок ${A.totals.openDeals} на ${money(A.totals.openBudget)}. ` +
  `Флагов ${A.totals.flags}: критичных ${A.totals.bySeverity.crit || 0}, ` +
  `высоких ${A.totals.bySeverity.high || 0}, средних ${A.totals.bySeverity.med || 0}, ` +
  `низких ${A.totals.bySeverity.low || 0}.`);
p();

// --- Светофор ---
p("## Светофор");
p();
const molodec = band("молодец"), norma = band("норма"), holodec = band("холодец"), few = band("мало данных");
p(`**Молодец** (индекс от 7.5): ${molodec.length ? molodec.map(fmtMgr).join("; ") : "никого"}`);
p();
p(`**Норма** (5.0-7.4): ${norma.length ? norma.map(fmtMgr).join("; ") : "никого"}`);
p();
p(`**Холодец** (ниже 5.0): ${holodec.length ? holodec.map(fmtMgr).join("; ") : "никого"}`);
p();
if (few.length) {
  p(`**Мало данных** (меньше ${A.meta.thresholds.minSample} открытых сделок, индекс не считаем): ` +
    few.map((m) => `${m.mgr} (${m.openDeals})`).join(", "));
  p();
}
if (!molodec.length && managers.length) {
  const best = managers.filter((m) => m.band !== "мало данных")[0];
  if (best) p(`Порог «молодец» сегодня не взял никто. Лучший результат: ${best.mgr}, ${best.index}/10.`);
  p();
}

// --- Системная картина ---
p("## Системная картина отдела");
p();
const dept = [];
const c = A.totals.byCode;
if (c.D01) dept.push(`${c.D01} сделок зависли на стадии дольше лимита`);
if (c.D02) dept.push(`${c.D02} сделок без активности дольше лимита`);
if (c.D03) dept.push(`${c.D03} просроченных дел`);
if (c.D05) dept.push(`${c.D05} сделок на «Принимают решение» без согласованной даты`);
if (c.D10) dept.push(`${c.D10} сделок без направления или ассортимента`);
if (c.D06) dept.push(`${c.D06} отказов закрыто без причины`);
p(dept.length ? dept.map((s) => `- ${s}`).join("\n") : "- Отклонений по агрегатам нет.");
p();
if (!c.D06 && A.totals.lostInWindow) {
  p(`Хорошая новость: из ${A.totals.lostInWindow} отказов за окно все закрыты с причиной. ` +
    `Дисциплина по полю «причина отказа» держится.`);
  p();
}

// --- Разбор по менеджерам ---
// Порядок: сначала холодец, потом норма, потом молодец. Внимание РОПа идёт сверху вниз,
// поэтому сверху должно быть то, что горит, а не алфавит и не лучший результат.
p("## Разбор по менеджерам");
p();
const rank = { crit: 3, high: 2, med: 1, low: 0 };
const BAND_ORDER = { "холодец": 0, "норма": 1, "молодец": 2 };
const detailed = managers
  .filter((m) => m.band !== "мало данных")
  .sort((a, b) => (BAND_ORDER[a.band] - BAND_ORDER[b.band]) || (a.index - b.index));
for (const m of detailed) {
  const own = flags.filter((f) => f.mgr === m.mgr && !SYSTEMIC.has(f.code));
  if (!own.length) continue;
  const pv = prevIdx[m.mgr];
  const dl = pv == null || m.index == null ? "" : ` (вчера ${pv})`;
  p(`### ${m.mgr} - ${m.index ?? "n/a"}/10${dl}, ${m.band}`);
  p();
  p(`Открытых сделок ${m.openDeals} на ${money(m.openBudget)}. ` +
    `Зависших ${m.stuckDeals}, молчащих ${m.silentDeals}, просроченных дел ${m.overdueTasks}, ` +
    `без следующего шага ${m.noNextStep}.`);
  p();
  const top = own.sort((a, b) => (rank[b.severity] - rank[a.severity]) || (b.budget - a.budget)).slice(0, TOP);
  let i = 0;
  for (const f of top) {
    i++;
    p(`${i}. \`${sevMark[f.severity]}\` **[${f.code} ${CODE_NAME[f.code]}]** ` +
      `[${f.deal}](${f.url}) «${cut(f.title, 60)}» ${f.budget ? `на ${money(f.budget)} ` : ""}` +
      `(${f.stage})`);
    p(`   Факт: ${f.fact}`);
    p(`   Как надо было: ${f.should}`);
  }
  if (own.length > TOP) p(`   ...ещё ${own.length - TOP} флагов, полный список в JSON.`);
  p();
}

// Менеджеры с выборкой меньше порога: индекс по ним не считаем, но критичный флаг на
// единственной сделке всё равно требует действия. Показываем компактно, без ранжирования.
const fewDetail = managers.filter((m) => m.band === "мало данных");
const fewCrit = flags.filter((f) => !SYSTEMIC.has(f.code) && f.severity === "crit"
  && fewDetail.some((m) => m.mgr === f.mgr));
if (fewCrit.length) {
  p(`### Малая выборка: критичное (индекс не считаем, действие всё равно нужно)`);
  p();
  for (const f of fewCrit.sort((a, b) => b.budget - a.budget).slice(0, 10)) {
    p(`- ${f.mgr}, **[${f.code} ${CODE_NAME[f.code]}]** [${f.deal}](${f.url}) ` +
      `«${cut(f.title, 50)}»${f.budget ? ` на ${money(f.budget)}` : ""}: ${f.fact}`);
  }
  if (fewCrit.length > 10) p(`- ...ещё ${fewCrit.length - 10}, полный список в JSON.`);
  p();
}

// --- Дельта ---
if (prev) {
  p("## Что изменилось со вчера");
  p();
  const prevFlags = new Set((prev.flags || []).map((f) => `${f.deal}:${f.code}`));
  const nowFlags = new Set(flags.map((f) => `${f.deal}:${f.code}`));
  const fixed = [...prevFlags].filter((k) => !nowFlags.has(k));
  const fresh = flags.filter((f) => !prevFlags.has(`${f.deal}:${f.code}`));
  p(`Закрыто со вчера: ${fixed.length}. Появилось новых: ${fresh.length}.`);
  p();
  const up = managers.filter((m) => prevIdx[m.mgr] != null && m.index > prevIdx[m.mgr]);
  const down = managers.filter((m) => prevIdx[m.mgr] != null && m.index < prevIdx[m.mgr]);
  if (up.length) p(`Выросли: ${up.map((m) => `${m.mgr} ${prevIdx[m.mgr]} -> ${m.index}`).join(", ")}`);
  if (down.length) p(`Просели: ${down.map((m) => `${m.mgr} ${prevIdx[m.mgr]} -> ${m.index}`).join(", ")}`);
  p();
} else {
  p("## Что изменилось со вчера");
  p();
  p("Предыдущий прогон не передан (`--prev`), дельту посчитать нельзя.");
  p();
}

// --- Системные дефекты ---
p("## Системные дефекты (чинит не менеджер)");
p();
const sysLines = [];
const sysFlags = flags.filter((f) => SYSTEMIC.has(f.code));
if (sysFlags.length) {
  const byCode = {};
  for (const f of sysFlags) byCode[f.code] = (byCode[f.code] || 0) + 1;
  for (const [code, n] of Object.entries(byCode)) {
    sysLines.push(`- **[${code} ${CODE_NAME[code]}]** ${n} сделок. Это дефект справочников и регламента, ` +
      `а не дисциплины конкретного менеджера. Владелец: РОП.`);
  }
}
const ni = A.meta.notImplemented || {};
if (ni.D13) sysLines.push(`- **[D13]** ${ni.D13}. Владелец: РОП плюс интегратор Bitrix24.`);
sysLines.push("- Поле «Дата решения клиента» из ТЗ Кости в Bitrix24 не создано: " +
  "детектор D05 работает на прокси (dwell больше 7 дней), а не на факте. Владелец: РОП плюс интегратор.");
p(sysLines.join("\n"));
p();

// --- Границы разбора ---
p("## Чего этот разбор не видит");
p();
for (const cv of A.meta.caveats || []) p(`- ${cv}`);
if (A.meta.dealsWithoutHistory) {
  p(`- ${A.meta.dealsWithoutHistory} сделок без истории стадий: срок на стадии по ним не считался.`);
}
p();
p("Коммуникационный слой (пустые письма, обращение по имени, размытые сроки, жаргон, орфография) " +
  "не проверялся: в снимке нет текстов сообщений. Это половина находок Кости. " +
  "Спецификация сборщика - `references/data-contract.md`, раздел «Слой B».");
p();

const md = L.join("\n");
if ((opts["--format"] || "md") === "json") {
  process.stdout.write(JSON.stringify({ markdown: md, meta: A.meta, totals: A.totals }, null, 2));
} else {
  process.stdout.write(md + "\n");
}
