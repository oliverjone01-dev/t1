// Запекает живые данные Bitrix (rop/data/rop.json) в дашборд РОПа.
// Шаблон: rop/manager-command.template.html (чистый MVP). Выход: public/manager-lakomova.html.
// Воспроизводит контракт DATA, который ждёт MVP: deals, leads, from, to, dq, funnel,
// keyStageStats, intStaff, opUsers (+ неиспользуемые stubs groups/sysUsers/deptOf).
//
// dwell (время в стадии) и касания (touchReal/touchAll) требуют истории стадий/активностей
// = фаза 2; пока 0. Воронка считается приближённо по ТЕКУЩЕЙ стадии (точная — с историей, ф.2).
//
// Запуск: npx tsx src/scripts/b24/build-rop.ts (после fetch-rop.ts).

import { readFileSync, writeFileSync } from "node:fs";

const TPL = "rop/manager-command.template.html";
const SRC = "rop/data/rop.json";
const PLAN = "rop/plan/plan.json"; // помесячный план (из Google Таблицы); опционален
const PLAN_ID = process.env.PLAN_SHEET_ID || "14jm7EvJcZSMvmWe2leRG8hHfIvpCLDzY";
// Персональный дашборд одного менеджера. Имя и выходной файл параметризуются
// (deploy-pages пересобирает каждого менеджера из единого rop.json в цикле).
const MGR = process.env.MANAGER_NAME || "Татьяна Лакомова";
const OUT = process.env.MANAGER_OUT || "public/manager-lakomova.html";
const TODAY = process.env.ROP_TODAY || new Date().toISOString().slice(0, 10);

const rop = JSON.parse(readFileSync(SRC, "utf-8"));
const tpl = readFileSync(TPL, "utf-8");
// План - необязателен: если файла нет, дашборд откатывается к ручному полю «План выручки/мес».
let plan: any = null;
try { plan = JSON.parse(readFileSync(PLAN, "utf-8")); } catch { plan = null; }

// --- Исключения (решение Ивана 2026-06-26, уточнено): из дашборда РОП убираем ТОЛЬКО ---
//  - сотрудников Glass Memory: Виктория Преснякова, Денис Белов, Юлия Мавлина;
//  - системный аккаунт Glass Memory (Системный пользователь MGM);
//  - направление бизнеса Glass Memory (dir = glass-memory).
// Остальных (вкл. Системный пользователь GG/KZ/V, Дмитрий Янчоглов, миграционные) ОСТАВЛЯЕМ.
const EXCLUDE_MGR = new Set([
  "Виктория Преснякова", "Денис Белов", "Юлия Мавлина", "Системный пользователь MGM",
]);
const keepRec = (r: any) => !EXCLUDE_MGR.has(r.mgr) && r.dir !== "glass-memory";
const _dBefore = rop.deals.length, _lBefore = rop.leads.length;
rop.deals = rop.deals.filter(keepRec);
rop.leads = rop.leads.filter(keepRec);
console.log(`Исключения GM/системные: сделок -${_dBefore - rop.deals.length} (осталось ${rop.deals.length}), лидов -${_lBefore - rop.leads.length} (осталось ${rop.leads.length})`);

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
  created: d.created, activity: d.activity, taskDue: d.taskDue, taskSubj: d.taskSubj, lastTouch: d.lastTouch || null, lastTouchChan: d.lastTouchChan || null,
  closed: d.closed, source: d.source, client: d.client,
  assort: d.assort, reason: d.reason, touchReal: d.touchReal || 0, touchAll: d.touchAll || 0, cycle: d.cycle,
  stageCode: d.stageCode, dir: d.dir, hist: d.hist || [], dwellCur: dwellOf(d),
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
const PIPE = ["C49:NEW", "C49:UC_LRFLH9", "C49:PREPARATION", "C49:UC_OGZUU0", "C49:PREPAYMENT_INVOIC",
  "C49:3", "C49:UC_8JTBV2", "C49:EXECUTING", "C49:FINAL_INVOICE", "C49:1", "C49:2", "C49:WON"];
const ord: Record<string, number> = {}; PIPE.forEach((c, i) => (ord[c] = i));
const reached = (d: any) => d.won ? ord["C49:WON"] : (d.lost ? 0 : (ord[d.stageCode] ?? 0));
const FUN: Array<[string, string]> = [
  ["Новая сделка", "C49:NEW"], ["Квалификация", "C49:UC_LRFLH9"], ["Формируется предложение", "C49:PREPARATION"],
  ["Предложение отправлено", "C49:PREPAYMENT_INVOIC"], ["Принимают решение", "C49:3"], ["Предоплата", "C49:EXECUTING"],
  ["В производстве", "C49:FINAL_INVOICE"], ["В логистике", "C49:2"], ["Успешно", "C49:WON"],
];
const funnel = FUN.map(([name, code]) => {
  const th = ord[code];
  const r = deals.filter((d: any) => reached(d) >= th);
  return { name, count: r.length, money: sum(r, (x) => x.budget), dwell: 0, conv: 0 };
});
funnel.forEach((f, k) => (f.conv = k === 0 ? 1 : (funnel[k - 1].count ? f.count / funnel[k - 1].count : 0)));

