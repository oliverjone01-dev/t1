import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";

export function readRows<T = any>(path: string): T[] {
  return existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l)) : [];
}

export function atomicText(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  try { writeFileSync(tmp, text); renameSync(tmp, path); }
  finally { if (existsSync(tmp)) unlinkSync(tmp); }
}

export function validateRows<T>(rows: T[], key: (r: T) => string): void {
  const keys = new Set<string>();
  const finite = (v: any): void => {
    if (typeof v === "number" && !Number.isFinite(v)) throw new Error("Неконечное число в результате");
    if (v && typeof v === "object") Object.values(v).forEach(finite);
  };
  for (const r of rows) {
    const k = key(r);
    if (!k || k.split("|").some(p => !p) || keys.has(k)) throw new Error(`Пустой/повторный ключ: ${k}`);
    keys.add(k); finite(r);
  }
}

export function writeRows<T>(path: string, rows: T[], key: (r: T) => string): void {
  validateRows(rows, key);
  atomicText(path, rows.map(r => JSON.stringify(r)).join("\n") + "\n");
}

export function shiftDay(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
export function closedDay(now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return shiftDay(today, -1);
}
export function dates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) out.push(d);
  return out;
}

// История с успешными пустыми днями неотличима от дыр без отдельного checkpoint.
export function pendingDays(existingDates: string[], completed: string[], floor: string, to: string): string[] {
  const done = new Set([...existingDates, ...completed]);
  const replay = shiftDay(to, -6);
  return dates(floor, to).filter(d => !done.has(d) || d >= replay);
}

export function replaceSlice<T>(old: T[], fresh: T[], inside: (r: T) => boolean): T[] {
  if (fresh.some(r => !inside(r))) throw new Error("Ответ вышел за окно записи");
  if (old.some(inside) && !fresh.length) throw new Error("Непустой сохранённый срез нельзя заменить пустым ответом");
  return old.filter(r => !inside(r)).concat(fresh);
}

export function requireCredentials(...values: string[]): void {
  if (values.some(v => !v)) throw new Error("Не заданы обязательные API credentials; данные не обновлены");
}

export function recordSuccess(collector: string, through: string): void {
  const path = "data/collector_status.json";
  const state = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  state[collector] = { through, loaded_at: new Date().toISOString() };
  atomicText(path, JSON.stringify(state) + "\n");
}

// У per-order агрегатов нет даты для безопасной склейки короткого диапазона.
export function requireFullHistory(from: string, to: string, paths: string[]): void {
  if (from !== "2026-02-06" || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new Error("Финансовый пересбор требует FROM=2026-02-06 и корректный TO");
  for (const path of paths.filter(p => p.endsWith(".ndjson"))) {
    if (readRows(path).some(r => r.d && (r.d < from || r.d > to))) throw new Error(`Диапазон обрезает сохранённую историю ${path}`);
  }
}

export async function collectDaily<T>(options: {
  path: string; floor: string; to?: string; date: (r: T) => string; key: (r: T) => string;
  load: (day: string) => Promise<T[]>;
}): Promise<void> {
  const { path, floor, date, key, load } = options;
  const to = options.to ?? closedDay(), old = readRows<T>(path);
  const ledger = `${path}.completed.json`;
  const completed: string[] = existsSync(ledger) ? JSON.parse(readFileSync(ledger, "utf8")) : [];
  const pending = pendingDays(old.map(date), completed, floor, to);
  let merged = old;
  for (const day of pending) {
    const rows = await load(day);
    if (!Array.isArray(rows) || rows.some(r => date(r) !== day)) throw new Error(`Ответ не соответствует дню ${day}`);
    merged = replaceSlice(merged, rows, r => date(r) === day);
  }
  merged.sort((a,b) => key(a).localeCompare(key(b)));
  writeRows(path, merged, key);
  // Только после успешной записи данных. Сбой перед ledger приведёт к безопасному повтору.
  atomicText(ledger, JSON.stringify([...new Set([...completed, ...pending])].sort()) + "\n");
  console.log(`${path}: успешно проверено ${pending.length} дней, по ${to}`);
}
