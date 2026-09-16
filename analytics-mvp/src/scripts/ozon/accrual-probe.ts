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

  console.log(`=== /v1/finance/accrual/types (справочник типов начислений) ===`);
  await hit(headers, "/v1/finance/accrual/types", {});

  console.log(`\n=== /v1/finance/accrual/by-day (дневные агрегаты) ${from}..${to} ===`);
  await hit(headers, "/v1/finance/accrual/by-day", { date: { from: fromZ, to: toZ } });
  await hit(headers, "/v1/finance/accrual/by-day", { from, to });
  await hit(headers, "/v1/finance/accrual/by-day", { date_from: from, date_to: to });

  console.log(`\n=== /v1/finance/accrual/postings (начисления по отправлениям) ${from}..${to} ===`);
  await hit(headers, "/v1/finance/accrual/postings", { date: { from: fromZ, to: toZ }, page: 1, page_size: 100 });
  await hit(headers, "/v1/finance/accrual/postings", { filter: { date: { from: fromZ, to: toZ } }, page: 1, page_size: 100 });
  await hit(headers, "/v1/finance/accrual/postings", { from, to, page: 1, page_size: 100 });

  console.log("\nВЫВОД: смотрим, какой из вариантов тела дал [200] и какие поля в строках (суммы/комиссии/услуги/posting_number/sku/дата) - по ним строим миграцию pnl-*.");
}
main().catch((e) => { console.error("accrual-probe FAILED:", (e as Error).message); process.exit(0); });
