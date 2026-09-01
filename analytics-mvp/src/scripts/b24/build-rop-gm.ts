// Запекает живые данные Bitrix (rop/data/rop.json) в дашборд РОПа.
// Шаблон: rop/rop-command.template.html (чистый MVP). Выход: public/rop-command.html.
// Воспроизводит контракт DATA, который ждёт MVP: deals, leads, from, to, dq, funnel,
// keyStageStats, intStaff, opUsers (+ неиспользуемые stubs groups/sysUsers/deptOf).
//
// dwell (время в стадии) и касания (touchReal/touchAll) требуют истории стадий/активностей
// = фаза 2; пока 0. Воронка считается приближённо по ТЕКУЩЕЙ стадии (точная — с историей, ф.2).
//
// Запуск: npx tsx src/scripts/b24/build-rop.ts (после fetch-rop.ts).

import { readFileSync, writeFileSync } from "node:fs";

const TPL = "rop/rop-gm-command.template.html";
const SRC = "rop/data/rop-gm.json";
const PLAN = "rop/plan/plan-gm.json"; // своя GM план-таблица (Glass Memory), опциональна
// Таблица плана Glass Memory (Google Sheets, загружена Иваном 2026-08-04). Кнопка «↗ Таблица плана».
const PLAN_ID = process.env.PLAN_SHEET_ID || "1OZhFcSBwyNRemK_vF7dVaHNdJCvyGv1h";
const OUT = "public/rop-gm-command.html";
const TODAY = process.env.ROP_TODAY || new Date().toISOString().slice(0, 10);

const rop = JSON.parse(readFileSync(SRC, "utf-8"));
const tpl = readFileSync(TPL, "utf-8");
// План - необязателен: если файла нет, дашборд откатывается к ручному полю «План выручки/мес».
let plan: any = null;
try { plan = JSON.parse(readFileSync(PLAN, "utf-8")); } catch { plan = null; }

// GM-дашборд: данные уже отфильтрованы на уровне выгрузки (только воронка C21 Glass Memory
// + лиды направления glass-memory), поэтому здесь НЕ исключаем никого - это и есть наш отдел.
console.log(`GM (C21 Glass Memory): сделок ${rop.deals.length}, лидов ${rop.leads.length}`);

const DIRS = ["genglass", "glass-memory", "metal_gm", "gen-group", "gentero", "valonti"];
const sum = (arr: any[], f: (x: any) => number) => arr.reduce((s, x) => s + (f(x) || 0), 0);
const ddiff = (a?: string, b?: string): number | null => {
  if (!a || !b) return null; const t1 = Date.parse(a), t2 = Date.parse(b);
  return isNaN(t1) || isNaN(t2) ? null : Math.round((t2 - t1) / 86400000 * 100) / 100;
};
// dwellCur = дней в текущей стадии (для открытых сделок), из истории стадий.
const dwellOf = (d: any): number | null => {
  if (d.won || d.lost) return null;
  const h = d.hist || []; const at = h.length ? h[h.length - 1][1] : d.created;
  return ddiff(at, TODAY);
};

// --- deals -> схема MVP (+ hist/dwellCur из истории стадий; касания = фаза 2) ---
const deals = rop.deals.map((d: any) => ({
  id: d.id, mgr: d.mgr, stage: d.stage, won: d.won, lost: d.lost, budget: d.budget,
  created: d.created, activity: d.activity, taskDue: d.taskDue, taskSubj: d.taskSubj, lastTouch: d.lastTouch || null, lastTouchChan: d.lastTouchChan || null, closed: d.closed, source: d.source, client: d.client,
  assort: d.assort, reason: d.reason, touchReal: d.touchReal || 0, touchAll: d.touchAll || 0, cycle: d.cycle,
  touch90: d.touch90 ?? null, tasksOpen: d.tasksOpen ?? null, tasksNoContact: d.tasksNoContact ?? null,
  stageCode: d.stageCode, dir: d.dir, hist: d.hist || [], dwellCur: dwellOf(d),
  // Происхождение сделки: пришла из лида (для CR2 «из лида vs прямые» и дилер-воронки).
  fromLead: !!d.fromLead, leadId: d.leadId ?? null, leadDir: d.leadDir ?? null,
}));

// --- leads -> схема MVP (+ qual) ---
const qualOf = (sc: string) =>
  sc === "CONVERTED" ? "квал" : (["JUNK", "1", "2", "3"].includes(sc) ? "неквал" : "в работе");
const leads = rop.leads.map((l: any) => ({
  id: l.id, mgr: l.mgr, status: l.status, qual: qualOf(l.statusCode),
  created: l.created, closed: l.closed, source: l.source, dir: l.dir,
}));

// --- from / to ---
const dd = deals.map((d: any) => d.created).filter(Boolean).sort();
const from = dd[0] || TODAY;
const to = TODAY;

