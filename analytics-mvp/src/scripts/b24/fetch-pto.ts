// Прямой коннектор Bitrix24 (read-only) -> pto/data/pto.json для дашборда ПТО.
// Смарт-процесс «Расчёт» (entityTypeId=1060): карточки (crm.item.list), история стадий
// (crm.stagehistory.list), товарные строки (штуки), связь со сделкой воронки 49 (parentId2),
// справочники (пользователи, enum-поля, стадии воронки смарта).
//
// Именно здесь живут чертежи: у смарта 13 стадий, и стадии чертежей воронки C49 не имеют.
// Поля разведаны по economics-dashboard-v1:analytics-mvp/economics/data/field-map.json
// (снимок схемы 2026-09-15, смарт etid=1060, 101 поле, 1141 элемент).
//
// Сеть нужна к glassmemory.bitrix24.ru -> бежит только в GitHub Actions (pto-cron.yml).
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/fetch-pto.ts

import { writeFileSync, mkdirSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL в окружении"); process.exit(1); }
const OUT = "pto/data/pto.json";
const ETID = 1060; // смарт «Расчёт»
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// UF-поля карточки расчёта. Проценты - заполненность по снимку схемы 2026-09-15.
const UF = {
  constructor: "ufCrm17_1771906199",        // Конструктор (employee) 98.8%
  executor: "ufCrm17_1774246856",           // Исполнитель/расчёт (employee) 88.5%
  sourceMgr: "ufCrm17_1773571305",          // Источник (менеджер) (employee) 96.2%
  calcKind: "ufCrm17_1773742889",           // Выбрать вид расчета (enum) 89.5%
  qtyText: "ufCrm17_1773903995458",         // Кол-во товара (строка) 88.4%
  drawApproval: "ufCrm17_1787815870895",    // Статус согласования чертежа с клиентом (enum) 9.2%
  dir: "ufCrm17_1773568942",                // Направление бизнеса (enum) 56.5%
  dirSp: "ufCrm17_1773673808",              // Направление СП (enum) 67.9%
  productType: "ufCrm17_1773570721",        // Тип изделия (enum) 91.8%
  assort: "ufCrm17_1773574805",             // Тип ассортимента (enum) 54.6%
  dealIdText: "ufCrm17_1772438553",         // ID сделки (текст, дубль parentId2) 93.6%
  source: "ufCrm17_1772437891",             // Источник (строка) 44.7%
  dateToProd: "ufCrm17_1777569428060",      // Дата передачи заказа в производство 50.2%
  contractDate: "ufCrm17_1773920409054",    // Дата заключения договора 42.3%
  verbalDeadline: "ufCrm17_1773920431309",  // Срок по устной договорённости 43.6%
  readyByContract: "ufCrm17_1789385797337", // Дата готовности по договору 2.5%
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

async function main() {
  console.log(`Bitrix СП Расчёт (${ETID}) -> ${OUT}`);

  const users = await pageAll("user.get", {});
  const userName: Record<string, string> = {};
  for (const u of users) userName[String(u.ID)] = `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim() || `id${u.ID}`;

  const f: any = (await call("crm.item.fields", { entityTypeId: ETID })).result?.fields || {};
  const maps = {
    calcKind: enumMap(f[UF.calcKind]), drawApproval: enumMap(f[UF.drawApproval]),
    dir: enumMap(f[UF.dir]), dirSp: enumMap(f[UF.dirSp]),
    productType: enumMap(f[UF.productType]), assort: enumMap(f[UF.assort]),
  };

  // Стадии воронок смарта. Порядок из crm.status.list по SORT - он и задаёт строки матрицы.
  const cats: any[] = (await call("crm.category.list", { entityTypeId: ETID })).result?.categories || [];
  const stageName: Record<string, string> = {}, stageSem: Record<string, string> = {};
  const stageOrder: string[] = [];
  for (const c of cats) {
    const st: any[] = (await call("crm.status.list", { filter: { ENTITY_ID: `DYNAMIC_${ETID}_STAGE_${c.id}` }, order: { SORT: "ASC" } })).result || [];
    for (const s of st) { stageName[s.STATUS_ID] = s.NAME; stageSem[s.STATUS_ID] = s.SEMANTICS || "P"; stageOrder.push(s.STATUS_ID); }
  }
  console.log(`Справочники: пользователей ${users.length}, воронок ${cats.length}, стадий ${stageOrder.length}`);
  console.log(`Стадии: ${stageOrder.map((s) => `${s}=${stageName[s]}`).join(" · ")}`);

  const rows = await itemsAll(ETID);
  console.log(`Карточек расчёта: ${rows.length}`);

  const histRows = await historyAll(ETID);
  const histByItem: Record<string, [string, string][]> = {};
  for (const h of histRows) {
    const oid = String(h.OWNER_ID ?? h.ownerId ?? h.ENTITY_ID);
    (histByItem[oid] ||= []).push([String(h.STAGE_ID ?? h.stageId), d10(h.CREATED_TIME ?? h.createdTime) || ""]);
  }
  for (const k in histByItem) histByItem[k].sort((a, b) => (a[1] < b[1] ? -1 : 1));
  console.log(`История стадий: ${histRows.length} записей на ${Object.keys(histByItem).length} карточек`);

  const dealIds = [...new Set(rows.map((r) => Number(r.parentId2)).filter(Boolean))];
  const dealInfo: Record<string, any> = {};
  for (let i = 0; i < dealIds.length; i += 50) {
    const dl: any[] = (await call("crm.deal.list", {
      select: ["ID", "TITLE", "OPPORTUNITY", "CATEGORY_ID", "STAGE_ID", "ASSIGNED_BY_ID"],
      filter: { ID: dealIds.slice(i, i + 50) }, start: -1,
    })).result || [];
    for (const d of dl) dealInfo[String(d.ID)] = {
      title: d.TITLE || "", budget: Number(d.OPPORTUNITY) || 0, cat: Number(d.CATEGORY_ID),
      stage: String(d.STAGE_ID), mgr: userName[String(d.ASSIGNED_BY_ID)] || null,
    };
  }
  console.log(`Связь со сделками: ${Object.keys(dealInfo).length} из ${dealIds.length}`);

  // Штуки. Товарные строки надёжнее текстового поля «Кол-во товара»: оно строковое
  // и заполнено на 88%. Берём обе величины и решаем на стороне дашборда.
  const OWNER_T = "T" + ETID.toString(16);
  const qtyByItem: Record<string, number> = {};
  let prTotal = 0, qtyTotal = 0;
  for (const r of rows) {
    try {
      const j = await call("crm.item.productrow.list", { filter: { "=ownerId": r.id, "=ownerType": OWNER_T } });
      const prs: any[] = (j.result && j.result.productRows) || [];
      const q = prs.reduce((x, y) => x + (Number(y.quantity) || 0), 0);
      if (q > 0) { qtyByItem[String(r.id)] = q; prTotal += prs.length; qtyTotal += q; }
    } catch { /* карточка без товарных строк */ }
  }
  console.log(`Товарные строки (${OWNER_T}): ${prTotal} строк, изделий ${Math.round(qtyTotal)} на ${Object.keys(qtyByItem).length} карточках`);

  const un = (v: any) => (v ? userName[String(v)] || `id${v}` : null);
  const numOrNull = (v: any) => { const n = Number(String(v ?? "").replace(",", ".").replace(/[^\d.]/g, "")); return isFinite(n) && n > 0 ? n : null; };

  const items = rows.map((r) => {
    const did = r.parentId2 ? String(r.parentId2) : (r[UF.dealIdText] ? String(r[UF.dealIdText]).replace(/\D/g, "") || null : null);
    const di = did ? dealInfo[did] : null;
    return {
      id: r.id, title: r.title || "",
      dealId: did, dealTitle: di?.title ?? null, dealBudget: di?.budget ?? null,
      dealCat: di?.cat ?? null, dealMgr: di?.mgr ?? null,
      stageCode: r.stageId, stage: stageName[r.stageId] || r.stageId, sem: stageSem[r.stageId] || "P",
      created: d10(r.createdTime), moved: d10(r.movedTime), updated: d10(r.updatedTime),
      begin: d10(r.begindate), close: d10(r.closedate),
      dateToProd: d10(r[UF.dateToProd]), contractDate: d10(r[UF.contractDate]),
      verbalDeadline: d10(r[UF.verbalDeadline]), readyByContract: d10(r[UF.readyByContract]),
      opportunity: Number(r.opportunity) || 0,
      constructor: un(r[UF.constructor]), executor: un(r[UF.executor]), sourceMgr: un(r[UF.sourceMgr]),
      calcKind: maps.calcKind[String(r[UF.calcKind])] || null,
      drawApproval: maps.drawApproval[String(r[UF.drawApproval])] || null,
      dir: maps.dir[String(r[UF.dir])] || "не указано",
      dirSp: maps.dirSp[String(r[UF.dirSp])] || "не указано",
      productType: maps.productType[String(r[UF.productType])] || "не указано",
      assort: maps.assort[String(r[UF.assort])] || "не указано",
      source: r[UF.source] || null,
      // qty - из товарных строк; qtyText - то, что руками написал менеджер. Они расходятся,
      // и дашборд обязан показывать, каким из двух он считает «поштучно».
      qty: qtyByItem[String(r.id)] ?? null,
      qtyText: numOrNull(r[UF.qtyText]),
      hist: histByItem[String(r.id)] || [],
    };
  });

  const out = {
    generated_at: new Date().toISOString(),
    source: "bitrix24:glassmemory", entityTypeId: ETID, smartTitle: "Расчёт",
    counts: {
      items: items.length, withHist: items.filter((i) => i.hist.length).length,
      withDeal: items.filter((i) => i.dealId).length,
      withQty: items.filter((i) => i.qty != null).length,
      qtySum: Math.round(items.reduce((s, i) => s + (i.qty || 0), 0)),
    },
    refs: { stageName, stageSem, stageOrder, categories: cats.map((c: any) => ({ id: c.id, name: c.name })) },
    items,
  };
  mkdirSync("pto/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`-> ${OUT}: карточек ${items.length}, с историей ${out.counts.withHist}, со сделкой ${out.counts.withDeal}, штук ${out.counts.qtySum}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
