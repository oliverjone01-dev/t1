// Прямой коннектор Bitrix24 (read-only) -> rop/data/rop.json для дашборда РОП.
// Тянет ВСЕ сделки (по всем воронкам) и ВСЕ лиды, резолвит ID->имена через справочники,
// маппит в схему дашборда (поля MVP). Записи без направления сохраняются как "не указано".
//
// Сеть нужна к glassmemory.bitrix24.ru, поэтому бежит в GitHub Actions (b24-snapshots.yml),
// не в этой песочнице (там хост заблокирован сетевой политикой 403).
//
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/fetch-rop.ts
// Опц.: ROP_DATE_FROM=YYYY-MM-DD ограничивает по дате создания (пусто = всё).

import { writeFileSync, mkdirSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL в окружении"); process.exit(1); }
const OUT = "rop/data/rop.json";
const DATE_FROM = process.env.ROP_DATE_FROM || "";
// Дашборд v1: одна воронка сделок (49 = Заказы GG RF) + лиды всех направлений кроме Glass Memory.
const DEAL_CATEGORY = process.env.ROP_DEAL_CATEGORY || "49";
const EXCLUDE_LEAD_DIRS = (process.env.ROP_EXCLUDE_LEAD_DIRS || "glass-memory")
  .split(",").map((s) => s.trim()).filter(Boolean);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Маппинг кастомных полей сделки (восстановлен из crm.deal.fields, разведка 2026-06-25).
const UF = {
  client: "UF_CRM_1767958427410",                 // тип клиента (B2B/B2C/Дилер...)
  assort: "UF_CRM_DEAL_AMO_NSRJIWLJQEERRQTL",      // ассортимент (Столы/Зеркала...)
  reason: "UF_CRM_DEAL_AMO_ELDDYDEQCJZIKJIM",      // причина провала
  dir: "UF_CRM_69A7F70A18816",                     // бренд/направление сделки
};
const UF_LEAD_DIR = "UF_CRM_1772609158";           // бренд/направление лида

async function call(method: string, params: any = {}): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(30000),
      });
      const j: any = await res.json();
      if (j.error) {
        // rate limit Bitrix (2 req/s) -> подождать и повторить
        if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await sleep(1200); continue; }
        throw new Error(`${method}: ${j.error_description || j.error}`);
      }
      return j;
    } catch (e) {
      lastErr = e;
      await sleep(600 * (attempt + 1));
    }
  }
  throw lastErr;
}

// Быстрая пагинация по ID (start=-1): не считает total, не тормозит на больших объёмах.
async function listAll(method: string, params: any): Promise<any[]> {
  const all: any[] = [];
  let lastId = 0;
  for (;;) {
    const filter = { ...(params.filter || {}), ">ID": lastId };
    const j = await call(method, { ...params, filter, order: { ID: "ASC" }, start: -1 });
    const batch: any[] = j.result || [];
    if (!batch.length) break;
    all.push(...batch);
    lastId = Number(batch[batch.length - 1].ID);
    if (batch.length < 50) break;
  }
  return all;
}

// Обычная пагинация через next (для user.get).
async function pageAll(method: string, params: any): Promise<any[]> {
  const all: any[] = [];
  let start = 0;
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
  for (const it of (field?.items || [])) m[String(it.ID)] = it.VALUE;
  return m;
}
const dayDiff = (a?: string, b?: string): number | null => {
  if (!a || !b) return null;
  const t1 = Date.parse(a), t2 = Date.parse(b);
  if (isNaN(t1) || isNaN(t2)) return null;
  return Math.round(((t2 - t1) / 86400000) * 100) / 100;
};
const d10 = (s?: string) => (s ? String(s).slice(0, 10) : null);

