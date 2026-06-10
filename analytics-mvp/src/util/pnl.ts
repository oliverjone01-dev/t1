// Нормализация сырого ответа pnl-вебхука OZON (services с кодами) в читаемый breakdown.
// Единый источник группировки: используется и снапшотом, и live-fetch (Protocol: один смысл - одно место).

export interface RawPnl {
  dateFrom: string; dateTo: string; ops: number;
  accruals: number; commission: number; payout: number;
  services?: Record<string, number>;
}

export interface NormPnl {
  dateFrom: string; dateTo: string; ops: number;
  accruals: number; commission: number; payout: number;
  breakdown: Record<string, number>;
}

// Код услуги OZON -> человекочитаемая группа сборов.
export function category(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("brand")) return "Бренд-комиссия";
  if (n.includes("acquir")) return "Эквайринг";
  if (n.includes("installment")) return "Рассрочка";
  if (n.includes("storage")) return "Хранение";
  if (n.includes("membership") || n.includes("premium") || n.includes("subscription") || n.includes("stars")) return "Подписки (Stars/Premium/отзывы)";
  if (n.includes("logistic") || n.includes("dropoff") || n.includes("lastmile") || n.includes("deliverytohandover") || n.includes("returnspvz") || n.includes("courier")) return "Логистика (прямая+возвратная)";
  return "Прочее";
}

export function normalizePnl(raw: RawPnl): NormPnl {
  const breakdown: Record<string, number> = { "Комиссия за продажу": Math.round(raw.commission) };
  for (const [name, val] of Object.entries(raw.services || {})) {
    const cat = category(name);
    breakdown[cat] = Math.round((breakdown[cat] || 0) + val);
  }
  return {
    dateFrom: raw.dateFrom, dateTo: raw.dateTo, ops: raw.ops,
    accruals: Math.round(raw.accruals), commission: Math.round(raw.commission), payout: Math.round(raw.payout),
    breakdown,
  };
}
