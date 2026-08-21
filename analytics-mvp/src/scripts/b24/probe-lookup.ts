// Live-проба Bitrix24 (read-only). Стратегия: один полный проход по лидам/сделкам/контактам
// со всеми полями (вкл. UF_*), затем подстрочный поиск всех «иголок» на клиенте.
// Ловит email/параметр в любом поле карточки. Ничего не пишет в Bitrix.
// Иголки: EMAILS='a@b,c@d'  PARAMS='u2i-..,u2i-..'  (или одиночные EMAIL / PARAM).
import process from "node:process";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
const PORTAL = (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }

const split = (s: string) => (s || "").split(/[,\n;]+/).map((x) => x.trim()).filter(Boolean);
const emails = split(process.env.EMAILS || process.env.EMAIL || "");
const params = split(process.env.PARAMS || process.env.PARAM || "");
const needles = [...emails, ...params];
if (!needles.length) { console.error("Нет иголок (EMAILS/PARAMS)"); process.exit(1); }

const MAX_ROWS = Number(process.env.MAX_ROWS || 40000);

async function call(method: string, paramsObj: any = {}): Promise<any> {
  const res = await fetch(`${BASE}/${method}.json`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(paramsObj), signal: AbortSignal.timeout(30000),
  });
  const j: any = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error_description || j.error}`);
  return j;
}
async function listAll(method: string, p: any): Promise<any[]> {
  const all: any[] = []; let start = 0;
  for (;;) {
    const j = await call(method, { ...p, start });
    (j.result || []).forEach((r: any) => all.push(r));
    if (j.next === undefined || all.length >= MAX_ROWS) break;
    start = j.next;
  }
  return all;
}
const url: Record<string, (id: any) => string> = {
  lead: (id) => `${PORTAL}/crm/lead/details/${id}/`,
  deal: (id) => `${PORTAL}/crm/deal/details/${id}/`,
  contact: (id) => `${PORTAL}/crm/contact/details/${id}/`,
};

function fieldWith(row: any, needle: string): string {
  const n = needle.toLowerCase();
  for (const k of Object.keys(row)) {
    try { if (JSON.stringify(row[k] ?? "").toLowerCase().includes(n)) return k; } catch { /* */ }
  }
  return "?";
}

async function main() {
  console.log(`Портал ${PORTAL}`);
  console.log(`Иголки: ${needles.join(" | ")}\n`);

  const entities: Array<["lead" | "deal" | "contact", string, string[]]> = [
    ["lead", "crm.lead.list", ["*", "UF_*"]],
    ["deal", "crm.deal.list", ["*", "UF_*"]],
    ["contact", "crm.contact.list", ["*", "EMAIL", "PHONE"]],
  ];

  const dealsByContact = new Map<string, any[]>();

  for (const [kind, method, select] of entities) {
    let rows: any[] = [];
    try { rows = await listAll(method, { select }); }
    catch (e) { console.log(`${method}: ошибка ${(e as any)?.message}`); continue; }
    console.log(`${method}: загружено ${rows.length}${rows.length >= MAX_ROWS ? " (достигнут лимит)" : ""}`);
    if (kind === "deal") {
      for (const d of rows) { const c = String(d.CONTACT_ID || ""); if (c) { if (!dealsByContact.has(c)) dealsByContact.set(c, []); dealsByContact.get(c)!.push(d); } }
    }
    for (const needle of needles) {
      const n = needle.toLowerCase();
      const hits = rows.filter((r) => { try { return JSON.stringify(r).toLowerCase().includes(n); } catch { return false; } });
      if (!hits.length) continue;
      console.log(`\n>>> «${needle}» в ${kind}: ${hits.length}`);
      for (const h of hits) {
        const f = fieldWith(h, needle);
        const extra = kind === "deal" ? ` · C${h.CATEGORY_ID} · ${h.STAGE_ID} · ${Number(h.OPPORTUNITY) || 0}₽ · ${String(h.DATE_CREATE || "").slice(0, 10)} · lead=${h.LEAD_ID || "-"}` :
          kind === "lead" ? ` · ${h.STATUS_ID || ""} · ${String(h.DATE_CREATE || "").slice(0, 10)}` :
          ` · ${((h.NAME || "") + " " + (h.LAST_NAME || "")).trim()}`;
        console.log(`   #${h.ID} · поле ${f}${extra}\n     ${url[kind](h.ID)}`);
        if (kind === "contact") {
          const ds = dealsByContact.get(String(h.ID)) || [];
          console.log(`     сделок у контакта: ${ds.length}`);
          for (const d of ds) console.log(`       Сделка #${d.ID} · C${d.CATEGORY_ID} · ${d.STAGE_ID} · ${Number(d.OPPORTUNITY) || 0}₽ · ${String(d.DATE_CREATE || "").slice(0, 10)}\n         ${url.deal(d.ID)}`);
        }
      }
    }
  }
  console.log("\nГотово.");
}
main().catch((e) => { console.error("Проба упала:", e instanceof Error ? e.message : e); process.exit(1); });
