// Чистые помощники разбора отчётов Маркета (без сети и файлов - тестируются напрямую).
// Роль CSV внутри архива реализации. Имя файла - основной признак, заголовки - запасной
// (если Маркет переименует файлы). Всё, что не «доставлено» и не «возвращено», в штуки не идёт.
export function realizationRole(name: string, headers: string[]): "delivered" | "returned" | null {
  const n = name.toLowerCase();
  if (/return|возврат/.test(n)) return "returned";
  if (/unredeemed|lost|невыкуп|потер/.test(n)) return null;
  if (/^delivered|[_-]delivered/.test(n) || /достав/.test(n)) return "delivered";
  if (/transferred/.test(n) || /передан/.test(n)) return null; // надмножество delivered
  const h = headers.map((x) => x.toUpperCase());
  if (h.includes("RETURNED_COUNT")) return "returned";
  if (h.includes("DELIVERED_COUNT")) return "delivered";
  return null;
}

// Лимит генерации отчётов Маркета: HTTP 420 / METHOD_FAILURE «Hit rate limit». Живой факт 2026-09-04:
// 1 генерация на 2 минуты на кабинет для goods-realization и united-netting, 1 на 6 минут для
// shows-sales. Это не ошибка данных: продьюсер обязан сохранить собранное и продолжить в следующий прогон.
export function isRateLimit(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /HTTP 420/.test(m) || /rate limit/i.test(m) || /METHOD_FAILURE/.test(m);
}

// Дедуп проводок взаиморасчётов. Ключ - TRANSACTION_ID: он уникален у Маркета и переживает
// пересечение месячных окон. Строки без id (старые выгрузки до появления колонки) схлопываются по
// составному ключу - это может съесть две буквально одинаковые проводки, поэтому такой путь только
// запасной. Порядок входа задаёт приоритет: первым передавайте свежую выгрузку.
export interface NettingLike { d: string; tx?: string; order?: string; sku?: string; type?: string; service?: string; amount: number; po?: string }
export function dedupeNetting<T extends NettingLike>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = r.tx ? `tx:${r.tx}` : `k:${r.d}|${r.order || ""}|${r.sku || ""}|${r.type || ""}|${r.service || ""}|${r.amount}|${r.po || ""}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(r);
  }
  return out;
}
