// PROBE: есть ли в карточках смарт-процессов связь с конкретным ТОВАРОМ (товарной строкой)?
// От этого зависит, можно ли показать с/с по каждому товару, а не только по сделке.
// 1) Дамп ВСЕХ полей СП (id/label/type), подсветка «товарных»/ссылочных полей.
// 2) Пробуем товарные строки на самой карточке СП (crm.item.productrow.list с разными ownerType).
// Только чтение. Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/econ-tovar-probe.ts
const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SP = [{ etid: 1060, k: "Расчёт" }, { etid: 1086, k: "Производство GG" }, { etid: 1056, k: "Калькулятор" }, { etid: 1074, k: "Закупка" }];
const lbl = (d: any) => d.formLabel || d.listLabel || d.editFormLabel || d.title || "";
const PROD = /товар|издели|product|номенкл|позиц|артикул|связь|привязк/i;
const LINKT = /crm|iblock|element|product|entity|binding/i;

async function call(method: string, params: any = {}): Promise<any> {
  for (let a = 0; a < 6; a++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params), signal: AbortSignal.timeout(30000) });
      const j: any = await res.json();
      if (j.error) { if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await sleep(1200); a--; continue; } return { __err: j.error_description || j.error }; }
      return j;
    } catch (e: any) { await sleep(600 * (a + 1)); if (a === 5) return { __err: String(e && e.message || e) }; }
  }
}

(async () => {
  for (const sp of SP) {
    const fj = await call("crm.item.fields", { entityTypeId: sp.etid });
    const fields: Record<string, any> = fj.result?.fields || {};
    const ids = Object.keys(fields);
    console.error(`\n=== СП ${sp.etid} ${sp.k}: полей ${ids.length} ===`);
    // подсветка потенциальных «товарных»/ссылочных полей
    let hit = 0;
    for (const [id, def] of Object.entries(fields)) {
      const t = String(lbl(def)).trim(), ty = String((def as any).type || "");
      if (PROD.test(t) || PROD.test(id) || (LINKT.test(ty) && ty !== "string")) { console.error(`PLINK\t${sp.etid}\t${id}\t${t}\t${ty}`); hit++; }
    }
    if (!hit) console.error(`PLINK\t${sp.etid}\t(нет полей, похожих на связь с товаром)`);
    // типы полей — гистограмма
    const th: Record<string, number> = {}; for (const def of Object.values(fields)) { const ty = String((def as any).type || "?"); th[ty] = (th[ty] || 0) + 1; }
    console.error(`PTYPES\t${sp.etid}\t${Object.entries(th).sort((a, b) => b[1] - a[1]).map(([t, n]) => t + ":" + n).join(" ")}`);

    // берём одну карточку и пробуем её товарные строки
    const li = await call("crm.item.list", { entityTypeId: sp.etid, select: ["id"], order: { id: "DESC" }, start: -1 });
    const cardId = (li.result?.items || [])[0]?.id;
    if (!cardId) { console.error(`PROW\t${sp.etid}\tкарточек нет`); continue; }
    for (const ot of [String(sp.etid), "T" + sp.etid, "DYNAMIC_" + sp.etid, "T" + sp.etid + "_"]) {
      const pr = await call("crm.item.productrow.list", { filter: { "=ownerType": ot, "=ownerId": Number(cardId) } });
      const rows = pr.result?.productRows;
      if (pr.__err) console.error(`PROW\t${sp.etid}\townerType=${ot}\tОШИБКА: ${String(pr.__err).slice(0, 60)}`);
      else console.error(`PROW\t${sp.etid}\townerType=${ot}\tкарточка ${cardId}\tтоварных строк: ${(rows || []).length}${rows && rows[0] ? " · пример: " + (rows[0].productName || "").slice(0, 40) : ""}`);
    }
  }
  console.error("PROBE-DONE");
})();
