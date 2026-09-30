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
//
// ЖИВОЙ ФАКТ 28.09.2026 (сверка с отчётом об исполнении поручения за июль, кабинет 74986385): две
// настоящие проводки «Отзывы за баллы» по −1 ₽ в один день по одному заказу схлопывались в одну,
// и услуги расходились с документом на 1 ₽. Поэтому у одинаковых строк ВНУТРИ одной выгрузки есть
// порядковый номер `n` (0, 1, ...; см. numberDuplicates). Соседние месячные выгрузки отдают ту же
// пару с теми же номерами 0 и 1 - пересечение по-прежнему схлопывается, а настоящие двойники живут.
export interface NettingLike { d: string; tx?: string; order?: string; sku?: string; type?: string; service?: string; amount: number; po?: string; n?: number }
const nettingKey = (r: NettingLike) => `k:${r.d}|${r.order || ""}|${r.sku || ""}|${r.type || ""}|${r.service || ""}|${r.amount}|${r.po || ""}`;
export function numberDuplicates<T extends NettingLike>(rows: T[]): T[] {
  const cnt = new Map<string, number>();
  return rows.map((r) => {
    const k = nettingKey(r), i = cnt.get(k) || 0;
    cnt.set(k, i + 1);
    return i ? { ...r, n: i } : r;
  });
}
export function dedupeNetting<T extends NettingLike>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = r.tx ? `tx:${r.tx}` : `${nettingKey(r)}|${r.n || 0}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(r);
  }
  return out;
}

// Какие месяцы возобновляемого месячного отчёта брать в этот прогон (акт по стоимости услуг,
// отчёт по баллам Маркета - у них одинаковое состояние: done по парам «кабинет/месяц»).
// Что осталось добрать, знает СОСТОЯНИЕ (done по парам кабинет/месяц), а не «файл пустой» и не
// «схема сменилась». Пока список считался по этим двум признакам, после первого же прогона на
// новой схеме коллектор брал только прошлый и текущий месяц: февраль-июль оставались собранными
// старой версией, общие расходы июля сидели на одной дате 31.07, и свод за часть месяца показал
// бы их либо целиком, либо ноль. Живой факт 2026-09-16, прогон 37: схема уже 2, файл не пуст,
// done = две августовские пары - шаг отработал за 4 секунды и не добрал ничего.
//
// all      - все месяцы от нижней границы по текущий включительно;
// done     - ключи вида "<кабинет>/<YYYY-MM>" из состояния;
// cur/prev - текущий и прошлый месяц: их перезабираем всегда, акт за них ещё дополняется;
// full     - признак «пересобрать всё» (пустой файл или смена схемы разбора).
// Сколько первых дней месяца перезабираем прошлый месяц, даже если он уже «собран».
// Отчёт, сформированный в день X, кончается днём X-1: последний прогон месяца (30.09) не видит
// списаний 30.09, а 1.10 сентябрь уже в done и пропускался бы навсегда (G1 ФЕНИКСА, 2026-09-30).
// Пять дней - запас на прогоны, упавшие в лимит генерации [ГИПОТЕЗА, проверка 1-2.10].
export const PREV_MONTH_REFETCH_DAYS = 5;

// С какого месяца список перезабирается, даже если пара кабинет/месяц уже в done.
// Обычно - последний месяц списка; в первые PREV_MONTH_REFETCH_DAYS дней (UTC) - прошлый
// календарный месяц, если он в списке раньше последнего.
export function reportFreshFrom(months: string[], now: Date, graceDays = PREV_MONTH_REFETCH_DAYS): string {
  if (!months.length) return "";
  const last = months[months.length - 1]!;
  if (now.getUTCDate() > graceDays) return last;
  const p = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prev = `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, "0")}`;
  return prev < last ? prev : last;
}

export function reportMonthsToDo(all: string[], done: Iterable<string>, cur: string, prev: string, full = false): string[] {
  if (full) return all;
  const keys = [...done];
  if (!keys.length) return all;   // состояния нет - собирать нечего от чего отталкиваться
  const byYm = new Map<string, number>();
  for (const k of keys) { const ym = k.slice(k.indexOf("/") + 1); byYm.set(ym, (byYm.get(ym) || 0) + 1); }
  // «Месяц собран» - это столько пар, сколько у самого полного месяца. Иначе месяц, где успел
  // отработать один кабинет из двух, считался бы закрытым.
  const most = Math.max(...byYm.values());
  return all.filter((m) => m === cur || m === prev || (byYm.get(m) || 0) < most);
}
