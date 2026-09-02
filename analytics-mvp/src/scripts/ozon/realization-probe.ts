// РАЗВЕДКА: где в API «реализовано с учётом возвратов» (бухгалтерская реализация, как в УПД).
// 1) /v2/finance/realization {month,year} - месячный отчёт о реализации товаров. Дампит верхние
//    ключи, первую строку (чтобы узнать точные поля), суммирует количество продано/возвращено.
// 2) /v3/finance/transaction/list за месяц - считает штуки по операциям доставки минус возвраты,
//    чтобы понять, даёт ли транзакционный реестр то же число (и есть ли в items количество).
// НЕ в ночном синке. Запуск: tsx realization-probe.ts [YYYY] [M]
import { OzonSeller } from "../../connector/ozon-seller.js";

const SELLER_HOST = "https://api-seller.ozon.ru";

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("realization-probe: OZON_SELLER_* нет - пропуск"); return; }
  const year = Number(process.argv[2] || "2026"), month = Number(process.argv[3] || "7");
  const headers = { "Client-Id": clientId, "Api-Key": apiKey, "Content-Type": "application/json" };

  // --- 1) отчёт о реализации ---
  console.log(`\n=== /v2/finance/realization month=${month} year=${year} ===`);
  try {
    const res = await fetch(`${SELLER_HOST}/v2/finance/realization`, { method: "POST", headers, body: JSON.stringify({ month, year }) });
    if (!res.ok) { console.log(`  HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`); }
    else {
      const data: any = await res.json();
      const result = data.result ?? data;
      console.log("  верхние ключи result:", Object.keys(result || {}).join(", "));
      const rows: any[] = result.rows ?? result.report_rows ?? [];
      console.log("  строк:", rows.length);
      if (rows[0]) console.log("  ПЕРВАЯ СТРОКА:", JSON.stringify(rows[0]).slice(0, 900));
      // Пытаемся суммировать количество по вероятным полям
      const deep = (o: any, re: RegExp): number => {
        let s = 0; if (!o || typeof o !== "object") return 0;
        for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === "number" && re.test(k)) s += v; else if (v && typeof v === "object") s += deep(v, re); }
        return s;
      };
      let soldQty = 0, retQty = 0;
      for (const r of rows) { soldQty += deep(r.delivery ?? r, /(^|_)(quantity|qty|count)$/i); retQty += deep(r.return ?? {}, /(^|_)(quantity|qty|count)$/i); }
      console.log(`  СУММА кол-ва (delivery-ветка, эвристика): ${soldQty}, (return-ветка): ${retQty}, нетто: ${soldQty - retQty}`);
    }
  } catch (e) { console.log("  realization FAILED:", (e as Error).message); }

  // --- 2) транзакционный реестр: штуки по доставкам минус возвраты ---
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
  console.log(`\n=== /v3/finance/transaction/list ${from}..${to} (штуки по типам) ===`);
  try {
    const ops = await new OzonSeller({ clientId, apiKey }).transactions(from, to);
    let sampleItem = "";
    const byType: Record<string, { items: number; ops: number }> = {};
    for (const o of ops) {
      const tn = String(o.operation_type_name || o.operation_type || "?");
      const items = o.items || [];
      if (!sampleItem && items[0]) sampleItem = JSON.stringify(items[0]);
      (byType[tn] ||= { items: 0, ops: 0 });
      byType[tn]!.items += items.length; byType[tn]!.ops++;
    }
    console.log("  пример элемента items[0]:", sampleItem || "(нет)");
    for (const [k, v] of Object.entries(byType).sort((a, b) => b[1].items - a[1].items)) {
      console.log(`  ${String(v.items).padStart(6)} шт (items) / ${String(v.ops).padStart(5)} оп  ${k}`);
    }
  } catch (e) { console.log("  transactions FAILED:", (e as Error).message); }
}
main().catch((e) => { console.error("realization-probe FAILED:", (e as Error).message); process.exit(0); });
