// Нормализация чисел из OZON. Подводный камень DOC_02 §3.2:
// Performance API отдаёт moneySpent / ordersMoney с запятой как десятичным
// разделителем ("0,00", "1 234,56"). Парсить через замену запятой на точку
// и удаление разделителей разрядов.

export function parseOzonNumber(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (s === "") return 0;
  // убрать пробелы (в т.ч. неразрывные) как разделители тысяч, запятую -> точку
  const cleaned = s.replace(/[\s ]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Безопасное деление: 0 при нулевом знаменателе (для конверсий, ДРР, маржи).
export function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

// Дельта между текущим и сравнительным значением: абсолют и доля.
export function delta(cur: number, cmp: number): { abs: number; pct: number } {
  return { abs: cur - cmp, pct: safeDiv(cur - cmp, cmp) };
}
