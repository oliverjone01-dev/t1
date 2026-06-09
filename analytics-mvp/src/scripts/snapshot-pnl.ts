// Нормализует сырой ответ pnl-вебхука в fixtures/pnl_30d.json:
// группирует статьи services в категории сборов. Запуск: tsx snapshot-pnl.ts <raw.json>
import { readFileSync, writeFileSync } from "node:fs";

interface Raw {
  dateFrom: string; dateTo: string; ops: number;
  accruals: number; commission: number; payout: number;
  services: Record<string, number>;
}

function category(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("brand")) return "Бренд-комиссия";
  if (n.includes("acquir")) return "Эквайринг";
  if (n.includes("installment")) return "Рассрочка";
  if (n.includes("storage")) return "Хранение";
  if (n.includes("membership") || n.includes("premium") || n.includes("subscription") || n.includes("stars")) return "Подписки (Stars/Premium/отзывы)";
  if (n.includes("logistic") || n.includes("dropoff") || n.includes("lastmile") || n.includes("deliverytohandover") || n.includes("returnspvz") || n.includes("courier")) return "Логистика (прямая+возвратная)";
  return "Прочее";
}

function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Укажи raw.json");
  const raw = JSON.parse(readFileSync(path, "utf-8")) as Raw;
  const breakdown: Record<string, number> = { "Комиссия за продажу": Math.round(raw.commission) };
  for (const [name, val] of Object.entries(raw.services || {})) {
    const cat = category(name);
    breakdown[cat] = Math.round((breakdown[cat] || 0) + val);
  }
  const out = {
    dateFrom: raw.dateFrom, dateTo: raw.dateTo, ops: raw.ops,
    accruals: Math.round(raw.accruals), commission: Math.round(raw.commission), payout: Math.round(raw.payout),
    breakdown,
  };
  writeFileSync("fixtures/pnl_30d.json", JSON.stringify(out));
  console.log(`pnl_30d.json: выручка ${out.accruals}, к начислению ${out.payout}, статей ${Object.keys(breakdown).length}`);
}

main();
