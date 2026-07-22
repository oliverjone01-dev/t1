// РАЗВЕДКА КЕЙСА РЕКЛАМАЦИИ (сделка 91015) для ТЗ на СП Рекламация.
// Печатает: список всех СП (entityTypeId+title), поля рекламации сделки, историю стадий сделки
// (как её метало по воронке), и все карточки СП, привязанные к сделке (сколько раз
// перезапускались Расчёт/Закупка/Производство/Сборка/Монтаж/Замер/Логистика). Ничего не пишет.
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/probe-money-entities.ts

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const DEAL = Number(process.env.PROBE_DEAL || 91015);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(method: string, params: any = {}): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params), signal: AbortSignal.timeout(30000),
      });
      const j: any = await res.json();
      if (j.error) {
        if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await sleep(1200); attempt--; continue; }
        throw new Error(`${method}: ${j.error_description || j.error}`);
      }
      return j;
    } catch (e) { lastErr = e; await sleep(600 * (attempt + 1)); }
  }
  throw lastErr;
}
const d16 = (s?: string) => (s ? String(s).slice(0, 16) : "");

(async () => {
  // 1) Все СП.
  const types: any[] = (await call("crm.type.list", { select: ["entityTypeId", "title"] })).result?.types || [];
  console.log("=== ВСЕ СМАРТ-ПРОЦЕССЫ (entityTypeId | title) ===");
  for (const t of types) console.log(`  ${t.entityTypeId} | «${t.title}»`);
  const wantRe = /замер|сбор|монтаж|логист|расч[её]т|калькул|закуп|производ|реклам|претенз|доставк|отгруз/i;
  const want = types.filter((t) => wantRe.test(t.title || ""));

  // 2) Сделка 91015: категория/стадия/поля рекламации.
  const dl: any[] = (await call("crm.deal.list", { filter: { ID: DEAL }, select: ["*", "uf_*"] })).result || [];
  const d = dl[0] || {};
  console.log(`\n=== СДЕЛКА ${DEAL} ===`);
  console.log(`  TITLE=${d.TITLE} | CATEGORY_ID=${d.CATEGORY_ID} | STAGE_ID=${d.STAGE_ID} | OPP=${d.OPPORTUNITY} | CLOSED=${d.CLOSED}`);
  console.log("  -- заполненные поля про рекламацию/срок --");
  for (const k of Object.keys(d)) {
    if (/1678431|DATA_SOZDANIYA|реклам|срок|1773904695389|1767959114927/i.test(k) && d[k]) console.log(`    ${k} = ${JSON.stringify(d[k])}`);
  }

  // 3) Имена стадий воронки сделки.
  const dstages: any[] = (await call("crm.status.list", { filter: { ENTITY_ID: "DEAL_STAGE_" + d.CATEGORY_ID }, order: { SORT: "ASC" } })).result || [];
  const dname: Record<string, string> = {}; dstages.forEach((s) => (dname[s.STATUS_ID] = s.NAME));

  // 4) История стадий сделки (как металась).
  const hist: any[] = (await call("crm.stagehistory.list", { entityTypeId: 2, filter: { ownerId: DEAL }, order: { id: "ASC" } })).result?.items || [];
  console.log(`\n=== ИСТОРИЯ СТАДИЙ СДЕЛКИ ${DEAL} (${hist.length} переходов) ===`);
  for (const h of hist) console.log(`  ${d16(h.createdTime)} -> ${dname[h.stageId] || h.stageId}`);

  // 5) Карточки каждого СП, привязанные к сделке (сколько раз перезапускались).
  console.log(`\n=== КАРТОЧКИ СП, привязанные к сделке ${DEAL} ===`);
  for (const t of want) {
    let items: any[] = [];
    try { items = (await call("crm.item.list", { entityTypeId: t.entityTypeId, filter: { parentId2: DEAL }, select: ["id", "title", "stageId", "createdTime", "closedate"] })).result?.items || []; }
    catch (e) { console.log(`  СП ${t.entityTypeId} «${t.title}»: ошибка ${e}`); continue; }
    if (!items.length) continue;
    console.log(`\n  СП ${t.entityTypeId} «${t.title}»: ${items.length} карточек`);
    for (const it of items) console.log(`    #${it.id} | стадия=${it.stageId} | созд=${d16(it.createdTime)} | закр=${(it.closedate || "").slice(0, 10)} | «${(it.title || "").slice(0, 46)}»`);
  }
  console.log("\n=== ГОТОВО ===");
})();
