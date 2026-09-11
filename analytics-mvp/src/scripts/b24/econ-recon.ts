// РАЗВЕДКА связей: сделка (воронка 49) <-> все смарт-процессы <-> все денежные поля.
// Задача - не считать маржу, а ПОКАЗАТЬ фактуру: какие СП вообще есть, какие денежные
// поля в них, насколько они заполнены, и по каждой сделке - какие СП запущены, какие
// поля денег и с какими значениями, со ссылками на карточки. Плюс товарные строки
// (есть/нет). Результат: economics/data/econ-recon.json (для экрана) + компактная сводка
// в stderr (ответы на вопросы: где нет товаров, у какой доли запущен Расчёт, доезжает ли
// факт-с/с производства). Только чтение, в CRM ничего не пишет.
// Запуск: B24_WEBHOOK_URL=... [ECON_WINDOW_DAYS=60] npx tsx src/scripts/b24/econ-recon.ts
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const OUT = "economics/data/econ-recon.json";
const CAT = 49;
const WINDOW_DAYS = Number(process.env.ECON_WINDOW_DAYS || 60);
// ECON_SINCE (абсолютная дата) имеет приоритет над окном в днях. По умолчанию - операционка
// после переезда (март 2026 = миграция 21466 сделок, её исключаем).
const SINCE = process.env.ECON_SINCE || "2026-04-01";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Денежное/стоимостное поле: тип money/double/integer/string и название про деньги/с-с/материал/услугу.
const MONEY_HINT = /с\s*\/\s*с|себестоим|стоим|цен|сумм|наценк|прибыл|маржа|бюджет|доставк|логист|монтаж|сборк|металл|сталь|алюмин|стекл|зеркал|фурнитур|дерев|профил|раскрой|сварк|зачист|нарезк|трубогиб|листогиб|покрас|токарн|слесар|гибк|сверл|зинковк|работ|материал/i;
const NOISE = /дата|срок|номер сделк|описан|коммент|ссылк|url|ответствен|статус|этап|воронк/i;
const MONEY_TYPES = /^(money|double|integer|string)$/i;
// Поля «Артикул» и «Кол-во товара» по карточкам СП (id из probe econ-tovar-probe) -
// чтобы собрать ИЗДЕЛИЯ (группировка карточек по артикулу) и с/с по каждому изделию.
const SP_ART: Record<number, { art?: string; qty?: string }> = {
  1060: { art: "ufCrm17_1772460985", qty: "ufCrm17_1773903995458" },
  1074: { art: "ufCrm19_1772433709", qty: "ufCrm19_1774931804" },
  1086: { art: "ufCrm23_1773571102", qty: "ufCrm23_1774846599942" },
};
const lbl = (d: any) => d.formLabel || d.listLabel || d.editFormLabel || d.title || "";
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const d10 = (s?: string) => (s ? String(s).slice(0, 10) : null);
const SUCC = new Set(["EXECUTING", "FINAL_INVOICE", "1", "2", "WON"]); // предоплата+ (без префикса C49:)

