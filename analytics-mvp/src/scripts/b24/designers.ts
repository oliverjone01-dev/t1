// База дизайнеров: сделки всех воронок, где заполнено поле «Дизайнер» (UF_CRM_1778140952)
// или «Дизайнер!» (UF_CRM_69FB28793E872), а «Направление бизнеса» (UF_CRM_69A7F70A18816)
// входит в {genglass, metal_gm, gen-group, gentero, valonti} - без glass-memory (2333) и без пустого.
// Для каждого дизайнера резолвим контакт: имя, почта (из его карточки контакта), ссылка на контакт.
// Плюс по сделке: воронка (категория), этап, название сделки, имя контакта-клиента.
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/designers.ts
import { writeFileSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const PORTAL = (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, "");
const OUT = "economics/data/designers.json";

const F_DIR = "UF_CRM_69A7F70A18816";       // Направление бизнеса (enum)
const F_DES1 = "UF_CRM_1778140952";          // Дизайнер (crm)
const F_DES2 = "UF_CRM_69FB28793E872";       // Дизайнер!
const DIR_KEEP = new Set(["2331", "2335", "2337", "2339", "2341"]); // без 2333 glass-memory + без пустого

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
const isEmpty = (v: any) => v === null || v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0);

// извлечь id контактов из значения crm-поля (форматы: "C_123", "123", число, массив)
function contactIds(v: any): number[] {
  if (isEmpty(v)) return [];
  const arr = Array.isArray(v) ? v : [v];
  const out: number[] = [];
  for (const it of arr) {
    const s = String(it).trim();
    let m = s.match(/^C_?(\d+)$/i) || s.match(/^(\d+)$/);
    if (m) out.push(Number(m[1]));
  }
  return out;
}

async function main() {
  // 1. воронки (категории сделок)
  const catRes = await call("crm.category.list", { entityTypeId: 2 });
  const catName: Record<string, string> = {};
  for (const c of (catRes.result?.categories || [])) catName[String(c.id)] = c.name;
  catName["0"] = catName["0"] || "Общая воронка";

  // 2. этапы (все стадии сделок) STATUS_ID -> NAME
  const statuses = await pageAll("crm.status.list", { filter: {} });
  const stageName: Record<string, string> = {};
  for (const s of statuses) if (/^DEAL_STAGE/i.test(String(s.ENTITY_ID))) stageName[String(s.STATUS_ID)] = s.NAME;

  // 3. справочник направлений (enum id -> бренд)
  const dfRes = await call("crm.deal.fields", {});
  const dirItems = (dfRes.result?.[F_DIR]?.items || []) as any[];
  const dirName: Record<string, string> = {};
  for (const it of dirItems) dirName[String(it.ID ?? it.id)] = String(it.VALUE ?? it.value);

  // 4. сделки нужных направлений
  const deals = await pageAll("crm.deal.list", {
    filter: { [F_DIR]: Array.from(DIR_KEEP) },
    select: ["ID", "TITLE", "CATEGORY_ID", "STAGE_ID", "CONTACT_ID", F_DIR, F_DES1, F_DES2],
    order: { ID: "ASC" },
  });

  // отфильтровать: направление в KEEP и есть дизайнер
  const rows0: any[] = [];
  const desIds = new Set<number>();
  const cliIds = new Set<number>();
  for (const d of deals) {
    const dir = String(d[F_DIR] ?? "");
    if (!DIR_KEEP.has(dir)) continue;
    const ids = [...contactIds(d[F_DES1]), ...contactIds(d[F_DES2])];
    if (!ids.length) continue;
    const cli = Number(d.CONTACT_ID || 0) || null;
    if (cli) cliIds.add(cli);
    for (const id of ids) { desIds.add(id); rows0.push({ deal: d, designerId: id, dir, cli }); }
  }

  // 5. резолв контактов (дизайнеры + клиенты) чанками
  const allIds = Array.from(new Set([...desIds, ...cliIds]));
  const contact: Record<string, { name: string; email: string }> = {};
  for (let i = 0; i < allIds.length; i += 50) {
    const chunk = allIds.slice(i, i + 50);
    const cs = await pageAll("crm.contact.list", { filter: { ID: chunk }, select: ["ID", "NAME", "LAST_NAME", "SECOND_NAME", "EMAIL"] });
    for (const c of cs) {
      const nm = [c.NAME, c.SECOND_NAME, c.LAST_NAME].filter(Boolean).join(" ").trim();
      let email = "";
      if (Array.isArray(c.EMAIL) && c.EMAIL.length) email = String(c.EMAIL[0].VALUE || "");
      contact[String(c.ID)] = { name: nm || `Контакт #${c.ID}`, email };
    }
  }
  const cget = (id: number | null) => (id && contact[String(id)]) ? contact[String(id)] : { name: id ? `Контакт #${id}` : "", email: "" };

  // 6. строки
  const rows = rows0.map((r) => {
    const d = r.deal; const des = cget(r.designerId); const cli = cget(r.cli);
    return {
      designer: des.name,
      email: des.email,
      link: `${PORTAL}/crm/contact/details/${r.designerId}/`,
      designerId: r.designerId,
      funnel: catName[String(d.CATEGORY_ID)] || `Воронка ${d.CATEGORY_ID}`,
      stage: stageName[String(d.STAGE_ID)] || String(d.STAGE_ID),
      title: d.TITLE || "",
      clientName: cli.name,
      direction: dirName[r.dir] || r.dir,
      dealId: d.ID,
    };
  });

  // 7. уникальные дизайнеры
  const byId: Record<string, any> = {};
  for (const r of rows) {
    const k = String(r.designerId);
    if (!byId[k]) byId[k] = { designer: r.designer, email: r.email, link: r.link, designerId: r.designerId, deals: 0, brands: new Set<string>(), funnels: new Set<string>() };
    byId[k].deals++; byId[k].brands.add(r.direction); byId[k].funnels.add(r.funnel);
  }
  const designers = Object.values(byId).map((x: any) => ({
    designer: x.designer, email: x.email, link: x.link, designerId: x.designerId,
    deals: x.deals, brands: Array.from(x.brands).join(", "), funnels: Array.from(x.funnels).join(", "),
  })).sort((a, b) => b.deals - a.deals);

  const out = {
    generated_at: new Date().toISOString(),
    portal: PORTAL,
    directions_kept: Object.fromEntries(Array.from(DIR_KEEP).map((id) => [id, dirName[id] || id])),
    deals_scanned: deals.length,
    deals_with_designer: rows0.length,
    designers_unique: designers.length,
    designers,
    rows,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`designers: сделок с направлением ${deals.length}, строк дизайнер×сделка ${rows.length}, уникальных дизайнеров ${designers.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
