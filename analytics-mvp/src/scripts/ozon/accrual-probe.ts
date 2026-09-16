// PROBE: формат новых finance-методов OZON, заменивших /v3/finance/transaction/list (отключён
// 08.09.2026). Дёргает /v1/finance/accrual/types|by-day|postings разными телами запроса и
// печатает HTTP-статус, верхние ключи ответа и первую строку - чтобы снять схему под миграцию
// pnl-* скриптов. НЕ в ночном синке. Запуск: tsx accrual-probe.ts [from YYYY-MM-DD] [to].
const SELLER_HOST = "https://api-seller.ozon.ru";

async function hit(headers: any, path: string, body: any) {
  const tag = `${path}  body=${JSON.stringify(body)}`;
  try {
    const res = await fetch(`${SELLER_HOST}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) { console.log(`  [${res.status}] ${path} :: ${text.slice(0, 300)}`); return; }
    let data: any; try { data = JSON.parse(text); } catch { console.log(`  [200] ${path} :: не-JSON ${text.slice(0, 200)}`); return; }
    const result = data.result ?? data;
    const topKeys = Object.keys(result || {});
    console.log(`  [200] ${path}`);
    console.log(`        верхние ключи: ${topKeys.join(", ")}`);
    // найдём первый массив строк
    for (const k of topKeys) {
      const v = (result as any)[k];
      if (Array.isArray(v) && v.length) { console.log(`        ${k}[${v.length}] первая: ${JSON.stringify(v[0]).slice(0, 700)}`); break; }
    }
    if (Array.isArray(result) && result.length) console.log(`        result[${result.length}] первая: ${JSON.stringify(result[0]).slice(0, 700)}`);
  } catch (e) { console.log(`  ERR ${path}: ${(e as Error).message}`); }
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("accrual-probe: OZON_SELLER_* нет - пропуск"); return; }
  const from = process.argv[2] || "2026-08-01", to = process.argv[3] || "2026-08-31";
  const headers = { "Client-Id": clientId, "Api-Key": apiKey, "Content-Type": "application/json" };
  const fromZ = `${from}T00:00:00.000Z`, toZ = `${to}T23:59:59.999Z`;

  // Полный справочник типов начислений (id -> name) - основа маппинга type_id по категориям.
  console.log(`=== /v1/finance/accrual/types (ВСЕ 124 типа: id | name) ===`);
  try {
    const r = await fetch(`${SELLER_HOST}/v1/finance/accrual/types`, { method: "POST", headers, body: "{}" });
    const d: any = await r.json();
    const types = d.accrual_types ?? d.result?.accrual_types ?? [];
    for (const t of types) console.log(`  ${t.id}\t${t.name}${t.description && t.description !== t.name ? " ("+t.description+")" : ""}`);
    console.log(`  всего типов: ${types.length}`);
  } catch (e) { console.log("  types ERR:", (e as Error).message); }

  const day = from; // одна дата YYYY-MM-DD
  console.log(`\n=== /v1/finance/accrual/by-day - ищем ITEM-строку с item_fees (структура per-SKU) ===`);
  try {
    const r = await fetch(`${SELLER_HOST}/v1/finance/accrual/by-day`, { method: "POST", headers, body: JSON.stringify({ date: day }) });
    const d: any = await r.json();
    const arr = d.accruals ?? [];
    const item = arr.find((a: any) => a.accrued_category === "ITEM" || a.item_fees) || arr[0];
    console.log("  ITEM-строка (item_fees структура):", JSON.stringify(item).slice(0, 900));
  } catch (e) { console.log("  by-day ITEM ERR:", (e as Error).message); }

  // Источник ВЫРУЧКИ: financial_data отправления (в начислениях выручки нет).
  console.log(`\n=== /v2/posting/fbo/list with financial_data (источник выручки) ${from}..${to} ===`);
  let postingNumbers: string[] = [];
  try {
    const r = await fetch(`${SELLER_HOST}/v2/posting/fbo/list`, { method: "POST", headers, body: JSON.stringify({ dir: "ASC", filter: { since: fromZ, to: toZ, status: "" }, limit: 20, offset: 0, with: { financial_data: true } }) });
    const t = await r.text();
    if (!r.ok) console.log(`  [${r.status}] fbo/list :: ${t.slice(0, 200)}`);
    else {
      const d: any = JSON.parse(t); const arr = d.result ?? [];
      postingNumbers = arr.map((p: any) => p.posting_number).filter(Boolean).slice(0, 50);
      console.log(`  fbo/list: ${arr.length} отправлений, взял ${postingNumbers.length}`);
      const withFd = arr.find((p: any) => p.financial_data);
      if (withFd) {
        const fd = withFd.financial_data; const prod = (fd.products || [])[0];
        console.log("  financial_data.products[0]:", JSON.stringify(prod).slice(0, 700));
        console.log("  financial_data (верхние ключи):", Object.keys(fd).join(", "));
      } else console.log("  financial_data нет в ответе (проверить поле with)");
    }
  } catch (e) { console.log("  fbo/list ERR:", (e as Error).message); }

  console.log(`\n=== /v1/finance/accrual/postings (начисления по отправлениям) ===`);
  if (postingNumbers.length) await hit(headers, "/v1/finance/accrual/postings", { posting_numbers: postingNumbers });
  else console.log("  нет posting_number - postings пропущен");

  console.log("\nВЫВОД: смотрим поля в строках by-day и postings (суммы/комиссии/услуги/type_id/posting_number/sku/дата) - по ним строим миграцию pnl-*.");
}
main().catch((e) => { console.error("accrual-probe FAILED:", (e as Error).message); process.exit(0); });
