// Воронка вкладки «Тесты»: data/funnel_tests.ndjson.
//
// ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ ОБЩАЯ ВОРОНКА. Прежний источник funnel_sku_daily.ndjson был
// разовой выгрузкой: он кончился 21.09, и вкладка замерла, хотя позиция всё это время
// снималась каждый день (charts/v3, метрика search_position_graph). Ломался не сбор, а
// доставка, ровно как было с eb_pct. Теперь съём кладёт срез, который нужен именно тестам.
//
// ЧЕГО В ФАЙЛЕ НЕТ И НЕ БУДЕТ. Выручки по товару. Репозиторий публичный, поартикульная
// выручка в него не едет; если она нужна для расчёта, она остаётся на маке.
//
// АГРЕГАТ ПРИХОДИТ ДВУМЯ СТРОКАМИ (правило Ивана от 24.09). На каждую дату и тест кладутся
// обе: agg_median это медиана значений по группе, agg_sum это сумма. Одной мало, потому что
// оценщик выбирается по метрике: у позиции и показов осмысленна медиана, у корзины и заказов
// только сумма. Корзина это и показала: у контроля она лишь у 31 % артикулов в день, и
// медиана дневных индексов выходила ровно ноль во все дни подряд, рисуя пустую линию под
// подписью «-18 %». Теперь обе величины лежат рядом, и картинка не может спорить с числом.
//
// ПЛОТНОСТЬ ЛЕЖИТ В ДАННЫХ, А НЕ НА ГЛАЗ. У агрегатных строк обязательны n (сколько
// артикулов в счёте) и n_nonzero (у скольких значение ненулевое в этот день). Без них ноль
// приходит молча и неотличим от настоящего нуля. n_nonzero принимается и одним числом на всю
// строку, и объектом по метрикам; объект точнее, потому что у позиции ненулевых почти 100 %,
// а у заказов около 15 %, и один общий процент такую разницу стирает.
//
// ПРОПУЩЕННЫЙ ДЕНЬ ЭТО ОТСУТСТВИЕ СТРОКИ. Не ноль. Нулями дырки не заполняем: ноль показов
// и несобранный день это разные вещи, и разница между ними уже один раз нарисовала на
// графике обвал, которого не было.
import { existsSync, readFileSync } from "node:fs";

export const FUNNEL_TESTS_FILE = "funnel_tests.ndjson";

/** Роли строк. Товарные: test_ad (в рекламе, ждёт плато), test_sibling (сосед по карточке,
 *  рекламы нет), control. Агрегатные: agg_median и agg_sum, обе по группе контроля. */
export type FunnelRole = "test_ad" | "test_sibling" | "control" | "reference" | "agg_median" | "agg_sum";
const ROLES = new Set<FunnelRole>(["test_ad", "test_sibling", "control", "reference", "agg_median", "agg_sum"]);

/** Id теста может приехать полем test_id или префиксом в поле art. Первый прогон 24.09 писал
 *  «AGG:<id>», следуя конвенции прежнего контракта («MEDIAN:<id>»), и отвергать из-за этого
 *  420 строк значило бы выбросить данные из-за формы записи. Обе формы несут одно и то же. */
const AGG_PREFIXES = ["AGG:", "MEDIAN:"];
export const idFromArt = (art: string): string => {
  for (const p of AGG_PREFIXES) if (art.startsWith(p)) return art.slice(p.length);
  return "";
};
export const AGG_ROLES = new Set<FunnelRole>(["agg_median", "agg_sum"]);
export const TEST_ROLES = new Set<FunnelRole>(["test_ad", "test_sibling"]);
/** Июльский эталон: товар вне текущих групп, нужен карточке калибровки. */
export const REFERENCE_ROLE: FunnelRole = "reference";

/** Метрики файла в порядке воронки. Позиция стоит особняком: она уровень, у неё меньше
 *  значит лучше, и её пустое значение это null, а не ноль. */
export const FUNNEL_KEYS = ["search_position", "search_views", "pdp_views", "hits_to_cart", "ordered_units"] as const;
export type FunnelKey = typeof FUNNEL_KEYS[number];