// --- dq (data quality, точный расчёт) ---
const byDir = (arr: any[]) => {
  const m: Record<string, number> = {}; DIRS.forEach((x) => (m[x] = 0));
  for (const r of arr) if (r.dir && r.dir !== "не указано") m[r.dir] = (m[r.dir] || 0) + 1;
  return m;
};
const leadByDir = byDir(leads), dealByDir = byDir(deals);
dealByDir["не указано"] = deals.filter((d: any) => d.dir === "не указано").length;
const leadQualByDir: Record<string, number> = {}; DIRS.forEach((x) => (leadQualByDir[x] = 0));
let leadQualEmpty = 0;
const leadStatByDir: Record<string, any> = {};
DIRS.forEach((x) => (leadStatByDir[x] = { s: 0, f: 0, p: 0, conv: 0 }));
for (const l of leads) {
  const d = l.dir && l.dir !== "не указано" ? l.dir : null;
  const bucket = l.qual === "квал" ? "s" : l.qual === "неквал" ? "f" : "p";
  if (d && leadStatByDir[d]) { leadStatByDir[d][bucket]++; if (l.qual === "квал") { leadStatByDir[d].conv++; leadQualByDir[d]++; } }
  else if (l.qual === "квал") leadQualEmpty++;
}
const dq = {
  leadTotal: leads.length,
  leadEmpty: leads.filter((l: any) => l.dir === "не указано").length,
  leadByDir, dealTotal: deals.length, dealByDir, leadQualByDir, leadQualEmpty,
  dirList: DIRS, leadStatByDir,
};

// --- funnel (кумулятивно по конвейеру; приближение по текущей стадии, dwell=ф.2) ---
const PIPE = ["C21:NEW", "C21:UC_UCLN76", "C21:PREPARATION", "C21:UC_OIR9YC", "C21:PREPAYMENT_INVOIC",
  "C21:FINAL_INVOICE", "C21:UC_5BND99", "C21:UC_T56ORF", "C21:WON"];
const ord: Record<string, number> = {}; PIPE.forEach((c, i) => (ord[c] = i));
const reached = (d: any) => d.won ? ord["C21:WON"] : (d.lost ? 0 : (ord[d.stageCode] ?? 0));
const FUN: Array<[string, string]> = [
  ["Заявка", "C21:NEW"], ["Выявление потребности", "C21:UC_UCLN76"], ["Потенц. клиенты", "C21:UC_OIR9YC"],
  ["КП/Договор отправлено", "C21:PREPAYMENT_INVOIC"], ["Ожидание оплаты", "C21:FINAL_INVOICE"], ["Счёт оплачен", "C21:UC_5BND99"],
  ["В производстве", "C21:UC_T56ORF"], ["Успех", "C21:WON"],
];
const funnel = FUN.map(([name, code]) => {
  const th = ord[code];
  const r = deals.filter((d: any) => reached(d) >= th);
  return { name, count: r.length, money: sum(r, (x) => x.budget), dwell: 0, conv: 0 };
});
funnel.forEach((f, k) => (f.conv = k === 0 ? 1 : (funnel[k - 1].count ? f.count / funnel[k - 1].count : 0)));

// --- keyStageStats (3 ключевые стадии; curCount/curMoney точно, dwell/касания=ф.2) ---
const KEYS: Array<[string, string]> = [
  ["C21:PREPAYMENT_INVOIC", "КП/Договор"], ["C21:FINAL_INVOICE", "Ожидание оплаты"], ["C21:UC_T56ORF", "В производстве"],
];
const keyStageStats = KEYS.map(([code, name]) => {
  const inS = deals.filter((d: any) => d.stageCode === code);
  return { code, name, curCount: inS.length, curMoney: sum(inS, (x) => x.budget),
    curMedDwell: 0, medDwell: 0, curNoReal: inS.length, curRealCover: 0, avgReal: 0 };
});

// --- intStaff (по сотрудникам: лиды/сделки/выигрыши) ---
const staff: Record<string, any> = {};
const ensure = (n: string) => (staff[n] ??= { name: n, dept: [], leads: 0, deals: 0, won: 0, last: null });
for (const d of deals) { const s = ensure(d.mgr); s.deals++; if (d.won) s.won++; if (d.created && (!s.last || d.created > s.last)) s.last = d.created; }
for (const l of leads) ensure(l.mgr).leads++;
const intStaff = Object.values(staff);

