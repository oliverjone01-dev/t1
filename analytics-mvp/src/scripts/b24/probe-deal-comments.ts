// Разовая диагностика (ничего не коммитит): ГДЕ в карточке сделки лежит текст
// BitrixGPT-резюме звонка (транскрибация/анализ). Смотрим ВСЕ комментарии (автор + полный
// текст) и ВСЕ активности (тип/провайдер/сабдж/описание). DEAL_ID через env (можно списком).

const WH = process.env.B24_WEBHOOK_URL;
const IDS = (process.env.DEAL_ID || "99683").split(",").map((s) => s.trim()).filter(Boolean);
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
const clip = (s: any, n = 500) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };

(async () => {
  for (const DEAL_ID of IDS) {
    console.log(`\n########## СДЕЛКА ${DEAL_ID} ##########`);
    // КОММЕНТАРИИ
    const cs = ((await call("crm.timeline.comment.list", { filter: { ENTITY_ID: DEAL_ID, ENTITY_TYPE: "deal" }, order: { CREATED: "ASC" } })).result) || [];
    console.log(`\n=== КОММЕНТАРИИ: ${cs.length} ===`);
    for (const c of cs) {
      const au = await uname(c.AUTHOR_ID);
      const waz = /wazzup24\.com/i.test(String(c.COMMENT || ""));
      console.log(`  #${c.ID} ${c.CREATED} автор=${c.AUTHOR_ID}(${au})${waz ? " [wazzup]" : ""}\n    ${clip(c.COMMENT, 600)}`);
    }
    // АКТИВНОСТИ (с описанием - там могут быть BitrixGPT-тексты/резюме)
    const acts = ((await call("crm.activity.list", { filter: { OWNER_TYPE_ID: 2, OWNER_ID: DEAL_ID }, order: { CREATED: "ASC" }, select: ["ID", "TYPE_ID", "PROVIDER_ID", "PROVIDER_TYPE_ID", "DIRECTION", "SUBJECT", "DESCRIPTION", "CREATED", "AUTHOR_ID", "SETTINGS", "PROVIDER_PARAMS"] })).result) || [];
    console.log(`\n=== АКТИВНОСТИ: ${acts.length} ===`);
    for (const a of acts) {
      const au = await uname(a.AUTHOR_ID);
      console.log(`  #${a.ID} ${a.CREATED} TYPE=${a.TYPE_ID} PROV=${a.PROVIDER_ID}/${a.PROVIDER_TYPE_ID} автор=${au}`);
      console.log(`    SUBJ: ${clip(a.SUBJECT, 160)}`);
      if (a.DESCRIPTION) console.log(`    DESC: ${clip(a.DESCRIPTION, 600)}`);
      const pp = a.PROVIDER_PARAMS ? JSON.stringify(a.PROVIDER_PARAMS) : "";
      if (pp && /gpt|resume|резюм|transcri|скрипт|score/i.test(pp)) console.log(`    PROVIDER_PARAMS(фрагм): ${clip(pp, 700)}`);
    }
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
