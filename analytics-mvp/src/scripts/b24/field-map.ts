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
  try {
    for (const params of [{ scope: "C", extras: { dealCategoryId: CAT } }, { scope: "C" }] as any[]) {
      const cfgRaw: any = (await call("crm.deal.details.configuration.get", params)).result;
      const cfg: any[] = Array.isArray(cfgRaw) ? cfgRaw : (cfgRaw && cfgRaw.data) || [];
      for (const sec of cfg) {
        const st = String(sec.title || sec.name || "").trim();
        if (st && !cardSectionOrder.includes(st)) cardSectionOrder.push(st);
        for (const el of (sec.elements || [])) if (el && el.name) { onCard.add(el.name); if (!cardSection[el.name]) cardSection[el.name] = st; }
      }
      if (onCard.size) break;
    }
    console.error(`DEAL-CARD-FIELDS\t${onCard.size}\tразделов ${cardSectionOrder.length}`);
  } catch (e) { console.error("CARD-CFG-FAIL", String(e)); }
  // заполненность считаем только по полям карточки (быстрее в разы), если карточка известна
  const selCodes = onCard.size ? dealCodes.filter((c) => onCard.has(c) || c === "ID") : dealCodes;
  const dealRows = await pageAll("crm.deal.list", { filter: { CATEGORY_ID: CAT, ">=DATE_CREATE": DEAL_SINCE }, select: selCodes, order: { ID: "DESC" } });
  console.error(`DEAL\tполей карточки ${selCodes.length}/${dealCodes.length}\tсделок ${dealRows.length}`);
  const dealStats = fillStats(dealRows, selCodes);
  const dealFields = dealCodes.map((c) => {
    const f = fieldRow(c, dfs[c]); const s = dealStats[c] || { filled: 0, distinct: 0 };
    if (ufLabels[c]) f.title = ufLabels[c];
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
    let rows: any[] = [];
    try { rows = await itemsAll(sp.etid, codes); } catch (e) { console.error(`ITEMS-FAIL\t${sp.title}\t${String(e)}`); }
    const stats = fillStats(rows, codes);
    const outFields = codes.map((c) => {
      const f = fieldRow(c, fields[c]); const s = stats[c];
      return { ...f, filled: s.filled, total: rows.length, fillPct: rows.length ? Math.round(1000 * s.filled / rows.length) / 10 : 0, distinct: s.distinct };
    });
    smarts.push({ etid: sp.etid, title: sp.title, itemCount: rows.length, fields: outFields });
    console.error(`SP\t${sp.etid}\t${sp.title}\tполей ${codes.length}\tкарточек ${rows.length}`);
  }

  writeFileSync(OUT, JSON.stringify({
    generated_at: new Date().toISOString(),
    category: CAT,
    dealSince: DEAL_SINCE,
    portal: (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, ""),
    deal: { entity: "crm.deal (воронка 49)", fieldCount: dealFields.length, dealCount: dealRows.length, cardFieldCount: onCard.size, cardSectionOrder, fields: dealFields },
    smarts,
  }, null, 1));
  console.error("WROTE\t" + OUT);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
