// РАЗВЕДКА «где в Bitrix24 лежат деньги/себестоимость по сделке».
// Задача Богдана: собрать по сделке все суммы из сущностей - Бюджет сделки, СП Расчёт,
// СП Калькулятор, СП Закупка (по столбцам с/с), плюс Производство (себестоимость по участкам),
// срок/просрочка и рекламации. Чтобы это выгрузить, сперва надо узнать entityTypeId смарт-
// процессов и КОДЫ их денежных полей + как они привязаны к сделке. Этот скрипт ничего не
// коммитит - только печатает карту сущностей и полей в лог.
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/probe-money-entities.ts

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
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

// «Денежное» поле: тип money/double ИЛИ название про деньги/себестоимость/сумму/цену/закупку.
const MONEY_RE = /с\/с|себестоим|сумма|стоим|цена|прайс|бюджет|закуп|расч[её]т|калькул|маржа|наценк|прибыл|итого|money|cost|price|amount|total|sum/i;
const lbl = (d: any) => d.formLabel || d.listLabel || d.editFormLabel || d.title || d.name || "";

function dumpFields(fields: Record<string, any>, tag: string) {
  const money: string[] = [];
  const links: string[] = [];
  for (const [id, def] of Object.entries(fields)) {
    const t = String(lbl(def)), type = String(def.type || "");
    if (/money|double|integer/i.test(type) && MONEY_RE.test(t + " " + id)) money.push(`    ${id} | ${type} | «${t}»`);
    else if (MONEY_RE.test(t)) money.push(`    ${id} | ${type} | «${t}»  (по названию)`);
    if (/parent|deal|сделк|привязк|link|crm_/i.test(t + " " + id) && /crm|entity|deal|integer/i.test(type + " " + id)) links.push(`    ${id} | ${type} | «${t}»`);
  }
  console.log(`\n== ${tag}: денежные поля ==`);
  console.log(money.length ? money.join("\n") : "    (не найдено — смотри полный список ниже)");
  console.log(`  -- связи со сделкой/родителем --`);
  console.log(links.length ? links.join("\n") : "    (нет явных — возможно parentId2 / crm.item.list parentId)");
}

(async () => {
  // 1) Все смарт-процессы: entityTypeId + название (ищем Расчёт/Калькулятор/Закупка/Производство/Рекламация).
  console.log("=== СМАРТ-ПРОЦЕССЫ (crm.type.list) ===");
  const types = (await call("crm.type.list", { select: ["entityTypeId", "title", "isCategoriesEnabled"] })).result?.types || [];
  for (const t of types) console.log(`  entityTypeId=${t.entityTypeId} | «${t.title}»${t.isCategoriesEnabled ? " (есть направления)" : ""}`);
  const want = types.filter((t: any) => /расч[её]т|калькул|закуп|производ|реклам|претенз|смет/i.test(t.title || ""));
  console.log(`\nКандидаты по задаче Богдана: ${want.map((t: any) => `${t.entityTypeId}=«${t.title}»`).join(" | ") || "не распознано — смотри полный список выше"}`);

  // 2) Сделка: денежные поля + срок/дедлайн + намёки на рекламацию.
  const df = (await call("crm.deal.fields")).result || {};
  dumpFields(df, "СДЕЛКА (crm.deal)");
  console.log(`  -- срок/дедлайн/просрочка/рекламация в сделке --`);
  for (const [id, def] of Object.entries<any>(df)) {
    const t = String(lbl(def));
    if (/срок|дедлайн|просроч|deadline|реклам|претенз|close|отгруз|сдач|готов/i.test(t + " " + id)) console.log(`    ${id} | ${def.type} | «${t}»`);
  }

  // 3) По каждому кандидату-СП: поля + 3 примера с непустыми деньгами + привязка к сделке.
  for (const t of want) {
    const etid = t.entityTypeId;
    console.log(`\n\n######## СП ${etid} «${t.title}» ########`);
    let fields: Record<string, any> = {};
    try { fields = (await call("crm.item.fields", { entityTypeId: etid })).result?.fields || {}; }
    catch (e) { console.log("  crm.item.fields ошибка:", String(e)); continue; }
    dumpFields(fields, `СП ${etid}`);
    // примеры
    let items: any[] = [];
    try { items = (await call("crm.item.list", { entityTypeId: etid, order: { id: "DESC" }, select: ["*", "uf*"] })).result?.items || []; }
    catch (e) { console.log("  crm.item.list ошибка:", String(e)); }
    console.log(`  -- ${Math.min(3, items.length)} свежих карточек: непустые денежные значения + привязка --`);
    for (const it of items.slice(0, 3)) {
      const parent = it.parentId2 ?? it.parentId ?? "";
      const moneyVals = Object.entries(it).filter(([k, v]) => {
        const def = fields[k]; const t2 = def ? String(lbl(def)) : "";
        return v && String(v) !== "0" && (MONEY_RE.test(t2) || MONEY_RE.test(k)) && !Array.isArray(v);
      }).map(([k, v]) => `${k}=${v}`);
      console.log(`    #${it.id} «${it.title || ""}» parentId2(сделка?)=${parent} | ${moneyVals.join(", ") || "нет денег в полях"}`);
    }
    // полный список полей карточки (id | type | label) - чтобы вручную сверить с/с столбцы
    console.log(`  -- ВСЕ поля карточки (id | type | «label») --`);
    for (const [id, def] of Object.entries(fields)) console.log(`      ${id} | ${def.type} | «${lbl(def)}»`);
  }

  console.log("\n=== ГОТОВО. Скопируй entityTypeId и коды денежных полей в export-money.ts ===");
})();