async function call(method: string, params: any = {}): Promise<any> {
  let lastErr: any;
  for (let a = 0; a < 6; a++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params), signal: AbortSignal.timeout(30000) });
      const j: any = await res.json();
      if (j.error) { if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await sleep(1200); a--; continue; } throw new Error(`${method}: ${j.error_description || j.error}`); }
      return j;
    } catch (e) { lastErr = e; await sleep(600 * (a + 1)); }
  }
  throw lastErr;
}
async function pageAll(method: string, params: any): Promise<any[]> {
  const all: any[] = []; let start = 0;
  for (;;) { const j = await call(method, { ...params, start }); const b: any[] = j.result || []; all.push(...b); if (j.next === undefined || !b.length) break; start = j.next; }
  return all;
}
async function itemsAll(etid: number, select: string[]): Promise<any[]> {
  const all: any[] = []; let lastId = 0;
  for (;;) { const j = await call("crm.item.list", { entityTypeId: etid, select, filter: { ">id": lastId }, order: { id: "ASC" }, start: -1 }); const b: any[] = (j.result && j.result.items) || []; if (!b.length) break; all.push(...b); lastId = Number(b[b.length - 1].id); if (b.length < 50) break; }
  return all;
}
// --- Шардированная выборка истории стадий (как в fetch-rop): быстро, не вешает джоб ---
const HCONC = 8;
const rowsOf = (j: any, itemsPath: boolean): any[] => (itemsPath ? (j.result?.items || []) : (j.result || []));
async function idBounds(method: string, params: any, idField: string, itemsPath: boolean): Promise<{ min: number; max: number }> {
  const hi = await call(method, { ...params, order: { [idField]: "DESC" }, start: -1 });
  const hiArr = rowsOf(hi, itemsPath); if (!hiArr.length) return { min: 0, max: 0 };
  const lo = await call(method, { ...params, order: { [idField]: "ASC" }, start: -1 });
  const loArr = rowsOf(lo, itemsPath);
  return { min: Number(loArr[0][idField]), max: Number(hiArr[0][idField]) };
}
async function pageBand(method: string, params: any, lo: number, hi: number, idField: string, itemsPath: boolean): Promise<any[]> {
  const all: any[] = []; let last = lo;
  for (;;) { const filter = { ...(params.filter || {}), [`>${idField}`]: last, [`<=${idField}`]: hi };
    const j = await call(method, { ...params, filter, order: { [idField]: "ASC" }, start: -1 });
    const batch = rowsOf(j, itemsPath); if (!batch.length) break;
    all.push(...batch); last = Number(batch[batch.length - 1][idField]);
    if (batch.length < 50 || last >= hi) break; }
  return all;
}
async function listSharded(method: string, params: any, opts: { idField?: string; itemsPath?: boolean; shards?: number } = {}): Promise<any[]> {
  const idField = opts.idField || "ID", itemsPath = !!opts.itemsPath, shards = Math.max(1, opts.shards || HCONC);
  const { min, max } = await idBounds(method, params, idField, itemsPath); if (!max) return [];
  const base = min - 1, span = max - base, step = Math.ceil(span / shards);
  const bands: Array<[number, number]> = [];
  for (let i = 0; i < shards; i++) { const lo = base + i * step, hi = Math.min(base + (i + 1) * step, max); if (lo < hi) bands.push([lo, hi]); }
  const parts = await Promise.all(bands.map(([lo, hi]) => pageBand(method, params, lo, hi, idField, itemsPath)));
  return parts.flat();
}