async function main() {
  console.log(`Bitrix -> ${OUT}${DATE_FROM ? ` (с ${DATE_FROM})` : " (всё)"}`);

  // --- Справочники ---
  const statuses: any[] = (await call("crm.status.list", { order: { SORT: "ASC" }, filter: {} })).result || [];
  const stageName: Record<string, string> = {};   // DEAL_STAGE* : STATUS_ID -> NAME
  const leadStatus: Record<string, string> = {};  // STATUS       : STATUS_ID -> NAME
  const sourceName: Record<string, string> = {};  // SOURCE       : STATUS_ID -> NAME
  for (const s of statuses) {
    if (String(s.ENTITY_ID).startsWith("DEAL_STAGE")) stageName[s.STATUS_ID] = s.NAME;
    else if (s.ENTITY_ID === "STATUS") leadStatus[s.STATUS_ID] = s.NAME;
    else if (s.ENTITY_ID === "SOURCE") sourceName[s.STATUS_ID] = s.NAME;
  }
  const cats: any[] = (await call("crm.dealcategory.list", {})).result || [];
  const catName: Record<string, string> = { "0": "Общие" };
  for (const c of cats) catName[String(c.ID)] = c.NAME;

  const users: any[] = await pageAll("user.get", {});
  const mgrName: Record<string, string> = {};
  for (const u of users) mgrName[String(u.ID)] = `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim() || `id${u.ID}`;

  const dealFields: any = (await call("crm.deal.fields", {})).result || {};
  const leadFields: any = (await call("crm.lead.fields", {})).result || {};
  const clientMap = enumMap(dealFields[UF.client]);
  const assortMap = enumMap(dealFields[UF.assort]);
  const reasonMap = enumMap(dealFields[UF.reason]);
  const dirMap = enumMap(dealFields[UF.dir]);
  const leadDirMap = enumMap(leadFields[UF_LEAD_DIR]);
  console.log(`Справочники: стадий ${Object.keys(stageName).length}, источников ${Object.keys(sourceName).length}, менеджеров ${users.length}, воронок ${cats.length}`);

  // --- Сделки: только воронка DEAL_CATEGORY (49 = Заказы GG RF) ---
  const dealSelect = ["ID", "TITLE", "CATEGORY_ID", "STAGE_ID", "ASSIGNED_BY_ID", "OPPORTUNITY",
    "DATE_CREATE", "CLOSEDATE", "BEGINDATE", "SOURCE_ID", UF.client, UF.assort, UF.reason, UF.dir];
  const dateFilter = DATE_FROM ? { ">=DATE_CREATE": DATE_FROM } : {};
  const dealRows = await listAll("crm.deal.list", { select: dealSelect, filter: { CATEGORY_ID: DEAL_CATEGORY, ...dateFilter } });
  const deals = dealRows.map((d) => {
    const sid = String(d.STAGE_ID || "");
    return {
      id: d.ID,
      title: d.TITLE || "",
      mgr: mgrName[String(d.ASSIGNED_BY_ID)] || `id${d.ASSIGNED_BY_ID}`,
      category: Number(DEAL_CATEGORY),
      categoryName: catName[DEAL_CATEGORY] || DEAL_CATEGORY,
      stage: stageName[sid] || sid,
      stageCode: sid,
      won: /:WON$|^WON$/.test(sid),
      lost: /:(LOSE|APOLOGY)$|^(LOSE|APOLOGY)$/.test(sid),
      budget: Number(d.OPPORTUNITY) || 0,
      created: d10(d.DATE_CREATE),
      closed: d10(d.CLOSEDATE),
      cycle: dayDiff(d.DATE_CREATE, d.CLOSEDATE),
      source: sourceName[String(d.SOURCE_ID)] || d.SOURCE_ID || "не указан",
      client: clientMap[String(d[UF.client])] || "нет данных",
      assort: assortMap[String(d[UF.assort])] || "нет данных",
      reason: reasonMap[String(d[UF.reason])] || "не указана",
      dir: dirMap[String(d[UF.dir])] || "не указано",
    };
  });
  console.log(`Сделки воронка ${DEAL_CATEGORY} (${catName[DEAL_CATEGORY] || ""}): ${deals.length}`);

  // --- Лиды: все направления, КРОМЕ Glass Memory ---
  const leadSelect = ["ID", "TITLE", "STATUS_ID", "ASSIGNED_BY_ID", "OPPORTUNITY",
    "DATE_CREATE", "DATE_CLOSED", "SOURCE_ID", UF_LEAD_DIR];
  const leadRows = await listAll("crm.lead.list", { select: leadSelect, filter: { ...dateFilter } });
  const leads = leadRows.map((l) => {
    const st = String(l.STATUS_ID || "");
    return {
      id: l.ID,
      title: l.TITLE || "",
      mgr: mgrName[String(l.ASSIGNED_BY_ID)] || `id${l.ASSIGNED_BY_ID}`,
      status: leadStatus[st] || st,
      statusCode: st,
      converted: st === "CONVERTED",
      junk: st === "JUNK" || ["1", "2", "3"].includes(st),
      budget: Number(l.OPPORTUNITY) || 0,
      created: d10(l.DATE_CREATE),
      closed: d10(l.DATE_CLOSED),
      source: sourceName[String(l.SOURCE_ID)] || l.SOURCE_ID || "не указан",
      dir: leadDirMap[String(l[UF_LEAD_DIR])] || "не указано",
    };
  }).filter((l) => !EXCLUDE_LEAD_DIRS.includes(l.dir));
  console.log(`Лиды (кроме ${EXCLUDE_LEAD_DIRS.join("/")}): ${leads.length} из ${leadRows.length}`);

  const out = {
    generated_at: new Date().toISOString(),
    source: "bitrix24:glassmemory",
    date_from: DATE_FROM || null,
    counts: { deals: deals.length, leads: leads.length },
    refs: {
      managers: mgrName,
      dealStages: stageName,
      leadStatuses: leadStatus,
      categories: catName,
      dirs: dirMap,
    },
    deals,
    leads,
  };
  mkdirSync("rop/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`Готово: сделок ${deals.length}, лидов ${leads.length} -> ${OUT}`);
}

main().catch((e) => { console.error("Коннектор упал:", e instanceof Error ? e.message : e); process.exit(1); });
