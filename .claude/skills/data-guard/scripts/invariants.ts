// invariants.ts - проверки данных для билдеров чисел (fail-closed). Копия логики invariants.py.
// Импорт из билдера: import { assertUniqueKey, assertShare, ... } from "../../../.claude/skills/data-guard/scripts/invariants.ts";
// Вызывать ДО записи результата. Самопроверка: node --experimental-strip-types invariants.ts --selftest

export class InvariantError extends Error {}

type Row = Record<string, unknown>;
const keyOf = (r: Row, key: string[]) => JSON.stringify(key.map((k) => r[k] ?? null));

/** К4: ключ сущности уникален и не пустой. */
export function assertUniqueKey(rows: Row[], key: string[], name = "rows"): void {
  const seen = new Set<string>();
  let nulls = 0;
  const dups: string[] = [];
  for (const r of rows) {
    if (key.some((k) => r[k] === null || r[k] === undefined || r[k] === "")) { nulls++; continue; }
    const k = keyOf(r, key);
    if (seen.has(k)) dups.push(k);
    seen.add(k);
  }
  if (nulls || dups.length) throw new InvariantError(`${name}: ключ [${key}] пустой в ${nulls} строках, дублей ${dups.length} (${dups.slice(0, 3).join("; ")})`);
}

/** К4: дедуп только по полному объявленному ключу. */
export function dedupByKey<T extends Row>(rows: T[], key: string[]): { rows: T[]; removed: number } {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = keyOf(r, key);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return { rows: out, removed: rows.length - out.length };
}

/** К2: доля 0..1. null при отсутствии данных. */
export function assertShare(num: number | null, den: number | null, name = "share"): number | null {
  if (num === null || den === null) return null;
  if (den <= 0) {
    if (num === 0) return null;
    throw new InvariantError(`${name}: знаменатель ${den} при числителе ${num}`);
  }
  if (num < 0 || num > den) throw new InvariantError(`${name}: числитель ${num} вне [0, ${den}], популяции разные`);
  return num / den;
}

/** К4: сумма частей равна итогу. */
export function assertPartsSum(parts: number[], total: number, tol = 0.01, name = "parts"): void {
  const s = parts.reduce((a, b) => a + b, 0);
  if (Math.abs(s - total) > tol) throw new InvariantError(`${name}: сумма частей ${s.toFixed(2)} != итог ${total.toFixed(2)}`);
}

/** К7: каждый день периода присутствует; пропуск = null, не 0 и не отсутствие. */
export function assertNoSilentZero(series: Record<string, number | null>, dates: string[], name = "series"): void {
  const missing = dates.filter((d) => !(d in series));
  if (missing.length) throw new InvariantError(`${name}: нет дней ${missing.slice(0, 5)} (всего ${missing.length})`);
}

/** К7: у снимка есть loadedAt и он не старше порога. */
export function assertFresh(loadedAt: string | null | undefined, maxAgeHours: number, now: Date = new Date(), name = "snapshot"): void {
  if (!loadedAt) throw new InvariantError(`${name}: нет loaded_at, свежесть неизвестна`);
  const age = (now.getTime() - new Date(loadedAt).getTime()) / 3.6e6;
  if (age > maxAgeHours) throw new InvariantError(`${name}: снимок старше ${maxAgeHours} ч (возраст ${age.toFixed(1)} ч)`);
}

/** К7: заменяет только дни в [start, end), остальное не трогает. */
export function mergeWindow<V>(old: Record<string, V>, fresh: Record<string, V>, start: string, end: string): Record<string, V> {
  if (!start || !end) throw new InvariantError("mergeWindow: нужны обе границы окна");
  const inWin = (d: string) => d >= start && d < end;
  const out: Record<string, V> = {};
  for (const [d, v] of Object.entries(old)) if (!inWin(d)) out[d] = v;
  for (const [d, v] of Object.entries(fresh)) {
    if (!inWin(d)) throw new InvariantError(`mergeWindow: новые данные за ${d} вне окна [${start}, ${end})`);
    out[d] = v;
  }
  return out;
}

/** К7: незаконченный интервал помечается partial. */
export function markPartial<T extends { end: string | Date }>(buckets: T[], now: Date): (T & { partial: boolean })[] {
  return buckets.map((b) => ({ ...b, partial: new Date(b.end).getTime() > now.getTime() }));
}

/** К6, К8: коды из справочника. */
export function assertKnownCodes(values: string[], dictionary: Iterable<string>, name = "codes"): void {
  const known = new Set(dictionary);
  const unknown = [...new Set(values.filter((v) => !known.has(v)))].sort();
  if (unknown.length) throw new InvariantError(`${name}: незнакомые коды ${unknown.slice(0, 10)} (всего ${unknown.length})`);
}

/** К3: день в Europe/Moscow без toISOString (UTC-сдвиг). */
export function mskDay(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function selftest(): void {
  const fails = (fn: () => unknown) => { try { fn(); } catch (e) { if (e instanceof InvariantError) return; throw e; } throw new Error("не упало"); };
  assertUniqueKey([{ id: 1 }, { id: 2 }], ["id"]);
  fails(() => assertUniqueKey([{ id: 1 }, { id: 1 }], ["id"]));
  const d = dedupByKey([{ a: 1, n: 1 }, { a: 1, n: 2 }, { a: 1, n: 1 }], ["a", "n"]);
  if (d.removed !== 1) throw new Error("dedup");
  if (assertShare(1, 4) !== 0.25 || assertShare(null, 4) !== null) throw new Error("share");
  fails(() => assertShare(5, 4));
  assertPartsSum([1, 2], 3);
  fails(() => assertPartsSum([1, 2], 3.5));
  fails(() => assertNoSilentZero({ "2026-09-01": 1 }, ["2026-09-01", "2026-09-02"]));
  const now = new Date("2026-09-29T12:00:00Z");
  assertFresh("2026-09-29T10:00:00Z", 6, now);
  fails(() => assertFresh(null, 6, now));
  const m = mergeWindow({ "2026-02-01": 1, "2026-09-01": 2 }, { "2026-09-01": 3 }, "2026-09-01", "2026-10-01");
  if (m["2026-02-01"] !== 1 || m["2026-09-01"] !== 3) throw new Error("merge");
  fails(() => mergeWindow({}, { "2026-05-01": 1 }, "2026-09-01", "2026-10-01"));
  const p = markPartial([{ end: "2026-09-29T21:00:00Z" }], now);
  if (!p[0].partial) throw new Error("partial");
  fails(() => assertKnownCodes(["C"], ["A"]));
  if (mskDay(new Date("2026-09-28T21:30:00Z")) !== "2026-09-29") throw new Error("msk");
  console.log("invariants.ts selftest: ok");
}

if (typeof process !== "undefined" && process.argv.includes("--selftest")) selftest();
