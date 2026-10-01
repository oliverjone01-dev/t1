// Полная карта полей: сделка (воронка 49) + все смарт-процессы.
// Для каждого поля: код (ID), название, тип, обязательность, справочник значений,
// заполненность (% непустых) и число уникальных значений (1 = «не передаёт информацию»),
// плюс поля-связи (parentId -> сделка/смарт). Для работы с РОПом: какие поля лишние/пустые.
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/field-map.ts
import { writeFileSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const CAT = 49;
const DEAL_SINCE = process.env.FIELDMAP_SINCE || "2026-01-01"; // окно для заполненности сделок
const OUT = "economics/data/field-map.json";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

const isEmpty = (v: any) => v === null || v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0);
const norm = (v: any) => Array.isArray(v) ? v.join("|") : String(v);

// заполненность + уникальность по набору строк
function fillStats(rows: any[], codes: string[]) {
  const st: Record<string, { filled: number; distinct: Set<string> }> = {};
  for (const c of codes) st[c] = { filled: 0, distinct: new Set() };
  for (const r of rows) for (const c of codes) {
    const v = r[c];
    if (!isEmpty(v)) { st[c].filled++; if (st[c].distinct.size <= 60) st[c].distinct.add(norm(v)); }
  }
  const out: Record<string, { filled: number; distinct: number }> = {};
  for (const c of codes) out[c] = { filled: st[c].filled, distinct: st[c].distinct.size };
  return out;
}

// человекочитаемая метка UF-поля (может быть строкой или объектом {ru:..,en:..})
function pickLabel(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") { const o: any = v; return String(o.ru || o.en || Object.values(o)[0] || "").trim(); }
  return "";
}
// нормализуем описание поля из crm.item.fields / crm.deal.fields
function fieldRow(code: string, def: any) {
  const type = def.type || def.userTypeId || "";
  const title = def.title || def.formLabel || def.listLabel || def.editFormLabel || code;
  const items = (def.items || def.LIST || []).map ? (def.items || []).map((it: any) => ({ id: it.ID ?? it.id ?? it.value, val: it.VALUE ?? it.value })) : [];
  const linky = /crm|iblock_element|employee|binding/i.test(String(type)) || /^parentId/i.test(code) || /^PARENT_ID_/i.test(code) || /_link$/i.test(code);
  return {
    code,
    title,
    type,
    required: !!(def.isRequired || def.isRequiredByBusinessLogic),
    readonly: !!def.isReadOnly,
    multiple: !!def.isMultiple,
    isLink: linky,
    items: items.slice(0, 40),
  };
}

// Значение поля для сравнения лид и сделки: списки по тексту значения (ID у лида и сделки разные),
// деньги без валюты, даты по дню, строки без регистра. Пустое -> "".
function cmpVal(v: any, items: any[]): string {
  if (isEmpty(v)) return "";
  const byId: Record<string, string> = {};
  for (const it of items || []) byId[String(it.ID ?? it.id)] = String(it.VALUE ?? it.value ?? "");
  const one = (x: any): string => {
    let s = String(x ?? "").trim();
    if (byId[s] !== undefined) s = byId[s];
    if (/^-?\d+(\.\d+)?\|[A-Z]{3}$/.test(s)) s = String(parseFloat(s));
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) s = s.slice(0, 10);
    return s.toLowerCase();
  };
  return Array.isArray(v) ? v.map(one).filter(Boolean).sort().join("|") : one(v);
}

