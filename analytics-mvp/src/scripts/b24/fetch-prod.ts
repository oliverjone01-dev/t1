// Прямой коннектор Bitrix24 (read-only) -> prod/data/prod.json для дашборда ПРОИЗВОДСТВО.
// Смарт-процесс «Производство GG» (entityTypeId=1086): карточки (crm.item.list),
// история стадий (crm.stagehistory.list) для времени на участках, связь со сделкой
// воронки 49 (parentId2), справочники (пользователи, enum-поля, стадии).
//
// Сеть нужна к glassmemory.bitrix24.ru -> бежит в GitHub Actions (prod-snapshot.yml).
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/fetch-prod.ts

import { writeFileSync, mkdirSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL в окружении"); process.exit(1); }
const OUT = "prod/data/prod.json";
const ETID = 1086; // Производство GG
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// UF-поля карточки производства (из разведки b24-spa-probe 2026-07-03).
const UF = {
  dir: "ufCrm23_1773571360",            // Направление бизнеса (enum)
  assort: "ufCrm23_1773575230",         // Тип ассортимента (enum)
  productType: "ufCrm23_1773575756",    // Тип изделия (enum)
  article: "ufCrm23_1773571102",        // Артикул
  dealIdText: "ufCrm23_1773571059",     // ID сделки (текст, дубль parentId2)
  prodCost: "ufCrm23_1773573698",       // Себестоимость производственная (money)
  constructor: "ufCrm23_1773572995",    // Конструктор (employee)
  sourceMgr: "ufCrm23_1773575904",      // Источник (менеджер) (employee)
  shopHead1: "ufCrm23_1773632788",      // Руководитель этапа Цех №1
  shopHead2: "ufCrm23_1773632902",      // Руководитель этапа Цех №2
  otk: "ufCrm23_1773632837",            // Куратор нестандарта/ОТК
  technolog: "ufCrm23_1773633161",      // Технолог
  smetchik: "ufCrm23_1773633125",       // Сметчик
  dateToProd: "ufCrm23_1777569335541",  // Дата передачи заказа в производство
  verbalDeadline: "ufCrm23_1777878236", // Срок по устной договорённости (date)
  paymentStatus: "ufCrm23_1777899923554", // GG Статус оплаты (enum Да/Нет)
  needPaint: "ufCrm23_1774874387299",   // Требуется покраска (enum Да/Нет)
} as const;

async function call(method: string, params: any = {}): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params), signal: AbortSignal.timeout(30000),
      });
      const j: any = await res.json();
      if (j.error) {
        if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await sleep(1200); attempt--; continue; }
        throw new Error(`${method}: ${j.error_description || j.error}`);
      }
      return j;
    } catch (e) { lastErr = e; await sleep(600 * (attempt + 1)); }
  }
  throw lastErr;
}

// crm.item.list: пагинация по id (start:-1), result.items.
async function itemsAll(entityTypeId: number): Promise<any[]> {
  const all: any[] = []; let lastId = 0;
  for (;;) {
    const j = await call("crm.item.list", {
      entityTypeId, select: ["*", "uf_*"],
      filter: { ">id": lastId }, order: { id: "ASC" }, start: -1,
    });
    const batch: any[] = (j.result && j.result.items) || [];
    if (!batch.length) break;
    all.push(...batch);
    lastId = Number(batch[batch.length - 1].id);
    if (batch.length < 50) break;
  }
  return all;
}

// crm.stagehistory.list для смарт-процесса: entityTypeId=1086.
async function historyAll(entityTypeId: number): Promise<any[]> {
  const all: any[] = []; let lastId = 0;
  for (;;) {
    const j = await call("crm.stagehistory.list", {
      entityTypeId, filter: { ">ID": lastId }, order: { ID: "ASC" }, start: -1,
    });
    const batch: any[] = (j.result && j.result.items) || j.result || [];
    if (!batch.length) break;
    all.push(...batch);
    lastId = Number(batch[batch.length - 1].ID);
    if (batch.length < 50) break;
  }
  return all;
}

async function pageAll(method: string, params: any): Promise<any[]> {
  const all: any[] = []; let start = 0;
  for (;;) {
    const j = await call(method, { ...params, start });
    const batch: any[] = j.result || [];
    all.push(...batch);
    if (j.next === undefined || !batch.length) break;
    start = j.next;
  }
  return all;
}

function enumMap(field: any): Record<string, string> {
  const m: Record<string, string> = {};
  for (const it of (field?.items || [])) m[String(it.ID ?? it.id)] = it.VALUE ?? it.value;
  return m;
}
const d10 = (s?: string) => (s ? String(s).slice(0, 10) : null);
const dayDiff = (a?: string | null, b?: string | null): number | null => {
  if (!a || !b) return null; const t1 = Date.parse(a), t2 = Date.parse(b);
  return isNaN(t1) || isNaN(t2) ? null : Math.round(((t2 - t1) / 86400000) * 100) / 100;
};

