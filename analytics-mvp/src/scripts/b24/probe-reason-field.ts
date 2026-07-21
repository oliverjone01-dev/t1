// РАЗОВАЯ ДИАГНОСТИКА: найти актуальное поле «причина отказа» в Bitrix24.
// Причина: fetch-rop читает legacy AmoCRM-поле UF_CRM_DEAL_AMO_ELDDYDEQCJZIKJIM,
// у свежих отказов оно пустое (96%). Ищем, в какое поле причина пишется теперь.
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/probe-reason-field.ts

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(method: string, params: any = {}): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(30000),
      });
      const j: any = await res.json();
      if (j.error) {
        if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await sleep(1200); continue; }
        throw new Error(`${method}: ${j.error_description || j.error}`);
      }
      return j;
    } catch (e) { lastErr = e; await sleep(600 * (attempt + 1)); }
  }
  throw lastErr;
}

const OLD = "UF_CRM_DEAL_AMO_ELDDYDEQCJZIKJIM";

(async () => {
  // 1) Все поля сделки: кандидаты по названию/типу
  const f = await call("crm.deal.fields");
  const fields: Record<string, any> = f.result || {};
  const lbl = (d: any) => d.formLabel || d.listLabel || d.editFormLabel || d.title || "";
  console.log("=== КАНДИДАТЫ-ПОЛЯ (причина/отказ/провал/loss/reason) ===");
  const cands: string[] = [];
  for (const [id, def] of Object.entries(fields)) {
    const t = String(lbl(def));
    if (/причин|отказ|провал|proval|reason|lost|fail|отвал/i.test(t) || /REASON|LOSE|FAIL|PROVAL/i.test(id)) {
      cands.push(id);
      const items = (def.items || []).map((x: any) => `${x.ID}:${x.VALUE}`).slice(0, 20);
      console.log(`  ${id} | type=${def.type} | «${t}» | enum[${(def.items || []).length}]: ${items.join(" | ")}`);
    }
  }
  console.log(`(старое поле fetch-rop: ${OLD} - ${fields[OLD] ? "«" + lbl(fields[OLD]) + "»" : "НЕ существует"})`);

  // 2) Свежие отказные сделки: какие UF-поля непустые
  const lostRes = await call("crm.deal.list", {
    filter: { CATEGORY_ID: "49", STAGE_SEMANTIC_ID: "F" },
    order: { DATE_MODIFY: "DESC" },
    select: ["ID", "TITLE", "STAGE_ID", "CLOSEDATE", "ASSIGNED_BY_ID", "*", "UF_*"],
    start: 0,
  });
  const lost: any[] = lostRes.result || [];
  console.log(`\n=== ${Math.min(10, lost.length)} СВЕЖИХ ОТКАЗНЫХ: непустые UF-поля ===`);
  const nonEmptyCounter: Record<string, number> = {};
  for (const d of lost.slice(0, 10)) {
    const ufs = Object.entries(d).filter(([k, v]) =>
      k.startsWith("UF_") && v !== "" && v != null && !(Array.isArray(v) && v.length === 0) && String(v) !== "0");
    console.log(`#${d.ID} «${d.TITLE}» [${d.STAGE_ID}] close=${d.CLOSEDATE}`);
    for (const [k, v] of ufs) {
      nonEmptyCounter[k] = (nonEmptyCounter[k] || 0) + 1;
      // если это enum-поле - покажем расшифровку
      const def = fields[k];
      let disp = JSON.stringify(v);
      if (def && def.items) { const it = def.items.find((x: any) => String(x.ID) === String(v)); if (it) disp = `${v} = «${it.VALUE}»`; }
      console.log(`    ${k} = ${disp}  ${def ? "(«" + lbl(def) + "»)" : ""}`);
    }
  }
  console.log("\n=== UF-поля, ЧАЩЕ ВСЕГО заполненные у свежих отказов (кандидат на причину) ===");
  Object.entries(nonEmptyCounter).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([k, n]) => console.log(`  ${n}/10  ${k}  ${fields[k] ? "«" + lbl(fields[k]) + "»" : ""}`));

  // 3) Проверка конкретно сделки #97813 (пример пользователя) - все поля
  const one = await call("crm.deal.get", { id: "97813" });
  const od = one.result || {};
  console.log(`\n=== #97813 «${od.TITLE}» stage=${od.STAGE_ID} semantic=${od.STAGE_SEMANTIC_ID} - непустые UF ===`);
  for (const [k, v] of Object.entries(od)) {
    if (k.startsWith("UF_") && v !== "" && v != null && !(Array.isArray(v) && (v as any).length === 0) && String(v) !== "0") {
      const def = fields[k]; let disp = JSON.stringify(v);
      if (def && def.items) { const it = def.items.find((x: any) => String(x.ID) === String(v)); if (it) disp = `${v} = «${it.VALUE}»`; }
      console.log(`    ${k} = ${disp}  ${def ? "(«" + lbl(def) + "»)" : ""}`);
    }
  }
})();
