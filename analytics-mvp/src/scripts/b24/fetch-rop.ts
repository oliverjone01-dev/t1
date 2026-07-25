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
  reason: "UF_CRM_DEAL_AMO_ELDDYDEQCJZIKJIM",      // legacy enum «Причина отказа» (старые сделки)
  reasonComment: "UF_CRM_1768574645865",           // текущее поле «Комментарий к отказу» (свободный текст, свежие отказы)
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

// История стадий (crm.stagehistory.list): result.items, пагинация по ID. Для воронки/dwell.
async function listHistory(category: string): Promise<any[]> {
  const all: any[] = [];
  let lastId = 0;
  for (;;) {
    const j = await call("crm.stagehistory.list", {
      entityTypeId: 2,
      filter: { CATEGORY_ID: Number(category), ">ID": lastId },
      order: { ID: "ASC" }, start: -1,
    });
    const batch: any[] = (j.result && j.result.items) || [];
    if (!batch.length) break;
    all.push(...batch);
    lastId = Number(batch[batch.length - 1].ID);
    if (batch.length < 50) break;
  }
  return all;
}

// Касания: crm.activity.list по сделкам (OWNER_TYPE_ID=2) -> на сделку {real, all}.
// Решение Ивана 2026-06-26: касанием считаем ЛЮБУЮ активность по сделке - звонок,
// письмо, встреча, чат, СМС, а также задачи/туду/комментарии/складские документы.
// touchReal == touchAll (различия по типам сейчас не делаем).
async function activityCounts(): Promise<Record<string, { real: number; all: number }>> {
  const m: Record<string, { real: number; all: number }> = {};
  let lastId = 0, total = 0;
  for (;;) {
    const j = await call("crm.activity.list", {
      select: ["ID", "OWNER_ID"],
      filter: { OWNER_TYPE_ID: 2, ">ID": lastId }, order: { ID: "ASC" }, start: -1,
    });
    const batch: any[] = j.result || [];
    if (!batch.length) break;
    for (const a of batch) {
      const k = String(a.OWNER_ID);
      const e = (m[k] ||= { real: 0, all: 0 });
      e.all++; e.real++;
    }
    total += batch.length;
    lastId = Number(batch[batch.length - 1].ID);
    if (batch.length < 50) break;
  }
  console.log(`Касания: ${total} активностей по сделкам на ${Object.keys(m).length} сделок`);
  return m;
}

// Ближайшее ОТКРЫТОЕ дело/задача по сделке: срок (DEADLINE, иначе END_TIME) + тема.
// Одно сметание по всем незавершённым активностям (COMPLETED=N), не по одной сделке.
// Нужно для РОП-таблицы: «на какой срок менеджер сдвинул дело» и «сколько без дела / просрочено».
async function openTasks(): Promise<Record<string, { due: string; subj: string }>> {
  const m: Record<string, { due: string; subj: string }> = {};
  let lastId = 0, total = 0;
  for (;;) {
    const j = await call("crm.activity.list", {
      select: ["ID", "OWNER_ID", "SUBJECT", "DEADLINE", "END_TIME"],
      filter: { OWNER_TYPE_ID: 2, COMPLETED: "N", ">ID": lastId }, order: { ID: "ASC" }, start: -1,
    });
    const batch: any[] = j.result || [];
    if (!batch.length) break;
    for (const a of batch) {
      const k = String(a.OWNER_ID);
      const raw = a.DEADLINE && !String(a.DEADLINE).startsWith("0000") ? a.DEADLINE : a.END_TIME;
      if (!raw) continue;
      const prev = m[k];
      if (!prev || String(raw) < prev.due) m[k] = { due: String(raw), subj: a.SUBJECT || "" };
    }
    total += batch.length;
    lastId = Number(batch[batch.length - 1].ID);
    if (batch.length < 50) break;
  }
  console.log(`Открытые дела: ${total} активностей, ближайшее дело есть у ${Object.keys(m).length} сделок`);
  return m;
}

