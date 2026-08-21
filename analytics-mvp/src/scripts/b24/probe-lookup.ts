// Live-проба Bitrix24 (read-only) для Glass Memory (C21). Два режима в одном прогоне:
//  1) NEEDLE: подстрочный поиск EMAILS/PARAMS по лидам/сделкам/контактам (любое поле).
//  2) ORPHAN: лид и сделка одного контакта (по email/телефону), где конвертации
//     лид -> сделка НЕ было (deal.LEAD_ID не указывает на этот лид, лид не сконвертирован).
// Ничего не пишет в Bitrix. Сделки ограничены категорией C21 (DEAL_CATEGORY, по умолч. 21).
import process from "node:process";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
const PORTAL = (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }

const split = (s: string) => (s || "").split(/[,\n;]+/).map((x) => x.trim()).filter(Boolean);
const emails = split(process.env.EMAILS || process.env.EMAIL || "");
const params = split(process.env.PARAMS || process.env.PARAM || "");
const needles = [...emails, ...params];
const CAT = String(process.env.DEAL_CATEGORY || "21");
const ORPHAN_LIMIT = Number(process.env.ORPHAN_LIMIT || 15);

async function call(method: string, p: any = {}): Promise<any> {
  const res = await fetch(`${BASE}/${method}.json`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p), signal: AbortSignal.timeout(30000),
  });
  const j: any = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error_description || j.error}`);
  return j;
}
async function listAll(method: string, p: any): Promise<any[]> {
  const all: any[] = []; let start = 0;
  for (;;) { const j = await call(method, { ...p, start }); (j.result || []).forEach((r: any) => all.push(r)); if (j.next === undefined) break; start = j.next; }
  return all;
}
const leadUrl = (id: any) => `${PORTAL}/crm/lead/details/${id}/`;
const dealUrl = (id: any) => `${PORTAL}/crm/deal/details/${id}/`;
const contUrl = (id: any) => `${PORTAL}/crm/contact/details/${id}/`;

const normPhone = (v: string) => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
const normEmail = (v: string) => String(v || "").trim().toLowerCase();
function commKeys(entity: any): Set<string> {
  const keys = new Set<string>();
  for (const mf of ["EMAIL", "PHONE"]) {
    const arr = entity[mf];
    if (Array.isArray(arr)) for (const x of arr) { const val = x?.VALUE ?? x; if (mf === "EMAIL") { const e = normEmail(val); if (e) keys.add("e:" + e); } else { const p = normPhone(val); if (p) keys.add("p:" + p); } }
  }
  return keys;
}

async function main() {
  console.log(`Портал ${PORTAL} · сделки C${CAT}`);
  if (needles.length) console.log(`Иголки: ${needles.join(" | ")}`);
  console.log("");

  // --- загрузка ---
  const leads = await listAll("crm.lead.list", { select: ["ID", "TITLE", "STATUS_ID", "STATUS_SEMANTIC_ID", "DATE_CREATE", "CONTACT_ID", "EMAIL", "PHONE", "UF_*", "ORIGIN_ID", "ORIGINATOR_ID", "SOURCE_DESCRIPTION"] });
  console.log(`Лидов: ${leads.length}`);
  const deals = await listAll("crm.deal.list", { filter: { CATEGORY_ID: CAT }, select: ["ID", "TITLE", "CATEGORY_ID", "STAGE_ID", "OPPORTUNITY", "DATE_CREATE", "LEAD_ID", "CONTACT_ID", "UF_*"] });
  console.log(`Сделок C${CAT}: ${deals.length}`);

  // контакты сделок (для email/телефона)
  const cids = [...new Set(deals.map((d) => String(d.CONTACT_ID || "")).filter((x) => x && x !== "0"))];
  const contactsById = new Map<string, any>();
  for (let i = 0; i < cids.length; i += 50) {
    const rows = await listAll("crm.contact.list", { filter: { ID: cids.slice(i, i + 50) }, select: ["ID", "NAME", "LAST_NAME", "EMAIL", "PHONE"] });
    for (const c of rows) contactsById.set(String(c.ID), c);
  }
  console.log(`Контактов сделок: ${contactsById.size}\n`);

  // --- режим 1: иголки ---
  if (needles.length) {
    const sets: Array<[string, any[], (id: any) => string]> = [["лид", leads, leadUrl], ["сделка", deals, dealUrl], ["контакт", [...contactsById.values()], contUrl]];
    for (const needle of needles) {
      const n = needle.toLowerCase();
      let total = 0;
      for (const [kind, rows, url] of sets) {
        const hits = rows.filter((r) => { try { return JSON.stringify(r).toLowerCase().includes(n); } catch { return false; } });
        total += hits.length;
        for (const h of hits) console.log(`«${needle}» ${kind} #${h.ID} · ${url(h.ID)}`);
      }
      if (!total) console.log(`«${needle}»: не найдено (лиды/сделки C${CAT}/контакты сделок).`);
    }
    console.log("");
  }

  // --- режим 2: лид+сделка одного контакта без конвертации ---
  const convertedLeadIds = new Set(deals.map((d) => String(d.LEAD_ID)).filter((x) => x && x !== "0"));
  // ключ идентичности -> лиды
  const keyToLeads = new Map<string, any[]>();
  for (const l of leads) { for (const k of commKeys(l)) { if (!keyToLeads.has(k)) keyToLeads.set(k, []); keyToLeads.get(k)!.push(l); } }

  console.log(`=== ЛИД и СДЕЛКА одного контакта БЕЗ конвертации (deal.LEAD_ID != лид) ===`);
  let shown = 0;
  const seenPairs = new Set<string>();
  for (const d of deals) {
    const c = contactsById.get(String(d.CONTACT_ID || ""));
    if (!c) continue;
    const dkeys = commKeys(c);
    for (const k of dkeys) {
      const ls = keyToLeads.get(k) || [];
      for (const l of ls) {
        if (String(l.ID) === String(d.LEAD_ID)) continue;         // это и есть конвертация - пропускаем
        if (convertedLeadIds.has(String(l.ID))) continue;          // лид сконвертирован в другую сделку - не «потеряшка»
        const pair = `${l.ID}-${d.ID}`;
        if (seenPairs.has(pair)) continue; seenPairs.add(pair);
        const who = ((c.NAME || "") + " " + (c.LAST_NAME || "")).trim();
        const via = k.startsWith("e:") ? "email " + k.slice(2) : "тел " + k.slice(2);
        console.log(`\n[${shown + 1}] контакт #${c.ID} ${who} · совпадение по ${via}`);
        console.log(`   ЛИД #${l.ID} · ${l.STATUS_ID} (${l.STATUS_SEMANTIC_ID || "?"}) · ${String(l.DATE_CREATE || "").slice(0, 10)} · deal.LEAD_ID у сделки=${d.LEAD_ID || "-"}\n     ${leadUrl(l.ID)}`);
        console.log(`   СДЕЛКА #${d.ID} · ${d.STAGE_ID} · ${Number(d.OPPORTUNITY) || 0}₽ · ${String(d.DATE_CREATE || "").slice(0, 10)}\n     ${dealUrl(d.ID)}`);
        console.log(`   КОНТАКТ: ${contUrl(c.ID)}`);
        shown++;
        if (shown >= ORPHAN_LIMIT) { console.log(`\n(показаны первые ${ORPHAN_LIMIT})`); console.log("\nГотово."); return; }
      }
    }
  }
  if (!shown) console.log("Таких пар не найдено: у каждой сделки C" + CAT + " лид того же контакта либо привязан, либо отсутствует.");
  console.log("\nГотово.");
}
main().catch((e) => { console.error("Проба упала:", e instanceof Error ? e.message : e); process.exit(1); });
