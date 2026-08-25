// Таймлайн: когда каждый смарт-процесс создан/начал тестироваться/пошёл на реальные сделки,
// и порядок этапов воронки 49 (по SORT). Быстро - без товарных строк. Только чтение.
// Печатает всё в stderr (TL-*). Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/econ-timeline.ts
const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const CAT = 49;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const d10 = (s?: string) => (s ? String(s).slice(0, 10) : "");
const mo = (s?: string) => (s ? String(s).slice(0, 7) : "");

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

(async () => {
  // порядок этапов воронки 49
  const st = await pageAll("crm.status.list", { filter: {} });
  const c49 = st.filter((s) => /_49$|DEAL_STAGE_49|C49/i.test(String(s.ENTITY_ID || s.STATUS_ID || ""))).sort((a, b) => Number(a.SORT) - Number(b.SORT));
  console.error("TL-STAGES (порядок воронки 49):");
  for (const s of c49) console.error(`TL-STAGE\t${s.SORT}\t${s.STATUS_ID}\t${s.NAME}`);

  // все сделки cat49 (id, дата) - вся история
  const deals = await pageAll("crm.deal.list", { filter: { CATEGORY_ID: CAT }, select: ["ID", "DATE_CREATE"], order: { ID: "ASC" } });
  const dealCreated: Record<string, string> = {};
  for (const d of deals) dealCreated[String(d.ID)] = d10(d.DATE_CREATE);
  const dealSet = new Set(Object.keys(dealCreated));
  const first = deals.length ? d10(deals[0].DATE_CREATE) : "";
  const last = deals.length ? d10(deals[deals.length - 1].DATE_CREATE) : "";
  console.error(`TL-DEALS\tвсего ${deals.length}\tпервая ${first}\tпоследняя ${last}`);
  // помесячно сделки
  const dm: Record<string, number> = {}; for (const d of deals) { const m = mo(d.DATE_CREATE); dm[m] = (dm[m] || 0) + 1; }
  console.error(`TL-DEAL-MONTHS\t${Object.entries(dm).sort().map(([m, n]) => m + ":" + n).join("  ")}`);

  // СП
  const types: any[] = (await call("crm.type.list", {})).result?.types || [];
  const sps = types.map((t) => ({ etid: Number(t.entityTypeId), title: t.title })).filter((t) => t.etid >= 1000);
  for (const sp of sps) {
    let items: any[];
    try { items = await itemsAll(sp.etid, ["id", "createdTime", "parentId2"]); } catch { console.error(`TL-SP\t${sp.etid}\t${sp.title}\tОШИБКА чтения`); continue; }
    if (!items.length) { console.error(`TL-SP\t${sp.etid}\t${sp.title}\tкарточек 0`); continue; }
    const dates = items.map((it) => d10(it.createdTime)).filter(Boolean).sort();
    const firstCard = dates[0] || "";
    // первая карточка, привязанная к реальной сделке cat49
    const realCards = items.filter((it) => dealSet.has(String(it.parentId2 || ""))).map((it) => d10(it.createdTime)).filter(Boolean).sort();
    const firstReal = realCards[0] || "нет";
    // помесячно
    const hm: Record<string, number> = {}; for (const it of items) { const m = mo(it.createdTime); if (m) hm[m] = (hm[m] || 0) + 1; }
    const hist = Object.entries(hm).sort().map(([m, n]) => m + ":" + n).join(" ");
    console.error(`TL-SP\t${sp.etid}\t${sp.title}\tкарточек ${items.length}\tпервая ${firstCard}\tпервая-боевая ${firstReal}\tбоевых ${realCards.length}`);
    console.error(`TL-SP-HIST\t${sp.title}\t${hist}`);
  }
  console.error("TL-DONE");
})();