// Обычная пагинация через next (для user.get).
// Каналы коммуникации по МЕНЕДЖЕРУ за 90 дней: звонки/письма/мессенджеры (вх/исх).
// Атрибуция «по владельцу»: активность привязана к лиду/сделке/контакту/компании, а те -
// к менеджеру (владельцу лида или сделки воронки 49). Клиентское общение в основном идёт
// на стадии ЛИДА, поэтому считаем лиды + сделки менеджера. ГМ и прочие воронки не попадают,
// т.к. их сделки/лиды не в наших картах. SMS/уведомления исключены. Один проход по активностям
// с защитой по времени, чтобы не подвесить ночной снимок.
async function channelMix(
  dealRows: any[], leadRows: any[], mgrName: Record<string, string>,
): Promise<{ byMgr: Record<string, any>; touch: Record<string, string> }> {
  const nameOf = (id: any) => mgrName[String(id)] || `id${id}`;
  const dealOwner: Record<string, string> = {}, contactOwner: Record<string, string> = {},
    companyOwner: Record<string, string> = {}, leadOwner: Record<string, string> = {};
  for (const d of dealRows) {
    const mgr = nameOf(d.ASSIGNED_BY_ID);
    dealOwner[String(d.ID)] = mgr;
    if (d.CONTACT_ID && String(d.CONTACT_ID) !== "0") contactOwner[String(d.CONTACT_ID)] = mgr;
    if (d.COMPANY_ID && String(d.COMPANY_ID) !== "0") companyOwner[String(d.COMPANY_ID)] = mgr;
  }
  for (const l of leadRows) leadOwner[String(l.ID)] = nameOf(l.ASSIGNED_BY_ID);
  const chanOf = (a: any): "call" | "email" | "msg" | null => {
    const p = String(a.PROVIDER_ID || "").toUpperCase(), t = String(a.TYPE_ID);
    if (p.includes("IMOPENLINES") || p.includes("IMCONNECTOR") || p.includes("IMOL")) return "msg";
    if (p.includes("SMS") || p.includes("NOTIFICATION") || p.includes("REST_APP")) return null;
    if (t === "2" || p.includes("CALL") || p.includes("VOX")) return "call";
    if (t === "4" || p.includes("EMAIL") || p.includes("MAIL")) return "email";
    return null;
  };
  const ownerOf = (a: any): string | undefined => {
    const t = String(a.OWNER_TYPE_ID), id = String(a.OWNER_ID);
    if (t === "1") return leadOwner[id];
    if (t === "2") return dealOwner[id];
    if (t === "3") return contactOwner[id];
    if (t === "4") return companyOwner[id];
    return undefined;
  };
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const by: Record<string, any> = {};
  // touch[`${OWNER_TYPE_ID}:${OWNER_ID}`] = дата последнего реального касания (звонок/письмо/мессенджер).
  // Нужно для «последнее касание по сделке»: был ли ФАКТ связи, а не только запланированное дело.
  const touch: Record<string, string> = {};
  const mk = () => ({ call_in: 0, call_out: 0, email_in: 0, email_out: 0, msg_in: 0, msg_out: 0 });
  const t0 = Date.now(), CAP_MS = 6 * 60 * 1000, CAP_PAGES = 6000;
  let last = 0, scanned = 0, attr = 0;
  for (let i = 0; i < CAP_PAGES; i++) {
    if (Date.now() - t0 > CAP_MS) { console.warn("channelMix: стоп по времени (6 мин), частичные данные"); break; }
    const j = await call("crm.activity.list", {
      select: ["ID", "OWNER_TYPE_ID", "OWNER_ID", "TYPE_ID", "PROVIDER_ID", "DIRECTION", "CREATED"],
      filter: { ">=CREATED": since, ">ID": last }, order: { ID: "ASC" }, start: -1,
    });
    const b: any[] = j.result || [];
    if (!b.length) break;
    for (const a of b) {
      scanned++;
      const c = chanOf(a); if (!c) continue;
      // дата касания по владельцу (для per-deal «последнее касание»)
      const ownKey = `${a.OWNER_TYPE_ID}:${a.OWNER_ID}`;
      const day = d10(a.CREATED) || "";
      if (day && (!touch[ownKey] || day > touch[ownKey])) touch[ownKey] = day;
      const mgr = ownerOf(a); if (!mgr) continue;
      const d = String(a.DIRECTION) === "1" ? "in" : String(a.DIRECTION) === "2" ? "out" : "out";
      const key = `${c}_${d}`;
      const m = by[mgr] || (by[mgr] = mk());
      m[key]++; attr++;
    }
    last = Number(b[b.length - 1].ID);
    if (b.length < 50) break;
  }
  console.log(`Каналы (90 дн): просмотрено ${scanned}, привязано к менеджерам ${attr}, менеджеров ${Object.keys(by).length}, точек касания ${Object.keys(touch).length}`);
  return { byMgr: by, touch };
}

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
// часы «создан → закрыт»: для лидов, которые закрывают в тот же день (медиана в днях = 0)
const hourDiff = (a?: string, b?: string) => (a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 36e5)) : null);

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
  const nmOf = (u: any) => `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim();
  const firedSet = new Set<string>();
  for (const u of users) {
    const nm = nmOf(u) || `id${u.ID}`;
    mgrName[String(u.ID)] = nm;
    // ACTIVE может прийти как boolean или "Y"/"N"; уволенные = неактивные аккаунты.
    const active = u.ACTIVE === true || u.ACTIVE === "Y" || u.ACTIVE === 1 || u.ACTIVE === "1";
    if (nm && u.ACTIVE !== undefined && !active) firedSet.add(nm);
  }
  // Bitrix по умолчанию может отдавать только активных - добираем уволенных явным фильтром.
  try {
    const inactive: any[] = await pageAll("user.get", { ACTIVE: false });
    for (const u of inactive) {
      const nm = nmOf(u);
      if (nm) { firedSet.add(nm); if (!mgrName[String(u.ID)]) mgrName[String(u.ID)] = nm; }
    }
  } catch (e) {
    console.warn("user.get ACTIVE=false недоступен:", e instanceof Error ? e.message : e);
  }
  const firedManagers = [...firedSet];
  console.log(`Уволенных сотрудников (ACTIVE=false): ${firedManagers.length}`);

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
    "DATE_CREATE", "CLOSEDATE", "BEGINDATE", "LAST_ACTIVITY_TIME", "SOURCE_ID",
    "CONTACT_ID", "COMPANY_ID", UF.client, UF.assort, UF.reason, UF.reasonComment, UF.dir];
  const dateFilter = DATE_FROM ? { ">=DATE_CREATE": DATE_FROM } : {};
  const dealRows = await listAll("crm.deal.list", { select: dealSelect, filter: { CATEGORY_ID: DEAL_CATEGORY, ...dateFilter } });
  // История стадий -> на каждую сделку массив [STAGE_ID, дата входа], отсортированный.
  const histRows = await listHistory(DEAL_CATEGORY);
  const histByDeal: Record<string, [string, string][]> = {};
  for (const h of histRows) {
    const oid = String(h.OWNER_ID);
    (histByDeal[oid] ||= []).push([String(h.STAGE_ID), d10(h.CREATED_TIME) || ""]);
  }
  for (const k in histByDeal) histByDeal[k].sort((a, b) => (a[1] < b[1] ? -1 : 1));
  console.log(`История стадий: ${histRows.length} записей на ${Object.keys(histByDeal).length} сделок`);
  // Касания (звонки/письма/встречи/чаты) по каждой сделке.
  const acts = await activityCounts();
  const tasks = await openTasks();
  const deals = dealRows.map((d) => {
    const ac = acts[String(d.ID)] || { real: 0, all: 0 };
    const tk = tasks[String(d.ID)];
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
      activity: d10(d.LAST_ACTIVITY_TIME),
      taskDue: tk ? d10(tk.due) : null,
      taskSubj: tk ? tk.subj : null,
      closed: d10(d.CLOSEDATE),
      cycle: dayDiff(d.DATE_CREATE, d.CLOSEDATE),
      source: sourceName[String(d.SOURCE_ID)] || d.SOURCE_ID || "не указан",
      client: clientMap[String(d[UF.client])] || "нет данных",
      assort: assortMap[String(d[UF.assort])] || "нет данных",
      // Причина отказа: сначала текущее свободное поле «Комментарий к отказу»,
      // иначе старый enum «Причина отказа» (старые сделки), иначе «не указана».
      reason: (String(d[UF.reasonComment] ?? "").trim()) || reasonMap[String(d[UF.reason])] || "не указана",
      dir: dirMap[String(d[UF.dir])] || "не указано",
      hist: histByDeal[String(d.ID)] || [],
      touchReal: ac.real, touchAll: ac.all,
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
      cycleH: hourDiff(l.DATE_CREATE, l.DATE_CLOSED),
      source: sourceName[String(l.SOURCE_ID)] || l.SOURCE_ID || "не указан",
      dir: leadDirMap[String(l[UF_LEAD_DIR])] || "не указано",
    };
  }).filter((l) => !EXCLUDE_LEAD_DIRS.includes(l.dir));
  console.log(`Лиды (кроме ${EXCLUDE_LEAD_DIRS.join("/")}): ${leads.length} из ${leadRows.length}`);

  // Каналы коммуникации по менеджеру (лиды + сделки воронки 49), 90 дней.
  const channels = await channelMix(dealRows, leadRows, mgrName);
  // «Последнее касание» по каждой сделке: макс. дата звонка/письма/мессенджера по самой сделке,
  // её контакту или компании. Нужно, чтобы видеть ФАКТ связи, а не только запланированное дело.
  const touch = channels.touch;
  const dealRowById: Record<string, any> = {};
  for (const d of dealRows) dealRowById[String(d.ID)] = d;
  for (const dl of deals) {
    const raw = dealRowById[String(dl.id)];
    const keys = [`2:${dl.id}`];
    if (raw && raw.CONTACT_ID && String(raw.CONTACT_ID) !== "0") keys.push(`3:${raw.CONTACT_ID}`);
    if (raw && raw.COMPANY_ID && String(raw.COMPANY_ID) !== "0") keys.push(`4:${raw.COMPANY_ID}`);
    let mx: string | null = null;
    for (const k of keys) { const t = touch[k]; if (t && (!mx || t > mx)) mx = t; }
    (dl as any).lastTouch = mx; // дата (YYYY-MM-DD) или null, если касаний за 90 дней не было
  }
  const touchedDeals = deals.filter((d: any) => d.lastTouch).length;
  console.log(`Последнее касание проставлено у ${touchedDeals} из ${deals.length} сделок`);

  // --- Карточки производства (СП 1086): id, сделка, дата запуска, изделий ---
  // Нужны сквозной воронке «предоплаты -> сделки -> позиции -> изделия» (раздел 4).
  // Та же логика, что в fetch-prod: запуск = Дата передачи в производство || первый вход в стадию || создание.
  const ETID = 1086, OWNER_T = "T" + ETID.toString(16), UF_D2P = "ufCrm23_1777569335541";
  const spRows: any[] = [];
  {
    let lastId = 0;
    for (;;) {
      const j = await call("crm.item.list", {
        entityTypeId: ETID, select: ["id", "parentId2", "createdTime", UF_D2P],
        filter: { ">id": lastId }, order: { id: "ASC" }, start: -1,
      });
      const batch: any[] = (j.result && j.result.items) || [];
      if (!batch.length) break;
      spRows.push(...batch);
      lastId = Number(batch[batch.length - 1].id);
      if (batch.length < 50) break;
    }
  }
  const spFirst: Record<string, string> = {};
  {
    let lastId = 0;
    for (;;) {
      const j = await call("crm.stagehistory.list", { entityTypeId: ETID, filter: { ">ID": lastId }, order: { ID: "ASC" }, start: -1 });
      const batch: any[] = (j.result && j.result.items) || [];
      if (!batch.length) break;
      for (const h of batch) {
        const oid = String(h.OWNER_ID ?? h.ownerId), dt = d10(h.CREATED_TIME ?? h.createdTime) || "";
        if (dt && (!spFirst[oid] || dt < spFirst[oid])) spFirst[oid] = dt;
      }
      lastId = Number(batch[batch.length - 1].ID);
      if (batch.length < 50) break;
    }
  }
  const prodItems: any[] = [];
  let spQtyTotal = 0;
  for (const r of spRows) {
    let qty: number | null = null;
    try {
      const j = await call("crm.item.productrow.list", { filter: { "=ownerId": r.id, "=ownerType": OWNER_T } });
      const prs: any[] = (j.result && j.result.productRows) || [];
      const q = prs.reduce((x, y) => x + (Number(y.quantity) || 0), 0);
      if (q > 0) { qty = q; spQtyTotal += q; }
    } catch { /* карточка без товарных строк */ }
    prodItems.push({
      id: r.id,
      dealId: r.parentId2 ? String(r.parentId2) : null,
      start: d10(r[UF_D2P]) || spFirst[String(r.id)] || d10(r.createdTime),
      qty,
    });
  }
  console.log(`Карточки производства: ${prodItems.length}, изделий из товарных строк ${Math.round(spQtyTotal)}`);

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
    prodItems,
    firedManagers,
    channelMix: channels.byMgr,
  };
  mkdirSync("rop/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`Готово: сделок ${deals.length}, лидов ${leads.length} -> ${OUT}`);
}

main().catch((e) => { console.error("Коннектор упал:", e instanceof Error ? e.message : e); process.exit(1); });
