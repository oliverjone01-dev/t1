// Категоризация типов начислений OZON (/v1/finance/accrual/types, ~124 типа) по бакетам дашборда.
// Работает по ИМЕНИ типа (устойчивее, чем зашивать 124 id, и переживает добавление новых типов).
// Соответствует прежней логике svcBucket (pnl-sku-daily) + отдельная комиссия за продажу.
// Выручки за продажу в начислениях НЕТ - она берётся отдельно (реализация / financial_data).

export type Bucket = "commission" | "acquiring" | "storage" | "delivery" | "buyerDelivery" | "ads" | "other";

export function bucketOfType(name: string): Bucket {
  const n = String(name || "").toLowerCase();
  if (/salecommission|вознаграждение за прод|комисси/.test(n)) return "commission";
  if (/acquiring|эквайринг/.test(n)) return "acquiring";
  if (/placement|replenishment|storage|размещени|хранени|склад/.test(n)) return "storage";
  // Доставка от покупателя (rFBS) компенсируется - отдельный бакет, в расчёт сборов не входит.
  if (/rfbsbuyerdelivery|rfbsclientdeliverycharge|доставку от покупател|перечисление за доставку/.test(n)) return "buyerDelivery";
  if (/payperclick|promotion|stencil|marketing|advertis|трафарет|продвижен|реклам|лидогенерац|premiumcashbackpromotion|videocover|pushcampaign|socialmedia/.test(n)) return "ads";
  if (/logistic|lastmile|last mile|pick-?up|drop-?off|shipment|handover|returnflow|preparingtoreturn|sellerreturns|partialreturn|courierpickup|deliveryto|supplyinbound|clickandcollect|логист|доставк|возврат|магистрал|последняя миля|выдач/.test(n)) return "delivery";
  return "other";
}

// По списку типов из accrualTypes() -> карта id -> bucket (для быстрой разметки начислений по type_id).
export function bucketMap(types: Array<{ id: number; name: string }>): Record<number, Bucket> {
  const m: Record<number, Bucket> = {};
  for (const t of types) m[t.id] = bucketOfType(t.name);
  return m;
}