(async () => {
  const cutoff = SINCE || new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);

  // 1) Все смарт-процессы (типы). Ищем в т.ч. Сборка/Логистика/Монтаж/Чертёж.
  const types: any[] = (await call("crm.type.list", {})).result?.types || [];
  const sps = types.map((t) => ({ etid: Number(t.entityTypeId), title: t.title })).filter((t) => t.etid >= 1000);
  console.error(`ТИПЫ СП (${sps.length}):`);
  for (const s of sps) console.error(`RECON-TYPE\t${s.etid}\t${s.title}`);

  // 2) Сделки воронки 49 за окно
  const stages = await pageAll("crm.status.list", { filter: {} });
  const stageName: Record<string, string> = {}; for (const s of stages) stageName[s.STATUS_ID] = s.NAME;
  // Таксономия этапов смарт-процессов - для окраски изделия по прогрессу («ближе к закрытию темнее»).
  // Статусы смартов приходят кодом вида DT<etid>_<cat>:CODE; группируем по смарту, сортируем по SORT.
  const spStages: Record<string, { code: string; name: string; sort: number; success: boolean; fail: boolean }[]> = {};
  for (const s of stages) {
    const m = /^DT(\d+)_\d+:/.exec(String(s.STATUS_ID || "")); if (!m) continue;
    (spStages[m[1]] = spStages[m[1]] || []).push({ code: String(s.STATUS_ID), name: String(s.NAME || ""), sort: Number(s.SORT) || 0, success: /:SUCCESS$/.test(String(s.STATUS_ID)), fail: /:FAIL$/.test(String(s.STATUS_ID)) });
  }
  for (const k of Object.keys(spStages)) spStages[k].sort((a, b) => a.sort - b.sort);
  const users = await pageAll("user.get", {});
  const uName: Record<string, string> = {}; for (const u of users) uName[String(u.ID)] = `${u.LAST_NAME || ""} ${u.NAME || ""}`.trim() || `id${u.ID}`;
  // 2.0) Поле «Тип ассортимента» в сделке (справочник) - тянем как есть, значение расшифровываем по items
  let assortId = ""; let assortLabel = ""; const assortMap: Record<string, string> = {};
  try {
    const dfs: Record<string, any> = (await call("crm.deal.fields", {})).result || {};
    for (const [id, def] of Object.entries(dfs)) {
      if (!/тип\s*ассортимент|ассортимент/i.test(String(lbl(def)))) continue;
      assortId = id; assortLabel = String(lbl(def));
      for (const it of ((def as any).items || [])) assortMap[String(it.ID)] = String(it.VALUE);
      console.error(`RECON-ASSORT\tполе ${id} «${assortLabel}» значений справочника ${Object.keys(assortMap).length}`);
      break;
    }
    if (!assortId) console.error("RECON-ASSORT\tполе «Тип ассортимента» среди полей сделки не найдено");
  } catch (e) { console.error("RECON-ASSORT\tошибка чтения crm.deal.fields:", String(e)); }
  const resolveAssort = (v: any): string => !assortId ? "" : Array.isArray(v) ? v.map((x) => assortMap[String(x)] || String(x)).filter(Boolean).join(", ") : (assortMap[String(v)] || (v ? String(v) : ""));

  // 2.1) Денежное поле «Предоплата» (для тумблера «Сумма: бюджет/предоплата» в экране «Сделки»).
  let prepayId = "";
  try {
    const dfs2: Record<string, any> = (await call("crm.deal.fields", {})).result || {};
    const money = (def: any) => /^(money|double|integer)$/i.test(String(def.type || ""));
    for (const [id, def] of Object.entries<any>(dfs2)) { if (String(lbl(def)).trim().toLowerCase() === "предоплата" && money(def)) { prepayId = id; break; } }
    if (!prepayId) for (const [id, def] of Object.entries<any>(dfs2)) { const t = String(lbl(def)).trim().toLowerCase(); if (/предоплат/.test(t) && !/получен|дата|%|процент/.test(t) && money(def)) { prepayId = id; break; } }
    console.error(prepayId ? `RECON-PREPAY\tденежное поле «Предоплата» = ${prepayId}` : "RECON-PREPAY\tденежное поле «Предоплата» не найдено");
  } catch (e) { console.error("RECON-PREPAY\tошибка:", String(e)); }

  // MOVED_TIME = дата перехода сделки в ТЕКУЩУЮ стадию. Для сделок в «Заказ отправлен» это и есть дата реализации.
  const dealSelect = ["ID", "TITLE", "OPPORTUNITY", "ASSIGNED_BY_ID", "STAGE_ID", "DATE_CREATE", "DATE_MODIFY", "MOVED_TIME", ...(assortId ? [assortId] : []), ...(prepayId ? [prepayId] : [])];
  const dealRows = await pageAll("crm.deal.list", { filter: { CATEGORY_ID: CAT, ">=DATE_CREATE": cutoff }, select: dealSelect, order: { ID: "DESC" } });
  const deal: Record<string, any> = {};
  for (const d of dealRows) { const stName = stageName[d.STAGE_ID] || d.STAGE_ID; deal[String(d.ID)] = { id: Number(d.ID), title: d.TITLE || "", mgr: uName[String(d.ASSIGNED_BY_ID)] || null, stageCode: String(d.STAGE_ID || "").replace(/^C49:/, ""), stage: stName, budget: Math.round(num(d.OPPORTUNITY)), prepayAmt: prepayId ? Math.round(num(d[prepayId])) : 0, created: d10(d.DATE_CREATE), modified: d10(d.DATE_MODIFY), shippedAt: (String(stName) === "Заказ отправлен" && d.MOVED_TIME) ? d10(d.MOVED_TIME) : null, readyAt: (String(stName) === "Заказ произведен" && d.MOVED_TIME) ? d10(d.MOVED_TIME) : null, assort: assortId ? resolveAssort(d[assortId]) : "", sps: {} as Record<string, any>, products: [] as any[], hasProducts: false }; }
  const inWin = new Set(Object.keys(deal));
  // Дата реализации проставлена выше из MOVED_TIME для сделок в стадии «Заказ отправлен» (без тяжёлых доп. запросов).
  console.error(`RECON-SHIPPED\tсделок с датой реализации (в стадии «Заказ отправлен», по MOVED_TIME): ${[...inWin].filter((id) => deal[id].shippedAt).length}`);
  console.error(`Сделок воронки ${CAT} за ${WINDOW_DAYS} дн (с ${cutoff}): ${inWin.size}`);
  // История стадий (шардировано, best-effort): дата ВХОДА в «Предоплата получена» и «Заказ
  // отправлен» для ВСЕХ сделок, а не только стоящих на этой стадии сейчас. Чинит «дату
  // реализации» у ушедших дальше (в «Сделка успешна») и даёт «дату предоплаты» для фильтра.
  // При любом сбое снимок всё равно пишется: реализация останется из MOVED_TIME, предоплата пустой.
  try {
    const hist = await listSharded("crm.stagehistory.list", { entityTypeId: 2, filter: { CATEGORY_ID: CAT } }, { itemsPath: true });
    const firstInto: Record<string, Record<string, string>> = {};
    for (const h of hist) { const oid = String(h.OWNER_ID); const nm = stageName[h.STAGE_ID] || ""; const dt = d10(h.CREATED_TIME); if (!oid || !nm || !dt) continue; (firstInto[oid] ||= {}); if (!firstInto[oid][nm] || dt < firstInto[oid][nm]) firstInto[oid][nm] = dt; }
    let np = 0, ns = 0, nr = 0;
    for (const id of inWin) { const f = firstInto[id]; if (!f) continue;
      if (f["Предоплата получена"]) { deal[id].prepayAt = f["Предоплата получена"]; np++; }
      if (f["Заказ произведен"]) { deal[id].readyAt = f["Заказ произведен"]; nr++; }
      if (f["Заказ отправлен"]) { deal[id].shippedAt = f["Заказ отправлен"]; ns++; } }
    console.error(`RECON-HIST\tистория стадий: строк ${hist.length}; дата предоплаты у ${np}, дата готовности у ${nr}, дата реализации (из истории) у ${ns}`);
  } catch (e) { console.error("RECON-HIST\tошибка истории стадий (даты из MOVED_TIME/пусто):", String(e)); }

  // 3) По каждому СП: денежные поля -> инвентаризация (заполненность на карточках, привязанных к окну)
  //    + перенос значений на сделку.
  const spMeta: any[] = []; const inv: any[] = [];
  for (const sp of sps) {
    let fields: Record<string, any>;
    try { fields = (await call("crm.item.fields", { entityTypeId: sp.etid })).result?.fields || {}; } catch { continue; }
    const money: { id: string; label: string; type: string }[] = [];
    for (const [id, def] of Object.entries(fields)) { const t = String(lbl(def)).trim(), ty = String((def as any).type || ""); if (!MONEY_TYPES.test(ty)) continue; if (!MONEY_HINT.test(t) || NOISE.test(t)) continue; money.push({ id, label: t, type: ty }); }
    if (!money.length) continue;
    const ax = SP_ART[sp.etid] || {};
    const extra = [ax.art, ax.qty].filter(Boolean) as string[];
    const items = await itemsAll(sp.etid, ["id", "parentId2", "stageId", "title", ...money.map((m) => m.id), ...extra]);
    const fill: Record<string, number> = {}; let linkedItems = 0, linkedDeals = new Set<string>();
    for (const it of items) {
      const did = String(it.parentId2 || ""); if (!did || !inWin.has(did)) continue;
      linkedItems++; linkedDeals.add(did);
      const rec = deal[did]; const s = (rec.sps[sp.title] = rec.sps[sp.title] || { etid: sp.etid, cards: [] as any[], money: {} as Record<string, number> });
      const st = String(it.stageId || "");
      const bad = /:FAIL/i.test(st); // провальная/проигранная стадия карточки смарта - в с/с не берём
      const cardMoney: { label: string; value: number }[] = [];
      for (const m of money) { const v = num(it[m.id]); if (v) { fill[m.id] = (fill[m.id] || 0) + 1; if (!bad) s.money[m.label] = (s.money[m.label] || 0) + v; cardMoney.push({ label: m.label, value: Math.round(v) }); } }
      const art = ax.art ? String(it[ax.art] ?? "").trim() : "";
      const qty = ax.qty ? num(it[ax.qty]) : 0;
      // название изделия из заголовка карточки (обычно «<сделка>/<артикул>. <название товара>»)
      const nm = String(it.title ?? "").trim();
      s.cards.push({ id: it.id, money: cardMoney, art, qty, st, bad, nm });
    }
    spMeta.push({ etid: sp.etid, title: sp.title, fields: money });
    for (const m of money) inv.push({ etid: sp.etid, sp: sp.title, label: m.label, type: m.type, nonzero: fill[m.id] || 0, linked: linkedItems, fillPct: linkedItems ? Math.round(100 * (fill[m.id] || 0) / linkedItems) : 0 });
    console.error(`RECON-SP\t${sp.etid}\t${sp.title}\tденеж.полей ${money.length}\tкарточек→окно ${linkedItems}\tсделок ${linkedDeals.size}`);
  }

  // 4) Товарные строки
  let withProд = 0; const noProd: number[] = [];
  for (const id of inWin) {
    try { const rows: any[] = (await call("crm.item.productrow.list", { filter: { "=ownerType": "D", "=ownerId": Number(id) } })).result?.productRows || []; if (rows.length) { deal[id].products = rows.map((r) => ({ name: r.productName || "", qty: Number(r.quantity) || 0, price: Math.round(num(r.price)) })); deal[id].hasProducts = true; withProд++; } else noProd.push(Number(id)); } catch { noProd.push(Number(id)); }
  }

  // 5) JSON для экрана
  const deals = [...inWin].map((id) => { const r = deal[id]; return { id: r.id, title: r.title, mgr: r.mgr, stage: r.stage, stageCode: r.stageCode, budget: r.budget, prepayAmt: r.prepayAmt || 0, created: r.created, modified: r.modified || null, shippedAt: r.shippedAt || null, readyAt: r.readyAt || null, prepayAt: r.prepayAt || null, assort: r.assort || "", hasProducts: r.hasProducts, products: r.products, sps: Object.entries(r.sps).map(([k, v]: any) => ({ key: k, etid: v.etid, cards: v.cards, money: Object.entries(v.money).map(([label, value]) => ({ label, value: Math.round(value as number) })) })) }; }).sort((a, b) => b.id - a.id);
  mkdirSync("economics/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), category: CAT, windowDays: WINDOW_DAYS, since: cutoff, b24Portal: (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, ""), spMeta, spStages, inventory: inv, deals }));

  // 6) Сводка ответов
  const N = inWin.size;
  const raschet = deals.filter((d) => d.sps.some((s) => /расч[её]т/i.test(s.key))).length;
  const anySS = deals.filter((d) => d.sps.some((s) => s.money.length)).length;
  const prodStage = deals.filter((d) => /производств|предоплат|успешн|заказ в произв/i.test(d.stage || "") || SUCC.has(d.stageCode));
  const prodStageWithFact = prodStage.filter((d) => d.sps.some((s) => /производство/i.test(s.key) && s.money.length));
  console.error("=========== СВОДКА ===========");
  console.error(`Всего сделок: ${N}`);
  console.error(`С товарными строками: ${withProд} (${Math.round(100 * withProд / N)}%); без товаров: ${noProd.length} (${Math.round(100 * noProd.length / N)}%)`);
  console.error(`Запущен СП Расчёт: ${raschet} (${Math.round(100 * raschet / N)}%)`);
  console.error(`Хоть какое-то денежное поле в любом СП: ${anySS} (${Math.round(100 * anySS / N)}%)`);
  console.error(`Дошли до производства/предоплаты+: ${prodStage.length}; из них с факт-с/с Производства: ${prodStageWithFact.length} (${prodStage.length ? Math.round(100 * prodStageWithFact.length / prodStage.length) : 0}%)  <= "реальная с/с почти не доезжает"`);
  // доля запуска по каждому СП
  for (const sp of spMeta) { const n = deals.filter((d) => d.sps.some((s) => s.key === sp.title)).length; console.error(`SP-LAUNCH\t${sp.title}\t${n}\t${Math.round(100 * n / N)}%`); }
  console.error(`Сделок без товарных строк (первые 60 ID): ${noProd.slice(0, 60).join(",")}`);

  // 7) РАЗВЕДКА ПОЛЕЙ-ДАТ (read-only): под «Срок сдачи» (план по договору) и «Дата
  //    готовности фактическая» (по цеху сборки) - показать реальные поля + заполненность.
  try {
    const isDate = (t: any) => /^(date|datetime)$/i.test(String(t || ""));
    const hasV = (v: any) => v !== null && v !== undefined && String(v).trim() !== "" && !/^0000-00-00/.test(String(v));
    const HINT = /срок|сдач|готов|отгруз|завершен|договор|устн|план|дедлайн|deadline/i;
    const pctN = (n: number, d: number) => d ? Math.round(100 * n / d) : 0;
    // 7.1 поля-даты сделки
    const dfsAll: Record<string, any> = (await call("crm.deal.fields", {})).result || {};
    const dealDate: { id: string; label: string; type: string }[] = [];
    for (const [id, def] of Object.entries<any>(dfsAll)) if (isDate(def.type)) dealDate.push({ id, label: String(lbl(def)), type: String(def.type) });
    const ddSel = ["ID", ...dealDate.map((f) => f.id)];
    const ddRows = await pageAll("crm.deal.list", { filter: { CATEGORY_ID: CAT, ">=DATE_CREATE": cutoff }, select: ddSel, order: { ID: "DESC" } });
    const NN = ddRows.length; const dfill: Record<string, number> = {};
    for (const d of ddRows) for (const f of dealDate) if (hasV(d[f.id])) dfill[f.id] = (dfill[f.id] || 0) + 1;
    console.error(`\nDATE-PROBE\tполя-даты СДЕЛКИ (сделок в окне ${NN}) ===`);
    dealDate.map((f) => ({ ...f, n: dfill[f.id] || 0 })).sort((a, b) => b.n - a.n)
      .forEach((f) => console.error(`DEAL-DATE\t${pctN(f.n, NN)}%\t${f.n}/${NN}\t${f.id}\t${f.type}\t${f.label}${HINT.test(f.label) ? "\t<< КАНДИДАТ" : ""}`));
    // 7.2 поля-даты СП «Производство»
    for (const sp of sps.filter((s) => /производств/i.test(s.title))) {
      let fld: Record<string, any>;
      try { fld = (await call("crm.item.fields", { entityTypeId: sp.etid })).result?.fields || {}; } catch { continue; }
      const spDate: { id: string; label: string; type: string }[] = [];
      for (const [id, def] of Object.entries<any>(fld)) if (isDate(def.type)) spDate.push({ id, label: String(lbl(def)), type: String(def.type) });
      const its = await itemsAll(sp.etid, ["id", "parentId2", ...spDate.map((f) => f.id)]);
      let linked = 0; const sfill: Record<string, number> = {};
      for (const it of its) { if (!inWin.has(String(it.parentId2 || ""))) continue; linked++; for (const f of spDate) if (hasV(it[f.id])) sfill[f.id] = (sfill[f.id] || 0) + 1; }
      console.error(`\nDATE-PROBE\tСП ${sp.etid} «${sp.title}» поля-даты (карточек к окну ${linked}) ===`);
      spDate.map((f) => ({ ...f, n: sfill[f.id] || 0 })).sort((a, b) => b.n - a.n)
        .forEach((f) => console.error(`SP-DATE\t${sp.etid}\t${pctN(f.n, linked)}%\t${f.n}/${linked}\t${f.id}\t${f.type}\t${f.label}${HINT.test(f.label) ? "\t<< КАНДИДАТ" : ""}`));
    }
  } catch (e) { console.error("DATE-PROBE\tошибка:", String(e)); }

  console.error("RECON-DONE");
})();