// --- keyStageStats (3 ключевые стадии; curCount/curMoney точно, dwell/касания=ф.2) ---
const KEYS: Array<[string, string]> = [
  ["C49:PREPAYMENT_INVOIC", "КП отправлено"], ["C49:3", "Принимают решение"], ["C49:UC_8JTBV2", "Долгострой"],
];
const keyStageStats = KEYS.map(([code, name]) => {
  const inS = deals.filter((d: any) => d.stageCode === code);
  return { code, name, curCount: inS.length, curMoney: sum(inS, (x) => x.budget),
    curMedDwell: 0, medDwell: 0, curNoReal: inS.length, curRealCover: 0, avgReal: 0 };
});

// --- intStaff (по сотрудникам: лиды/сделки/выигрыши) ---
const staff: Record<string, any> = {};
const ensure = (n: string) => (staff[n] ??= { name: n, dept: [], leads: 0, deals: 0, won: 0 });
for (const d of deals) { const s = ensure(d.mgr); s.deals++; if (d.won) s.won++; }
for (const l of leads) ensure(l.mgr).leads++;
const intStaff = Object.values(staff);

// --- opUsers (продавцы: менеджеры со сделками, по убыванию) ---
// НЕ сотрудники отдела продаж: системные аккаунты + владелец + не-продажные роли.
// Данные НЕ удаляем (их лиды/сделки остаются и попадают в «нераспределённые»),
// но из ростера ОП убираем, чтобы план-факт делился только на реальных продавцов.
const NOT_OP = new Set(["Дмитрий Янчоглов", "Алиса Алексеева"]);
const isSysName = (n: string) => /систем|^id\s?\d/i.test(n || "");
const isSalesRep = (s: any) => !NOT_OP.has(s.name) && !isSysName(s.name);
const opUsers = Object.values(staff)
  .filter((s: any) => s.deals > 0 && isSalesRep(s)).sort((a: any, b: any) => b.deals - a.deals).map((s: any) => s.name);
const _excluded = Object.values(staff).filter((s: any) => s.deals > 0 && !isSalesRep(s)).map((s: any) => s.name);
console.log(`Ростер ОП: ${opUsers.length} продавцов. Вне ОП (нераспределённые): ${_excluded.join(", ") || "-"}`);
if (!opUsers.includes(MGR)) console.warn(`ВНИМАНИЕ: менеджер "${MGR}" не в ростере ОП - дашборд может быть пустым`);

// --- Вес страницы: свои записи полностью, отдел - компактной таблицей ---------------
// Раньше в каждую персональную страницу зашивался весь массив компании (23 тыс сделок,
// 10 тыс лидов, ~20 МБ). Браузер на офисной машине не вытягивал: вкладка висела минутами.
// Плюс любой менеджер мог открыть исходник и увидеть сделки коллег.
// Теперь: свои сделки и лиды - как были, данные отдела (нужны для рейтинга и воронки
// отдела) - в колоночном виде со словарями повторяющихся значений. ~3.5 МБ вместо 20.
const MINE_D = deals.filter((d: any) => d.mgr === MGR);
const MINE_L = leads.filter((l: any) => l.mgr === MGR);
const DEPT_F = ["mgr", "lost", "won", "hist", "budget", "created", "dir", "stageCode", "assort", "client"];
const _codes: string[] = [], _mgrs: string[] = [];
const _ci = (v: any, dic: string[]): number | null => {
  if (v === null || v === undefined) return null;
  let i = dic.indexOf(v); if (i < 0) { i = dic.length; dic.push(v); } return i;
};
const dept = {
  f: DEPT_F, codes: _codes, mgrs: _mgrs,
  r: deals.filter((d: any) => d.mgr !== MGR).map((d: any) => [
    _ci(d.mgr, _mgrs), d.lost ? 1 : 0, d.won ? 1 : 0,
    (d.hist || []).map((h: any) => [_ci(h[0], _codes), String(h[1] || "").slice(0, 10)]),
    d.budget || 0, String(d.created || "").slice(0, 10), d.dir,
    _ci(d.stageCode, _codes), d.assort, d.client,
  ]),
};
console.log(`Свои: сделок ${MINE_D.length}, лидов ${MINE_L.length} | отдел (компактно): ${dept.r.length} сделок`);

