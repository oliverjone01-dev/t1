// Разовая диагностика: где BitrixGPT-резюме звонка. Смотрим ВЕСЬ кластер сделки:
// сама сделка + её контакт + лид-источник. Комментарии (автор+текст) и активности
// (тип/провайдер/сабдж/описание, а для звонков/GPT - PROVIDER_PARAMS). DEAL_ID через env.

const WH = process.env.B24_WEBHOOK_URL;
const DEAL_ID = (process.env.DEAL_ID || "99683").split(",")[0]!.trim();
if (!WH) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const BASE = WH.replace(/\/+$/, "");

async function call(method: string, params: any = {}): Promise<any> {
  const res = await fetch(`${BASE}/${method}.json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
  return res.json();
}
const uCache: Record<string, string> = {};
async function uname(id: any): Promise<string> {
  const k = String(id); if (!id) return ""; if (uCache[k]) return uCache[k];
  try { const u = ((await call("user.get", { ID: k })).result || [])[0]; uCache[k] = u ? `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim() || k : k; } catch { uCache[k] = k; }
  return uCache[k];
}
const clip = (s: any, n = 600) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };

async function dumpEntity(label: string, entityType: string, ownerTypeId: number, id: string) {
  console.log(`\n===== ${label} ${id} =====`);
  const cs = ((await call("crm.timeline.comment.list", { filter: { ENTITY_ID: id, ENTITY_TYPE: entityType }, order: { CREATED: "ASC" } })).result) || [];
  console.log(`  -- комментарии: ${cs.length} --`);
  for (const c of cs) { const au = await uname(c.AUTHOR_ID); const waz = /wazzup24\.com/i.test(String(c.COMMENT || "")); console.log(`  #${c.ID} ${c.CREATED} авт=${au}${waz ? " [wazzup]" : ""}: ${clip(c.COMMENT)}`); }
  const acts = ((await call("crm.activity.list", { filter: { OWNER_TYPE_ID: ownerTypeId, OWNER_ID: id }, order: { CREATED: "ASC" }, select: ["ID", "TYPE_ID", "PROVIDER_ID", "PROVIDER_TYPE_ID", "SUBJECT", "DESCRIPTION", "CREATED", "AUTHOR_ID", "PROVIDER_PARAMS", "SETTINGS"] })).result) || [];
  console.log(`  -- активности: ${acts.length} --`);
  for (const a of acts) {
    const au = await uname(a.AUTHOR_ID);
    console.log(`  #${a.ID} ${a.CREATED} TYPE=${a.TYPE_ID} PROV=${a.PROVIDER_ID}/${a.PROVIDER_TYPE_ID} авт=${au} SUBJ="${clip(a.SUBJECT, 120)}"`);
    if (a.DESCRIPTION) console.log(`      DESC: ${clip(a.DESCRIPTION)}`);
    if (a.PROVIDER_PARAMS) { const s = JSON.stringify(a.PROVIDER_PARAMS); console.log(`      PPARAMS: ${clip(s, 900)}`); }
  }
}

(async () => {
  const deal = (await call("crm.deal.get", { id: DEAL_ID })).result;
  console.log(`Сделка ${DEAL_ID}: LEAD_ID=${deal.LEAD_ID} CONTACT_ID=${deal.CONTACT_ID} COMPANY_ID=${deal.COMPANY_ID}`);
  await dumpEntity("СДЕЛКА", "deal", 2, DEAL_ID);
  if (deal.CONTACT_ID && String(deal.CONTACT_ID) !== "0") await dumpEntity("КОНТАКТ", "contact", 3, String(deal.CONTACT_ID));
  if (deal.LEAD_ID && String(deal.LEAD_ID) !== "0") await dumpEntity("ЛИД", "lead", 1, String(deal.LEAD_ID));
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
