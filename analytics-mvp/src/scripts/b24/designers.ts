// База дизайнеров. Источник - смарт-процесс «Дизайнеры ( тех СП )» (entityTypeId=1124):
// это реестр дизайнеров бренда. Контакт дизайнера лежит в поле «Контакт Дизайнера»
// (ufCrm35_1778137689, crm), промокод - «Промокод дизайнера» (ufCrm35_1778137905).
// (Поле «Дизайнер» на самой сделке фактически пустое: 0-2 из 23481 - не используется.)
// Для каждого дизайнера: имя/почта/ссылка на его контакт + промокод.
// Сделки дизайнера ищем по промокоду (UF_DESIGNER_PROMO на сделке) и по контакту (клиент сделки),
// только направления {genglass, metal_gm, gen-group, gentero, valonti} - без glass-memory и пустого.
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/designers.ts
import { writeFileSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const PORTAL = (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, "");
const OUT = "economics/data/designers.json";

const ETID_DES = 1124;                        // смарт «Дизайнеры ( тех СП )»
const F_DES_CONTACT = "ufCrm35_1778137689";   // Контакт Дизайнера (crm)
const F_DES_PROMO = "ufCrm35_1778137905";     // Промокод дизайнера (string)
const F_DIR = "UF_CRM_69A7F70A18816";         // Направление бизнеса (enum) на сделке
const F_DEAL_PROMO = "UF_CRM_69FB287626AB6";  // UF_DESIGNER_PROMO на сделке
const DIR_KEEP = new Set(["2331", "2335", "2337", "2339", "2341"]); // без 2333 glass-memory + пустого

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
  for (;;) { const j = await call("crm.item.list", { entityTypeId: etid, select, filter: { ">id": lastId }, order: { id: "ASC" } }); const b: any[] = (j.result && j.result.items) || []; if (!b.length) break; all.push(...b); lastId = Number(b[b.length - 1].id); if (b.length < 50) break; }
  return all;
}
const isEmpty = (v: any) => v === null || v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0);
function contactIds(v: any): number[] {
  if (isEmpty(v)) return [];
  const arr = Array.isArray(v) ? v : [v];
  const out: number[] = [];
  for (const it of arr) { const s = String(it).trim(); const m = s.match(/^C_?(\d+)$/i) || s.match(/^(\d+)$/); if (m) out.push(Number(m[1])); }
  return out;
}

async function main() {
  // справочники
  const catRes = await call("crm.category.list", { entityTypeId: 2 });
  const catName: Record<string, string> = { "0": "Общая воронка" };
  for (const c of (catRes.result?.categories || [])) catName[String(c.id)] = c.name;
  const statuses = await pageAll("crm.status.list", { filter: {} });
  const stageName: Record<string, string> = {};
  for (const s of statuses) if (/^DEAL_STAGE/i.test(String(s.ENTITY_ID))) stageName[String(s.STATUS_ID)] = s.NAME;
  const dfRes = await call("crm.deal.fields", {});
  const dirItems = (dfRes.result?.[F_DIR]?.items || []) as any[];
  const dirName: Record<string, string> = {};
  for (const it of dirItems) dirName[String(it.ID ?? it.id)] = String(it.VALUE ?? it.value);

  // 1. реестр дизайнеров
  const items = await itemsAll(ETID_DES, ["id", "title", "stageId", F_DES_CONTACT, F_DES_PROMO]);
  const desList: any[] = [];
  const desContactIds = new Set<number>();
  const byPromo: Record<string, any> = {};
  const byContact: Record<string, any> = {};
  for (const it of items) {
    const cid = contactIds(it[F_DES_CONTACT])[0] || null;
    const promo = String(it[F_DES_PROMO] || "").trim();
    const rec: any = { itemId: it.id, title: it.title || "", contactId: cid, promo, name: "", email: "", link: cid ? `${PORTAL}/crm/contact/details/${cid}/` : "", deals: 0, brands: new Set<string>(), funnels: new Set<string>(), dealRows: [] as any[] };
    desList.push(rec);
    if (cid) { desContactIds.add(cid); byContact[String(cid)] = rec; }
    if (promo) byPromo[promo.toLowerCase()] = rec;
  }

  // 2. контакты дизайнеров
  const ids = Array.from(desContactIds);
  for (let i = 0; i < ids.length; i += 50) {
    const cs = await pageAll("crm.contact.list", { filter: { ID: ids.slice(i, i + 50) }, select: ["ID", "NAME", "LAST_NAME", "SECOND_NAME", "EMAIL"] });
    for (const c of cs) {
      const rec = byContact[String(c.ID)]; if (!rec) continue;
      rec.name = [c.NAME, c.SECOND_NAME, c.LAST_NAME].filter(Boolean).join(" ").trim() || `Контакт #${c.ID}`;
      if (Array.isArray(c.EMAIL) && c.EMAIL.length) rec.email = String(c.EMAIL[0].VALUE || "");
    }
  }
  for (const r of desList) if (!r.name) r.name = r.contactId ? `Контакт #${r.contactId}` : (r.title || "(без контакта)");

  // 3. сделки нужных направлений: матчим к дизайнеру по промокоду и по контакту-клиенту
  const deals = await pageAll("crm.deal.list", {
    filter: { [F_DIR]: Array.from(DIR_KEEP) },
    select: ["ID", "TITLE", "CATEGORY_ID", "STAGE_ID", "CONTACT_ID", F_DIR, F_DEAL_PROMO],
    order: { ID: "ASC" },
  });
  let matched = 0;
  for (const d of deals) {
    const dir = String(d[F_DIR] ?? ""); if (!DIR_KEEP.has(dir)) continue;
    const promo = String(d[F_DEAL_PROMO] || "").trim().toLowerCase();
    const cli = Number(d.CONTACT_ID || 0) || null;
    let rec = (promo && byPromo[promo]) || (cli && byContact[String(cli)]) || null;
    if (!rec) continue;
    matched++;
    rec.deals++; rec.brands.add(dirName[dir] || dir); rec.funnels.add(catName[String(d.CATEGORY_ID)] || `Воронка ${d.CATEGORY_ID}`);
    rec.dealRows.push({ dealId: d.ID, title: d.TITLE || "", funnel: catName[String(d.CATEGORY_ID)] || String(d.CATEGORY_ID), stage: stageName[String(d.STAGE_ID)] || String(d.STAGE_ID), direction: dirName[dir] || dir, via: (promo && byPromo[promo]) ? "промокод" : "контакт" });
  }

  const designers = desList.map((r) => ({
    name: r.name, email: r.email, link: r.link, contactId: r.contactId, promo: r.promo,
    deals: r.deals, brands: Array.from(r.brands).join(", "), funnels: Array.from(r.funnels).join(", "),
  })).sort((a, b) => b.deals - a.deals || (a.name > b.name ? 1 : -1));
  const rows: any[] = [];
  for (const r of desList) for (const dr of r.dealRows) rows.push({ designer: r.name, email: r.email, link: r.link, promo: r.promo, ...dr });

  const out = {
    generated_at: new Date().toISOString(), portal: PORTAL,
    source: "смарт «Дизайнеры ( тех СП )» entityTypeId=1124; контакт=ufCrm35_1778137689, промокод=ufCrm35_1778137905",
    directions_kept: Object.fromEntries(Array.from(DIR_KEEP).map((id) => [id, dirName[id] || id])),
    designers_total: desList.length, deals_scanned: deals.length, deals_matched: matched,
    designers, rows,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`designers: реестр ${desList.length}, сделок в направлениях ${deals.length}, привязано ${matched}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