// --- Диалоги (снимок dialog.json ветки dialog-export-v1): кто написал последним, на чьей стороне
// мяч, о чём договорились (Резюме BitrixGPT). Только по СВОИМ сделкам. Файла может не быть -
// тогда слой диалогов пустой, блок приоритета работает на стадиях/сроках без «мяча». ------------
let dialogMap: Record<string, any> = {};
try {
  const dlg = JSON.parse(readFileSync("rop/data/dialog.json", "utf-8"));
  const MSG = new Set(["Сообщение Telegram", "Сообщение MAX", "Сообщение WhatsApp", "Мессенджер ОЛ", "Письмо", "Звонок"]);
  const NOWMS = new Date(rop.generated_at || new Date().toISOString()).getTime();
  const clip = (s: string, n: number): string | null => {
    if (!s) return null;
    s = String(s).replace(/\s*-{3,}[\s\S]*$/, "").replace(/:[0-9a-f]{6,}:/gi, "").replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n) + "…" : s;
  };
  const mineIds = new Set(MINE_D.map((d: any) => String(d.id)));
  const byDeal: Record<string, any[]> = {};
  for (const e of (dlg.events || [])) {
    if (!e.dealId || !mineIds.has(String(e.dealId))) continue;
    (byDeal[e.dealId] = byDeal[e.dealId] || []).push(e);
  }
  for (const id of Object.keys(byDeal)) {
    const evs = byDeal[id].sort((a: any, b: any) => a.ts - b.ts);
    const msgs = evs.filter((e: any) => e.dir === "входящее" || e.dir === "исходящее" || MSG.has(e.type));
    const last = msgs[msgs.length - 1];
    const gpt = evs.filter((e: any) => e.type === "Резюме BitrixGPT").pop();
    // Выжимка всей переписки: приоритет - AI-резюме BitrixGPT; иначе последняя реплика клиента и наша.
    const summarize = (): string | null => {
      if (gpt && gpt.body) return clip(gpt.body, 320);
      const rev = msgs.slice().reverse();
      const lastIn = rev.find((e: any) => e.dir === "входящее");
      const lastOut = rev.find((e: any) => e.dir === "исходящее");
      const parts: string[] = [];
      if (lastIn) parts.push("Клиент: " + clip(lastIn.body || lastIn.title, 110));
      if (lastOut) parts.push("Мы: " + clip(lastOut.body || lastOut.title, 110));
      return parts.length ? parts.join(" · ") : clip((last && (last.body || last.title)) || "", 160);
    };
    if (!last) { dialogMap[id] = { ball: "none", gpt: gpt && gpt.body ? clip(gpt.body, 320) : null }; continue; }
    dialogMap[id] = {
      ball: last.dir === "входящее" ? "us" : last.dir === "исходящее" ? "client" : "unk",
      silent: Math.round((NOWMS - last.ts) / 864e5),
      date: new Date(last.ts).toISOString().slice(0, 10),
      chan: last.type, who: last.who,
      gpt: summarize(),
    };
  }
  console.log(`Диалоги: сопоставлено ${Object.keys(dialogMap).length} сделок из ${MINE_D.length} своих`);
} catch (e: any) { console.log(`Диалоги: пропуск (${e.message})`); dialogMap = {}; }

const DATA = {
  from, to, deals: MINE_D, leads: MINE_L, dept, groups: [], keyStageStats, funnel, dq, opUsers, intStaff,
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
  // Каналы коммуникации по менеджеру (звонки/письма/мессенджеры, вх/исх) за 90 дней. null = старый снимок.
  channelMix: rop.channelMix || null,
  // Фото профилей из Bitrix (имя -> URL) для аватара в шапке дашборда. undefined = старый снимок.
  managerPhotos: rop.managerPhotos || undefined,
  // Диалоги по своим сделкам: {dealId: {ball, silent, chan, who, gpt}}. {} = снимок без диалогов.
  dialog: dialogMap,
};

// --- инъекция в шаблон (замена литерала const DATA={...}) ---
const i = tpl.indexOf("const DATA=");
if (i < 0) { console.error("В шаблоне нет 'const DATA='"); process.exit(1); }
let j = tpl.indexOf("{", i), depth = 0, end = -1;
for (let k = j; k < tpl.length; k++) { const c = tpl[k]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { end = k; break; } } }
let out = tpl.slice(0, i) + "const DATA=" + JSON.stringify(DATA) + tpl.slice(end + 1);
// Персонализация: подменяем имя менеджера, по которому шаблон фильтрует сделки/лиды.
const _mRe = /const MANAGER="[^"]*";/;
if (!_mRe.test(out)) console.warn("ВНИМАНИЕ: в шаблоне не найден 'const MANAGER=' - имя не заменено");
out = out.replace(_mRe, "const MANAGER=" + JSON.stringify(MGR) + ";");
writeFileSync(OUT, out);

console.log(`build-manager: сделок ${deals.length}, лидов ${leads.length}, период ${from}..${to}`);
console.log(`funnel[0]=${funnel[0].count} funnel[Успешно]=${funnel[funnel.length - 1].count} | opUsers ${opUsers.length} | intStaff ${intStaff.length}`);
console.log(`-> ${OUT} (${(out.length / 1048576).toFixed(1)} MB)`);