// --- opUsers (продавцы: менеджеры со сделками, по убыванию) ---
// НЕ сотрудники отдела продаж: системные аккаунты + владелец + не-продажные роли.
// Данные НЕ удаляем (их лиды/сделки остаются и попадают в «нераспределённые»),
// но из ростера ОП убираем, чтобы план-факт делился только на реальных продавцов.
const NOT_OP = new Set(["Дмитрий Янчоглов", "Алиса Алексеева"]);
const isSysName = (n: string) => /систем|^id\s?\d/i.test(n || "");
// Служебные/технические аккаунты (не живые продавцы): «Расчеты», «Удалить», «Тест», боты.
const isService = (n: string) => /расч[её]т|удалить|тест|бот/i.test(n || "");
// Уволенные из снимка (rop.firedManagers). Имя нормализуем: trim + схлопнуть пробелы + lower.
const normName = (n: string) => (n || "").trim().replace(/\s+/g, " ").toLowerCase();
const FIRED = new Set((rop.firedManagers || []).map(normName));
// Свежесть: в ростер попадает только тот, у кого есть сделка за последние ACTIVE_DAYS дней.
// Иначе исторические/уволенные раздувают N и занижают норму на менеджера (было /9 вместо /3).
const ACTIVE_DAYS = 90, _todayMs = Date.parse(TODAY);
const isRecent = (s: any) => s.last != null && (_todayMs - Date.parse(s.last)) / 86400000 <= ACTIVE_DAYS;
const isSalesRep = (s: any) => !NOT_OP.has(s.name) && !isSysName(s.name) && !isService(s.name) && !FIRED.has(normName(s.name));
const opUsers = Object.values(staff)
  .filter((s: any) => s.deals > 0 && isSalesRep(s) && isRecent(s)).sort((a: any, b: any) => b.deals - a.deals).map((s: any) => s.name);
const _excluded = Object.values(staff).filter((s: any) => s.deals > 0 && (!isSalesRep(s) || !isRecent(s))).map((s: any) => s.name);
// exUsers: ЖИВЫЕ продавцы (не система/сервис/владелец), выпавшие из ростера ТОЛЬКО потому, что
// уволены или неактивны >ACTIVE_DAYS. Их книга (сделки/лиды/выигрыши) остаётся на дашборде
// отдельной строкой другого цвета - для наглядности и перераспределения на действующих. В план
// они НЕ входят (норма делится только на opUsers). Системные/сервисные аккаунты сюда НЕ попадают.
const isHumanRep = (s: any) => !NOT_OP.has(s.name) && !isSysName(s.name) && !isService(s.name);
const opSet = new Set(opUsers);
const exUsers = Object.values(staff)
  .filter((s: any) => s.deals > 0 && isHumanRep(s) && !opSet.has(s.name))
  .sort((a: any, b: any) => b.deals - a.deals).map((s: any) => s.name);
console.log(`Ростер ОП: ${opUsers.length} продавцов. Уволенные/неактивные с книгой (exUsers): ${exUsers.join(", ") || "-"}. Прочие вне ОП: ${_excluded.filter((n: string) => !exUsers.includes(n)).join(", ") || "-"}`);

const DATA = {
  from, to, deals, leads, groups: [], keyStageStats, funnel, dq, opUsers, exUsers, intStaff,
  sysUsers: [], deptOf: {},
  // Метка свежести: когда данные сняты из Bitrix (для видимого штампа на странице).
  generatedAt: rop.generated_at || null,
  bakedAt: new Date().toISOString(), // штамп сборки: отличать свежую версию от кэша
  // Карточки производства (СП 1086): сквозная воронка сделки->позиции->изделия. null = старый снимок.
  prodItems: rop.prodItems || null,
  // Уволенные сотрудники (ACTIVE=false в Bitrix) - для подсветки брошенных лидов в стадии «Разобрать».
  // undefined = старый снимок без поля (тогда блок покажет «система»/«сотрудник» без метки «уволен»).
  firedManagers: rop.firedManagers,
  // Помесячный план (из Google Таблицы через plan-to-json). null = ручное поле плана.
  plan: plan || null,
  // Ссылки на таблицу плана: edit - открыть; csv (gviz, CORS-дружелюбный) - живое чтение кнопкой.
  planUrl: `https://docs.google.com/spreadsheets/d/${PLAN_ID}/edit`,
  planCsv: `https://docs.google.com/spreadsheets/d/${PLAN_ID}/gviz/tq?tqx=out:csv`,
  // Домен портала Bitrix для кликабельных ID (не секрет; переопределяется env B24_PORTAL).
  b24Portal: (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, ""),
  // Каналы коммуникации по менеджерам за 90 дней (звонки/письма/мессенджеры, вх/исх).
  // null = старый снимок без прохода по активностям (виджет покажет «готовится»).
  channelMix: rop.channelMix || null,
};

// --- инъекция в шаблон (замена литерала const DATA={...}) ---
const i = tpl.indexOf("const DATA=");
if (i < 0) { console.error("В шаблоне нет 'const DATA='"); process.exit(1); }
let j = tpl.indexOf("{", i), depth = 0, end = -1;
for (let k = j; k < tpl.length; k++) { const c = tpl[k]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { end = k; break; } } }
const out = tpl.slice(0, i) + "const DATA=" + JSON.stringify(DATA) + tpl.slice(end + 1);
writeFileSync(OUT, out);

console.log(`build-rop: сделок ${deals.length}, лидов ${leads.length}, период ${from}..${to}`);
console.log(`funnel[0]=${funnel[0].count} funnel[Успешно]=${funnel[funnel.length - 1].count} | opUsers ${opUsers.length} | intStaff ${intStaff.length}`);
console.log(`-> ${OUT} (${(out.length / 1048576).toFixed(1)} MB)`);