async function leadMap(dfs: Record<string, any>, dealCard: string[], dealFields: any[]) {
  const stages: any[] = ((await call("crm.status.list", { filter: { ENTITY_ID: "STATUS" }, order: { SORT: "ASC" } })).result || [])
    .map((s: any) => ({ id: s.STATUS_ID, name: s.NAME, sort: Number(s.SORT), semantics: s.SEMANTICS || (s.EXTRA && s.EXTRA.SEMANTICS) || "" }));
  console.error("LEAD-STAGES\t" + stages.map((s) => `${s.id}:${s.name}`).join(" | "));
  const lfs: Record<string, any> = (await call("crm.lead.fields", {})).result || {};
  const labels: Record<string, string> = {};
  try {
    for (const u of await pageAll("crm.lead.userfield.list", {})) { const lab = pickLabel(u.EDIT_FORM_LABEL) || pickLabel(u.LIST_COLUMN_LABEL); if (u.FIELD_NAME && lab) labels[u.FIELD_NAME] = lab; }
  } catch (e) { console.error("LEAD-UF-FAIL", String(e)); }
  const onCard = new Set<string>(); const section: Record<string, string> = {}; const secOrder: string[] = [];
  try {
    const cfgRaw: any = (await call("crm.lead.details.configuration.get", { scope: "C" })).result;
    const cfg: any[] = Array.isArray(cfgRaw) ? cfgRaw : (cfgRaw && cfgRaw.data) || [];
    for (const sec of cfg) { const st = String(sec.title || sec.name || "").trim(); if (st && !secOrder.includes(st)) secOrder.push(st); for (const el of (sec.elements || [])) if (el && el.name) { onCard.add(el.name); if (!section[el.name]) section[el.name] = st; } }
  } catch (e) { console.error("LEAD-CARD-FAIL", String(e)); }
  // Контактные поля лида (телефон, почта, мессенджеры, сайт, ФИО, адрес) не выгружаем: только их схема.
  const CONTACT = new Set(["PHONE", "EMAIL", "IM", "WEB", "NAME", "SECOND_NAME", "LAST_NAME", "ADDRESS", "BIRTHDATE"]);
  const codes = Object.keys(lfs).filter((c) => !CONTACT.has(c) && !/^ADDRESS_/.test(c));
  const leads = await pageAll("crm.lead.list", { filter: { ">=DATE_CREATE": DEAL_SINCE }, select: codes, order: { ID: "DESC" } });
  const stats = fillStats(leads, codes);
  const fields = Object.keys(lfs).map((c) => {
    const f = fieldRow(c, lfs[c]); if (labels[c]) f.title = labels[c]; const s = stats[c];
    return { ...f, onCard: onCard.size ? onCard.has(c) : null, section: section[c] || "", filled: s ? s.filled : null, total: s ? leads.length : 0, fillPct: s && leads.length ? Math.round(1000 * s.filled / leads.length) / 10 : null, distinct: s ? s.distinct : null };
  });
  // Пары «лид -> сделка 49» за то же окно: для каждого поля лида ищем поле сделки,
  // в котором после конверсии то же значение (не меньше 80% пар, минимум 5 пар).
  const STD = ["OPPORTUNITY", "CURRENCY_ID", "SOURCE_ID", "SOURCE_DESCRIPTION", "COMMENTS", "ASSIGNED_BY_ID", "UTM_SOURCE", "UTM_MEDIUM", "UTM_CAMPAIGN", "UTM_CONTENT", "UTM_TERM"];
  const dCodes = [...new Set([...dealCard.filter((c) => c !== "ID"), ...STD])].filter((c) => dfs[c]);
  const deals = await pageAll("crm.deal.list", { filter: { CATEGORY_ID: CAT, ">=DATE_CREATE": DEAL_SINCE, ">LEAD_ID": 0 }, select: ["ID", "LEAD_ID", ...dCodes], order: { ID: "DESC" } });
  const leadById: Record<string, any> = {}; for (const l of leads) leadById[String(l.ID)] = l;
  const pairs = deals.filter((d) => leadById[String(d.LEAD_ID)]).map((d) => [leadById[String(d.LEAD_ID)], d]);
  const dealTitle: Record<string, string> = {}; for (const f of dealFields) dealTitle[f.code] = f.title;
  const SKIP = new Set(["ID", "STATUS_ID", "STATUS_SEMANTIC_ID", "DATE_CREATE", "DATE_MODIFY", "DATE_CLOSED", "CREATED_BY_ID", "MODIFY_BY_ID", "MOVED_BY_ID", "MOVED_TIME", "LAST_ACTIVITY_TIME", "LAST_ACTIVITY_BY", "IS_RETURN_CUSTOMER", "IS_MANUAL_OPPORTUNITY", "OPENED", "CONTACT_ID", "CONTACT_IDS", "COMPANY_ID"]);
  const toDeal: any[] = [];
  for (const lc of codes) {
    if (SKIP.has(lc)) continue;
    const lv = pairs.map(([l]) => cmpVal(l[lc], lfs[lc].items));
    const idx = lv.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 5 || new Set(idx.map((i) => lv[i])).size < 2) continue;
    let best: any = null;
    for (const dc of dCodes) {
      let eq = 0; for (const i of idx) if (cmpVal(pairs[i][1][dc], dfs[dc].items) === lv[i]) eq++;
      const r = eq / idx.length;
      if (!best || r > best.r) best = { dc, r };
    }
    if (best && best.r >= 0.8) toDeal.push({ lead: lc, leadTitle: labels[lc] || fieldRow(lc, lfs[lc]).title, deal: best.dc, dealTitle: dealTitle[best.dc] || best.dc, pairs: idx.length, matchPct: Math.round(1000 * best.r) / 10 });
  }
  console.error(`LEAD\tполей ${fields.length}\tлидов ${leads.length}\tпар лид-сделка ${pairs.length}\tполей в сделку ${toDeal.length}`);
  return { entity: "crm.lead", stages, fieldCount: fields.length, leadCount: leads.length, cardFieldCount: onCard.size, cardSectionOrder: secOrder, fields, pairs: pairs.length, toDeal };
}