export interface FunnelRow {
  date: string;
  role: FunnelRole;
  /** Артикул. Пусто у агрегатных строк. */
  art: string;
  /** Id теста. Пусто у товарных строк, обязателен у агрегатных. */
  test_id: string;
  search_position: number | null;
  search_views: number;
  pdp_views: number;
  hits_to_cart: number;
  ordered_units: number;
  /** Сколько артикулов в счёте. Только у агрегатов. */
  n: number | null;
  /** У скольких значение ненулевое в этот день, по метрикам. Только у агрегатов. */
  n_nonzero: Partial<Record<FunnelKey, number>> | null;
}

export interface FunnelRead {
  rows: FunnelRow[];
  /** Агрегаты: id теста -> роль -> день -> строка. */
  agg: Map<string, Map<FunnelRole, Map<string, FunnelRow>>>;
  /** Товарные строки: артикул -> день -> строка. */
  byArt: Map<string, Map<string, FunnelRow>>;
  /** Роль артикула по файлу (последняя встреченная). */
  roleOf: Map<string, FunnelRole>;
  /** Строки, которые не прошли контракт, с причиной. Молча их не выбрасываем. */
  bad: Array<{ line: number; why: string }>;
  first: string; last: string;
  exists: boolean;
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

/** n_nonzero к единому виду: число раскладывается на все метрики, объект берётся как есть.
 *  Возвращает причину отказа строкой. */
function parseNonzero(raw: unknown, n: number): Partial<Record<FunnelKey, number>> | string {
  const out: Partial<Record<FunnelKey, number>> = {};
  if (typeof raw === "number" || typeof raw === "string") {
    const v = num(raw);
    if (!Number.isFinite(v) || v < 0 || v > n) return `n_nonzero = «${String(raw)}» не число от 0 до n`;
    for (const k of FUNNEL_KEYS) out[k] = v;
    return out;
  }
  if (!raw || typeof raw !== "object") return "n_nonzero не число и не объект по метрикам";
  const r = raw as Record<string, unknown>;
  for (const k of FUNNEL_KEYS) {
    if (r[k] == null) continue;
    const v = num(r[k]);
    if (!Number.isFinite(v) || v < 0 || v > n) return `n_nonzero.${k} = «${String(r[k])}» не число от 0 до n`;
    out[k] = v;
  }
  if (!Object.keys(out).length) return "n_nonzero не содержит ни одной метрики файла";
  return out;
}

/** Разбор одной строки по контракту. Возвращает строку или причину отказа. */
export function parseRow(raw: unknown): FunnelRow | string {
  if (!raw || typeof raw !== "object") return "не объект";
  const r = raw as Record<string, unknown>;
  const date = String(r.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return `дата «${String(r.date ?? "")}» не вида ГГГГ-ММ-ДД`;
  const role = String(r.role ?? "") as FunnelRole;
  if (!ROLES.has(role)) return `роль «${String(r.role ?? "")}» не из ${[...ROLES].join("|")}`;
  const rawArt = String(r.art ?? "").trim();
  const isAgg = AGG_ROLES.has(role);
  // У агрегата id теста берётся из test_id либо из префикса в art, а сам art обнуляется:
  // агрегат относится к группе, а не к товару, и дальше по коду art у него должен быть пуст.
  const fromArt = isAgg ? idFromArt(rawArt) : "";
  const testId = String(r.test_id ?? "").trim() || fromArt;
  const art = isAgg ? "" : rawArt;
  // Артикул у агрегата допустим ТОЛЬКО как носитель id («AGG:<id>»). Настоящий артикул в
  // агрегатной строке это перепутанные роли, и молча обнулять его нельзя.
  if (isAgg && rawArt && !fromArt) {
    return `роль ${role} с артикулом «${rawArt}»: агрегат относится к группе, а не к товару`;
  }
  if (isAgg && !testId) return `роль ${role} без test_id`;
  if (!isAgg && !rawArt) return `роль ${role} без артикула`;
  if (!isAgg && idFromArt(rawArt)) return `роль ${role} с артикулом «${rawArt}»: этот префикс только у агрегатов`;

  // Позиция: число или null. Ноль позицией не бывает, это «не в выдаче».
  const rawPos = r.search_position;
  let pos: number | null = null;
  if (rawPos != null) {
    const p = num(rawPos);
    if (!Number.isFinite(p)) return `позиция «${String(rawPos)}» не число и не null`;
    pos = p > 0 ? p : null;
  }
  const out: FunnelRow = {
    date, art, role, test_id: testId, search_position: pos,
    search_views: 0, pdp_views: 0, hits_to_cart: 0, ordered_units: 0,
    n: null, n_nonzero: null,
  };
  for (const k of ["search_views", "pdp_views", "hits_to_cart", "ordered_units"] as const) {
    const v = num(r[k] ?? 0);
    if (!Number.isFinite(v) || v < 0) return `${k} = «${String(r[k])}» не неотрицательное число`;
    out[k] = v;
  }
  if (isAgg) {
    const n = num(r.n);
    if (!Number.isFinite(n) || n <= 0) return `роль ${role}: n = «${String(r.n)}» не положительное число`;
    if (r.n_nonzero == null) return `роль ${role} без n_nonzero: ноль без плотности неотличим от настоящего нуля`;
    const nz = parseNonzero(r.n_nonzero, n);
    if (typeof nz === "string") return `роль ${role}: ${nz}`;
    out.n = n; out.n_nonzero = nz;
  }
  return out;
}

export function readFunnelTests(path: string): FunnelRead {
  const empty: FunnelRead = {
    rows: [], agg: new Map(), byArt: new Map(), roleOf: new Map(), bad: [],
    first: "", last: "", exists: false,
  };
  if (!existsSync(path)) return empty;
  const out: FunnelRead = {
    ...empty, exists: true, agg: new Map(), byArt: new Map(), roleOf: new Map(), rows: [], bad: [],
  };
  const lines = readFileSync(path, "utf-8").split(/\r?\n/);
  lines.forEach((l, i) => {
    if (!l.trim()) return;
    let raw: unknown;
    try { raw = JSON.parse(l); } catch { out.bad.push({ line: i + 1, why: "не разбирается как JSON" }); return; }
    const r = parseRow(raw);
    if (typeof r === "string") { out.bad.push({ line: i + 1, why: r }); return; }
    out.rows.push(r);
    if (AGG_ROLES.has(r.role)) {
      const byRole = out.agg.get(r.test_id) ?? new Map<FunnelRole, Map<string, FunnelRow>>();
      const byDay = byRole.get(r.role) ?? new Map<string, FunnelRow>();
      byDay.set(r.date, r); byRole.set(r.role, byDay); out.agg.set(r.test_id, byRole);
    } else {
      const m = out.byArt.get(r.art) ?? new Map<string, FunnelRow>();
      m.set(r.date, r); out.byArt.set(r.art, m);
      out.roleOf.set(r.art, r.role);
    }
    if (!out.first || r.date < out.first) out.first = r.date;
    if (r.date > out.last) out.last = r.date;
  });
  return out;
}

/** Агрегатный ряд нужной роли: тест -> метрика -> день. */
export function aggDay(read: FunnelRead, testId: string, role: FunnelRole, day: string): FunnelRow | null {
  return read.agg.get(testId)?.get(role)?.get(day) ?? null;
}

/** Дни, в которые артикул пропал из съёма: от его ПЕРВОГО дня до последнего дня ФАЙЛА.
 *
 *  Считать «от первого до последнего дня самого артикула» мало: 22.09 четыре тестовых товара
 *  выпали и обратно не вернулись, то есть пропажа пришлась на хвост, и такая проверка её бы
 *  не увидела вовсе. Правая граница поэтому общая по файлу: если у других товаров день есть,
 *  а у этого нет, это потеря, а не конец жизни товара.
 *
 *  Левая граница своя у каждого артикула: товар, добавленный в тест позже, не должен
 *  светиться пропажей за все прошлые дни. */
export function missingDays(days: Map<string, unknown>, allDays: string[]): string[] {
  const seen = [...days.keys()].sort();
  if (!seen.length || allDays.length < 2) return [];
  const from = seen[0]!, to = allDays[allDays.length - 1]!;
  return allDays.filter((d) => d >= from && d <= to && !days.has(d));
}
