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
// МЕДИАНА ПРИХОДИТ ГОТОВОЙ. Строка с art вида MEDIAN:<id теста> это медиана группового
// контроля за день, уже очищенная на маке по карте карточек: все товары снимка минус
// артикулы теста минус все, кто делит с ними карточку. Повторно чистить нельзя, иначе
// чистка применится дважды.
//
// ПРОПУЩЕННЫЙ ДЕНЬ ЭТО ОТСУТСТВИЕ СТРОКИ. Не ноль. Нулями дырки не заполняем: ноль показов
// и несобранный день это разные вещи, и разница между ними уже один раз нарисовала на
// графике обвал, которого не было.
import { existsSync, readFileSync } from "node:fs";

export const FUNNEL_TESTS_FILE = "funnel_tests.ndjson";
export const MEDIAN_PREFIX = "MEDIAN:";

export type FunnelRole = "test" | "control" | "median" | "reference";
const ROLES = new Set<FunnelRole>(["test", "control", "median", "reference"]);

/** Метрики файла в порядке воронки. Позиция стоит особняком: она уровень, у неё меньше
 *  значит лучше, и её пустое значение это null, а не ноль. */
export const FUNNEL_KEYS = ["search_position", "search_views", "pdp_views", "hits_to_cart", "ordered_units"] as const;
export type FunnelKey = typeof FUNNEL_KEYS[number];

export interface FunnelRow {
  date: string;
  art: string;
  role: FunnelRole;
  search_position: number | null;
  search_views: number;
  pdp_views: number;
  hits_to_cart: number;
  ordered_units: number;
}

export interface FunnelRead {
  rows: FunnelRow[];
  /** Медианы группового контроля: id теста -> день -> строка. */
  medians: Map<string, Map<string, FunnelRow>>;
  /** Обычные товары (test, control, reference): артикул -> день -> строка. */
  byArt: Map<string, Map<string, FunnelRow>>;
  /** Строки, которые не прошли контракт, с причиной. Молча их не выбрасываем. */
  bad: Array<{ line: number; why: string }>;
  first: string; last: string;
  exists: boolean;
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

/** Разбор одной строки по контракту. Возвращает строку или причину отказа. */
export function parseRow(raw: unknown): FunnelRow | string {
  if (!raw || typeof raw !== "object") return "не объект";
  const r = raw as Record<string, unknown>;
  const date = String(r.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return `дата «${String(r.date ?? "")}» не вида ГГГГ-ММ-ДД`;
  const art = String(r.art ?? "").trim();
  if (!art) return "пустой артикул";
  const role = String(r.role ?? "") as FunnelRole;
  if (!ROLES.has(role)) return `роль «${String(r.role ?? "")}» не из test|control|median|reference`;
  if (role === "median" && !art.startsWith(MEDIAN_PREFIX)) return `роль median, но артикул не «${MEDIAN_PREFIX}<id теста>»`;
  if (role !== "median" && art.startsWith(MEDIAN_PREFIX)) return `артикул «${MEDIAN_PREFIX}…» с ролью ${role}`;

  // Позиция: число или null. Ноль позицией не бывает, это «не в выдаче».
  const rawPos = r.search_position;
  let pos: number | null = null;
  if (rawPos != null) {
    const p = num(rawPos);
    if (!Number.isFinite(p)) return `позиция «${String(rawPos)}» не число и не null`;
    pos = p > 0 ? p : null;
  }
  const out: FunnelRow = {
    date, art, role, search_position: pos,
    search_views: 0, pdp_views: 0, hits_to_cart: 0, ordered_units: 0,
  };
  for (const k of ["search_views", "pdp_views", "hits_to_cart", "ordered_units"] as const) {
    const v = num(r[k] ?? 0);
    if (!Number.isFinite(v) || v < 0) return `${k} = «${String(r[k])}» не неотрицательное число`;
    out[k] = v;
  }
  return out;
}

/** Id теста из артикула медианной строки. */
export const testIdOf = (art: string): string => art.slice(MEDIAN_PREFIX.length);

export function readFunnelTests(path: string): FunnelRead {
  const empty: FunnelRead = {
    rows: [], medians: new Map(), byArt: new Map(), bad: [], first: "", last: "", exists: false,
  };
  if (!existsSync(path)) return empty;
  const out: FunnelRead = { ...empty, exists: true, medians: new Map(), byArt: new Map(), rows: [], bad: [] };
  const lines = readFileSync(path, "utf-8").split(/\r?\n/);
  lines.forEach((l, i) => {
    if (!l.trim()) return;
    let raw: unknown;
    try { raw = JSON.parse(l); } catch { out.bad.push({ line: i + 1, why: "не разбирается как JSON" }); return; }
    const r = parseRow(raw);
    if (typeof r === "string") { out.bad.push({ line: i + 1, why: r }); return; }
    out.rows.push(r);
    if (r.role === "median") {
      const id = testIdOf(r.art);
      const m = out.medians.get(id) ?? new Map<string, FunnelRow>();
      m.set(r.date, r); out.medians.set(id, m);
    } else {
      const m = out.byArt.get(r.art) ?? new Map<string, FunnelRow>();
      m.set(r.date, r); out.byArt.set(r.art, m);
    }
    if (!out.first || r.date < out.first) out.first = r.date;
    if (r.date > out.last) out.last = r.date;
  });
  return out;
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
