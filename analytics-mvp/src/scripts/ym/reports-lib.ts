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