async function main() {
  console.log(`Bitrix СП Производство (1086) -> ${OUT}`);

  // --- Справочники ---
  const users = await pageAll("user.get", {});
  const userName: Record<string, string> = {};
  for (const u of users) userName[String(u.ID)] = `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim() || `id${u.ID}`;

  const f: any = (await call("crm.item.fields", { entityTypeId: ETID })).result?.fields || {};
  const dirMap = enumMap(f[UF.dir]);
  const assortMap = enumMap(f[UF.assort]);
  const prodTypeMap = enumMap(f[UF.productType]);
  const payMap = enumMap(f[UF.paymentStatus]);
  const paintMap = enumMap(f[UF.needPaint]);

  // Этапы + порядок (crm.status.list DYNAMIC_1086_STAGE_31; воронка одна, id=31).
  const cats: any[] = (await call("crm.category.list", { entityTypeId: ETID })).result?.categories || [];
  const stageName: Record<string, string> = {}; const stageSem: Record<string, string> = {};
  const stageOrder: string[] = [];
  for (const c of cats) {
    const st: any[] = (await call("crm.status.list", { filter: { ENTITY_ID: `DYNAMIC_${ETID}_STAGE_${c.id}` }, order: { SORT: "ASC" } })).result || [];
    for (const s of st) { stageName[s.STATUS_ID] = s.NAME; stageSem[s.STATUS_ID] = s.SEMANTICS || "P"; stageOrder.push(s.STATUS_ID); }
  }
  console.log(`Справочники: пользователей ${users.length}, стадий ${stageOrder.length}, направлений ${Object.keys(dirMap).length}`);

  // --- Карточки производства ---
  const rows = await itemsAll(ETID);
  console.log(`Карточек производства: ${rows.length}`);

  // История стадий -> на элемент [stageId, дата входа], сортировка.
  const histRows = await historyAll(ETID);
  const histByItem: Record<string, [string, string][]> = {};
  for (const h of histRows) {
    const oid = String(h.OWNER_ID ?? h.ownerId ?? h.ENTITY_ID);
    (histByItem[oid] ||= []).push([String(h.STAGE_ID ?? h.stageId), d10(h.CREATED_TIME ?? h.createdTime) || ""]);
  }
  for (const k in histByItem) histByItem[k].sort((a, b) => (a[1] < b[1] ? -1 : 1));
  console.log(`История стадий: ${histRows.length} записей на ${Object.keys(histByItem).length} элементов`);

  // Связь со сделкой: собрать parentId2 -> бюджет/стадия/менеджер сделки (воронка 49).
  const dealIds = [...new Set(rows.map((r) => Number(r.parentId2)).filter(Boolean))];
  const dealInfo: Record<string, any> = {};
  for (let i = 0; i < dealIds.length; i += 50) {
    const chunk = dealIds.slice(i, i + 50);
    const dl: any[] = (await call("crm.deal.list", { select: ["ID", "OPPORTUNITY", "CATEGORY_ID", "STAGE_ID", "ASSIGNED_BY_ID"], filter: { ID: chunk }, start: -1 })).result || [];
    for (const d of dl) dealInfo[String(d.ID)] = { budget: Number(d.OPPORTUNITY) || 0, cat: Number(d.CATEGORY_ID), stage: String(d.STAGE_ID), mgr: userName[String(d.ASSIGNED_BY_ID)] || null };
  }
  console.log(`Связь со сделками: ${Object.keys(dealInfo).length} из ${dealIds.length}`);

  const un = (v: any) => (v ? userName[String(v)] || `id${v}` : null);
  const items = rows.map((r) => {
    const did = r.parentId2 ? String(r.parentId2) : null;
    const di = did ? dealInfo[did] : null;
    return {
      id: r.id, title: r.title || "", article: r[UF.article] || "",
      dealId: did, dealBudget: di?.budget ?? null, dealCat: di?.cat ?? null, dealMgr: di?.mgr ?? null,
      stageCode: r.stageId, stage: stageName[r.stageId] || r.stageId,
      sem: stageSem[r.stageId] || "P",
      created: d10(r.createdTime), moved: d10(r.movedTime), updated: d10(r.updatedTime),
      begin: d10(r.begindate), close: d10(r.closedate),
      dateToProd: d10(r[UF.dateToProd]),
      opportunity: Number(r.opportunity) || 0,
      prodCost: Number(r[UF.prodCost]) || 0,
      dir: dirMap[String(r[UF.dir])] || "не указано",
      assort: assortMap[String(r[UF.assort])] || "не указано",
      productType: prodTypeMap[String(r[UF.productType])] || "не указано",
      paymentStatus: payMap[String(r[UF.paymentStatus])] || null,
      needPaint: paintMap[String(r[UF.needPaint])] || null,
      constructor: un(r[UF.constructor]), sourceMgr: un(r[UF.sourceMgr]),
      shopHead1: un(r[UF.shopHead1]), shopHead2: un(r[UF.shopHead2]),
      otk: un(r[UF.otk]), technolog: un(r[UF.technolog]), smetchik: un(r[UF.smetchik]),
      assignedBy: un(r.assignedById),
      hist: histByItem[String(r.id)] || [],
    };
  });

  // Просчёты: открытые сделки воронки 49 на стадиях расчёта - потенциал производства
  // (Расчёт, Формирование ТЗ, КП отправлено, Принимают решение, Долгострой).
  const QUOTE_STAGES: Record<string, string> = {
    "C49:UC_OGZUU0": "Расчёт",
    "C49:PREPARATION": "Формирование ТЗ",
    "C49:PREPAYMENT_INVOIC": "КП отправлено",
    "C49:3": "Принимают решение",
    "C49:UC_8JTBV2": "Долгострой",
  };
  const quoteDeals: any[] = [];
  {
    let start = 0;
    for (;;) {
      const j = await call("crm.deal.list", {
        select: ["ID", "TITLE", "OPPORTUNITY", "ASSIGNED_BY_ID", "STAGE_ID", "DATE_CREATE"],
        filter: { CATEGORY_ID: 49, CLOSED: "N", STAGE_ID: Object.keys(QUOTE_STAGES) },
        start,
      });
      const batch: any[] = j.result || [];
      for (const d of batch) quoteDeals.push({
        id: Number(d.ID), title: d.TITLE || "",
        budget: Number(d.OPPORTUNITY) || 0,
        mgr: userName[String(d.ASSIGNED_BY_ID)] || null,
        stage: QUOTE_STAGES[String(d.STAGE_ID)] || String(d.STAGE_ID),
        created: d10(d.DATE_CREATE),
      });
      if (j.next === undefined || !batch.length) break;
      start = j.next;
    }
  }
  console.log(`Просчёты (потенциал): ${quoteDeals.length} сделок на ${Math.round(quoteDeals.reduce((s, d) => s + d.budget, 0))} ₽`);

  // Предоплаты: события входа сделок в C49:EXECUTING (история стадий, фильтр на сервере).
  // Узел сверки «Продажи -> Производство»: предоплата получена vs передано в цех.
  const prepayEvents: { dealId: string; date: string | null }[] = [];
  {
    let lastId = 0;
    for (;;) {
      const j = await call("crm.stagehistory.list", {
        entityTypeId: 2,
        filter: { STAGE_ID: "C49:EXECUTING", ">ID": lastId },
        order: { ID: "ASC" }, start: -1,
      });
      const batch: any[] = (j.result && j.result.items) || j.result || [];
      if (!batch.length) break;
      for (const h of batch) prepayEvents.push({ dealId: String(h.OWNER_ID ?? h.ownerId), date: d10(h.CREATED_TIME ?? h.createdTime) });
      lastId = Number(batch[batch.length - 1].ID ?? batch[batch.length - 1].id);
      if (batch.length < 50) break;
    }
  }
  // первый вход на сделку
  const firstPrepay: Record<string, string> = {};
  for (const e of prepayEvents) if (e.date && (!firstPrepay[e.dealId] || e.date < firstPrepay[e.dealId])) firstPrepay[e.dealId] = e.date;
  const prepIds = Object.keys(firstPrepay);
  const prepInfo: Record<string, any> = {};
  for (let i = 0; i < prepIds.length; i += 50) {
    const chunk = prepIds.slice(i, i + 50);
    const dl: any[] = (await call("crm.deal.list", { select: ["ID", "OPPORTUNITY", "ASSIGNED_BY_ID", "STAGE_ID", "CLOSED"], filter: { ID: chunk }, start: -1 })).result || [];
    for (const d of dl) prepInfo[String(d.ID)] = d;
  }
  const prepayDeals = prepIds.map((id) => {
    const d = prepInfo[id] || {};
    return {
      id: Number(id), date: firstPrepay[id],
      budget: Number(d.OPPORTUNITY) || 0,
      mgr: userName[String(d.ASSIGNED_BY_ID)] || null,
      stage: String(d.STAGE_ID || ""), open: d.CLOSED === "N",
    };
  });
  console.log(`Предоплаты: ${prepayDeals.length} сделок (событий ${prepayEvents.length})`);

  const out = {
    generated_at: new Date().toISOString(),
    source: "bitrix24:glassmemory:sp1086",
    entityTypeId: ETID,
    counts: { items: items.length, quotes: quoteDeals.length },
    refs: { stageName, stageSem, stageOrder, dirs: dirMap, assort: assortMap, productType: prodTypeMap },
    quotes: { stages: QUOTE_STAGES, deals: quoteDeals },
    prepay: { deals: prepayDeals },
    items,
  };
  mkdirSync("prod/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`Готово: ${items.length} элементов производства -> ${OUT}`);
}

main().catch((e) => { console.error("Коннектор производства упал:", e instanceof Error ? e.message : e); process.exit(1); });
