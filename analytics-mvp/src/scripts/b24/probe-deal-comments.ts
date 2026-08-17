// Разовая диагностика: есть ли в деле-резюме BitrixGPT ссылка на РОДИТЕЛЬСКИЙ ЗВОНОК.
// Выводим ПОЛНЫЙ сырой JSON каждой активности лида/сделки (crm.activity.get - все поля:
// SETTINGS, ORIGIN_ID, ORIGINATOR_ID, ASSOCIATED_ENTITY_ID, PARENT_ID и пр.). DEAL_ID через env.

const WH = process.env.B24_WEBHOOK_URL;
const DEAL_ID = (process.env.DEAL_ID || "99683").split(",")[0]!.trim();
if (!WH) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const BASE = WH.replace(/\/+$/, "");

async function call(method: string, params: any = {}): Promise<any> {
  const res = await fetch(`${BASE}/${method}.json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
  return res.json();
}

async function dumpRaw(label: string, ownerTypeId: number, ownerId: string) {
  console.log(`\n===== ${label} ${ownerId}: СЫРЫЕ АКТИВНОСТИ =====`);
  const list = ((await call("crm.activity.list", { filter: { OWNER_TYPE_ID: ownerTypeId, OWNER_ID: ownerId }, order: { CREATED: "ASC" }, select: ["ID"] })).result) || [];
  for (const it of list) {
    const full = (await call("crm.activity.get", { id: it.ID })).result;
    if (!full) continue;
    // выкидываем шумные/пустые поля, чтобы было читаемо
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(full)) {
      if (v === null || v === "" || v === "0" || (Array.isArray(v) && !v.length)) continue;
      clean[k] = typeof v === "string" && v.length > 300 ? v.slice(0, 300) + "…" : v;
    }
    console.log(`\n--- активность #${full.ID} (TYPE=${full.TYPE_ID} PROV=${full.PROVIDER_ID}) ---`);
    console.log(JSON.stringify(clean, null, 1));
  }
}

(async () => {
  const deal = (await call("crm.deal.get", { id: DEAL_ID })).result;
  console.log(`Сделка ${DEAL_ID}: LEAD_ID=${deal.LEAD_ID} CONTACT_ID=${deal.CONTACT_ID}`);
  if (deal.LEAD_ID && String(deal.LEAD_ID) !== "0") await dumpRaw("ЛИД", 1, String(deal.LEAD_ID));
  await dumpRaw("СДЕЛКА", 2, DEAL_ID);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