async function main() {
  // 1) типы смартов
  const types: any[] = (await call("crm.type.list", {})).result?.types || [];
  const smartTypes = types.map((t) => ({ etid: Number(t.entityTypeId), title: t.title })).filter((t) => t.etid >= 1000);
  console.error("SMARTS\t" + smartTypes.map((t) => `${t.etid}:${t.title}`).join(" | "));

  // 2) СДЕЛКА: схема + заполненность
  const dfs: Record<string, any> = (await call("crm.deal.fields", {})).result || {};
  const dealCodes = Object.keys(dfs);
  // человекочитаемые названия UF-полей сделки (crm.deal.fields для UF отдаёт title=код).
  // userfield.list пагинируется по 50 - листаем ВСЕ страницы, иначе имена не подтянутся.
  const ufLabels: Record<string, string> = {};
  try {
    const ufs: any[] = await pageAll("crm.deal.userfield.list", {});
    for (const u of ufs) { const lab = pickLabel(u.EDIT_FORM_LABEL) || pickLabel(u.LIST_COLUMN_LABEL) || pickLabel(u.LIST_FILTER_LABEL); if (u.FIELD_NAME && lab) ufLabels[u.FIELD_NAME] = lab; }
    console.error(`DEAL-UF-LABELS\t${Object.keys(ufLabels).length}\tиз ${ufs.length} UF`);
  } catch (e) { console.error("USERFIELD-FAIL", String(e)); }
  // поля, НАСТРОЕННЫЕ на карточке сделки воронки 49 (и заполненные, и пустые), + раздел карточки
  const onCard = new Set<string>();
  const cardSection: Record<string, string> = {};
  const cardSectionOrder: string[] = [];
  const cardTitle: Record<string, string> = {}; // название поля с карточки (что видит пользователь)
  try {
    for (const params of [{ scope: "C", extras: { dealCategoryId: CAT } }, { scope: "C" }] as any[]) {
      const cfgRaw: any = (await call("crm.deal.details.configuration.get", params)).result;
      const cfg: any[] = Array.isArray(cfgRaw) ? cfgRaw : (cfgRaw && cfgRaw.data) || [];
      if (cfg[0]) console.error("CARD-EL-SAMPLE\t" + JSON.stringify((cfg[0].elements || [])[0] || cfg[0]).slice(0, 300));
      for (const sec of cfg) {
        const st = String(sec.title || sec.name || "").trim();
        if (st && !cardSectionOrder.includes(st)) cardSectionOrder.push(st);
        for (const el of (sec.elements || [])) if (el && el.name) { onCard.add(el.name); if (!cardSection[el.name]) cardSection[el.name] = st; const t = pickLabel(el.title); if (t) cardTitle[el.name] = t; }
      }
      if (onCard.size) break;
    }
    console.error(`DEAL-CARD-FIELDS\t${onCard.size}\tразделов ${cardSectionOrder.length}\tназваний с карточки ${Object.keys(cardTitle).length}`);
  } catch (e) { console.error("CARD-CFG-FAIL", String(e)); }
  // Доп. источник названий: универсальный crm.item.fields(entityTypeId=2) отдаёт UF с title (в camelCase-кодах).
  const itemLabels: Record<string, string> = {};
  try {
    const df2: Record<string, any> = (await call("crm.item.fields", { entityTypeId: 2 })).result?.fields || {};
    const norm = (c: string) => c.replace(/^ufCrm\d*_/i, "UF_CRM_").replace(/^ufCrm\d*/i, "UF_CRM").toUpperCase();
    let s0 = "";
    for (const [k, v] of Object.entries(df2)) { const t = pickLabel((v as any).title); if (t) { itemLabels[norm(k)] = t; if (!s0 && /^ufCrm/i.test(k)) { s0 = k; console.error("ITEM2-SAMPLE\t" + k + " -> " + norm(k) + " = " + t); } } }
    console.error(`DEAL-ITEM2-LABELS\t${Object.keys(itemLabels).length}`);
  } catch (e) { console.error("ITEM2-FAIL", String(e)); }
  // заполненность считаем только по полям карточки (быстрее в разы), если карточка известна
  const selCodes = onCard.size ? dealCodes.filter((c) => onCard.has(c) || c === "ID") : dealCodes;
  const dealRows = await pageAll("crm.deal.list", { filter: { CATEGORY_ID: CAT, ">=DATE_CREATE": DEAL_SINCE }, select: selCodes, order: { ID: "DESC" } });
  console.error(`DEAL\tполей карточки ${selCodes.length}/${dealCodes.length}\tсделок ${dealRows.length}`);
  const dealStats = fillStats(dealRows, selCodes);
  const dealFields = dealCodes.map((c) => {
    const f = fieldRow(c, dfs[c]); const s = dealStats[c] || { filled: 0, distinct: 0 };
    const lab = cardTitle[c] || itemLabels[c] || ufLabels[c];
    if (lab) f.title = lab;
    const onCardVal = onCard.size ? onCard.has(c) : null;
    const measured = !!dealStats[c];
    return { ...f, onCard49: onCardVal, section: cardSection[c] || "", filled: s.filled, total: measured ? dealRows.length : 0, fillPct: measured && dealRows.length ? Math.round(1000 * s.filled / dealRows.length) / 10 : 0, distinct: s.distinct };
  });

  // 3) СМАРТЫ: схема + заполненность
  const smarts: any[] = [];
  for (const sp of smartTypes) {
    let fields: Record<string, any>;
    try { fields = (await call("crm.item.fields", { entityTypeId: sp.etid })).result?.fields || {}; } catch { continue; }
    const codes = Object.keys(fields);
    // поля, НАСТРОЕННЫЕ на карточке смарта, + разделы + названия с карточки
    const spOnCard = new Set<string>(); const spSection: Record<string, string> = {}; const spSecOrder: string[] = []; const spTitle: Record<string, string> = {};
    try {
      for (const params of [{ entityTypeId: sp.etid, scope: "C" }, { entityTypeId: sp.etid }] as any[]) {
        const cfgRaw: any = (await call("crm.item.details.configuration.get", params)).result;
        const cfg: any[] = Array.isArray(cfgRaw) ? cfgRaw : (cfgRaw && cfgRaw.data) || [];
        for (const sec of cfg) { const st = String(sec.title || sec.name || "").trim(); if (st && !spSecOrder.includes(st)) spSecOrder.push(st); for (const el of (sec.elements || [])) if (el && el.name) { spOnCard.add(el.name); if (!spSection[el.name]) spSection[el.name] = st; const t = pickLabel(el.title); if (t) spTitle[el.name] = t; } }
        if (spOnCard.size) break;
      }
    } catch (e) { console.error(`SP-CARD-FAIL\t${sp.etid}\t${String(e)}`); }
    let rows: any[] = [];
    try { rows = await itemsAll(sp.etid, codes); } catch (e) { console.error(`ITEMS-FAIL\t${sp.title}\t${String(e)}`); }
    const stats = fillStats(rows, codes);
    const outFields = codes.map((c) => {
      const f = fieldRow(c, fields[c]); const s = stats[c];
      if (spTitle[c]) f.title = spTitle[c];
      return { ...f, onCard: spOnCard.size ? spOnCard.has(c) : null, section: spSection[c] || "", filled: s.filled, total: rows.length, fillPct: rows.length ? Math.round(1000 * s.filled / rows.length) / 10 : 0, distinct: s.distinct };
    });
    smarts.push({ etid: sp.etid, title: sp.title, itemCount: rows.length, cardFieldCount: spOnCard.size, cardSectionOrder: spSecOrder, fields: outFields });
    console.error(`SP\t${sp.etid}\t${sp.title}\tполей ${codes.length}\tкарточка ${spOnCard.size}\tразделов ${spSecOrder.length}\tкарточек ${rows.length}`);
  }

  // 4) ЛИД: стадии воронки лидов, поля, заполненность и какие поля сделки 49 приходят из лида
  // при конверсии (ТЗ туннеля ДомГласс, 01.10). Сбой здесь не трогает сделку и смарты.
  let lead: any = null;
  try { lead = await leadMap(dfs, selCodes, dealFields); } catch (e) { console.error("LEAD-FAIL", String(e)); }

  writeFileSync(OUT, JSON.stringify({
    generated_at: new Date().toISOString(),
    category: CAT,
    dealSince: DEAL_SINCE,
    portal: (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, ""),
    deal: { entity: "crm.deal (воронка 49)", fieldCount: dealFields.length, dealCount: dealRows.length, cardFieldCount: onCard.size, cardSectionOrder, fields: dealFields },
    smarts,
    ...(lead ? { lead } : {}),
  }, null, 1));
  console.error("WROTE\t" + OUT);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
