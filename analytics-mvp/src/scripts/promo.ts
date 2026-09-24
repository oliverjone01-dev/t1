// Участие в акциях OZON по дням: data/promo_daily.ndjson.
//
// ЗАЧЕМ ОТДЕЛЬНО ОТ eb_pct. До 24.09 выход из акции ловился по колонке eb_pct: ноль читался
// как «вышел». Это было неверно. eb_pct и eb_act относятся к акции EB, в которой на 23.09
// состоят 471 товар из 500, а тест меряет выход из «Максимального бустинга: усиление», это
// другая акция. Товар с eb_pct = 0 при этом спокойно сидит в усилении, что и показал
// GGK-02-1-5-120: в кабинете он в акции, в наших данных был помечен вышедшим.
//
// ЧТО ЯВЛЯЕТСЯ ПРИЗНАКОМ УЧАСТИЯ. Колонка acts снимка: записи вида ТИП(S)@цена[с..по].
// Акции различаются окном дат, и окна сверены со списками кабинета 24.09:
//   STO 2026-09-08..2026-10-06 - «Максимальный бустинг», 21 товар, в кабинете 21;
//   STO 2026-09-13..2026-10-06 - «Максимальный бустинг: усиление», 56 товаров, в кабинете 56.
// В обеих акциях сидят 18 товаров, поэтому по одному лишь типу STO их не различить.
//
// ЦЕНЫ ИЗ acts НЕ БЕРУТСЯ. Репозиторий публичный, предельная цена по акции в него не едет.
// В файл уходят только тип и окно.
//
// ПУСТОЙ СПИСОК ЭТО НАБЛЮДЕНИЕ. Строка с promos: [] значит «товар в снимке есть, акций нет».
// Без неё выход из последней акции был бы неотличим от несостоявшегося съёма, и дата выхода
// поехала бы на первый же пропущенный день.
import { existsSync, readFileSync, readdirSync } from "node:fs";

export const PROMO_DAILY_FILE = "promo_daily.ndjson";

export interface PromoWin { t: string; from: string; to: string }
export interface PromoRow { date: string; art: string; promos: PromoWin[] }

/** Ключ акции: тип плюс окно. Окно обязательно, иначе две STO сливаются в одну. */
export const promoKey = (p: PromoWin): string => `${p.t}:${p.from}..${p.to}`;
export const winKey = (t: string, from: string, to: string): string => `${t}:${from}..${to}`;

export interface PromoRead {
  /** артикул -> день -> набор ключей акций. */
  byArt: Map<string, Map<string, Set<string>>>;
  /** Дни, за которые снимок есть. */
  days: string[];
  exists: boolean;
}

const EMPTY: PromoRead = { byArt: new Map(), days: [], exists: false };

export function parsePromoRow(raw: unknown): PromoRow | string {
  if (!raw || typeof raw !== "object") return "не объект";
  const r = raw as Record<string, unknown>;
  const date = String(r.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return `дата «${String(r.date ?? "")}» не вида ГГГГ-ММ-ДД`;
  const art = String(r.art ?? "").trim();
  if (!art) return "пустой артикул";
  const list = r.promos;
  if (!Array.isArray(list)) return "promos не список: пустой список это наблюдение, отсутствие поля - нет";
  const promos: PromoWin[] = [];
  for (const x of list) {
    if (!x || typeof x !== "object") return "элемент promos не объект";
    const p = x as Record<string, unknown>;
    const t = String(p.t ?? "").trim(), from = String(p.from ?? "").slice(0, 10), to = String(p.to ?? "").slice(0, 10);
    if (!t) return "акция без типа";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return `окно «${from}..${to}» не из двух дат`;
    promos.push({ t, from, to });
  }
  return { date, art, promos };
}

export function readPromoDaily(path: string): PromoRead {
  if (!existsSync(path)) return EMPTY;
  const byArt = new Map<string, Map<string, Set<string>>>();
  const days = new Set<string>();
  for (const l of readFileSync(path, "utf-8").split(/\r?\n/)) {
    if (!l.trim()) continue;
    let raw: unknown;
    try { raw = JSON.parse(l); } catch { continue; }
    const r = parsePromoRow(raw);
    if (typeof r === "string") continue;
    const m = byArt.get(r.art) ?? new Map<string, Set<string>>();
    m.set(r.date, new Set(r.promos.map(promoKey)));
    byArt.set(r.art, m);
    days.add(r.date);
  }
  return { byArt, days: [...days].sort(), exists: true };
}

/** Состоял ли товар в акции в этот день. null - день не снят по этому товару. */
export function inPromoOn(read: PromoRead, art: string, key: string, day: string): boolean | null {
  const s = read.byArt.get(art)?.get(day);
  return s ? s.has(key) : null;
}

export interface PromoExit {
  /** Последний наблюдаемый день, когда товар был в акции. */
  lastIn: string | null;
  /** Первый наблюдаемый день без акции после дня с акцией. Он и есть дата выхода. */
  exit: string | null;
  /** Сколько наблюдаемых дней по этому товару вообще есть. */
  seen: number;
}

/** Дата выхода из акции.
 *
 *  Подтверждения вторым днём здесь НЕТ намеренно, в отличие от прежнего гейта по eb_pct.
 *  Участие в акции это факт из списка, а не колеблющийся процент: запись либо есть, либо нет,
 *  и мигать ей нечем. Подтверждение стоило бы суток задержки и ничего бы не добавило.
 *
 *  Пропущенный день выходом не считается: в расчёт идут только дни, за которые по этому
 *  товару снимок есть. */
export function exitOf(read: PromoRead, art: string, key: string): PromoExit {
  const byDay = read.byArt.get(art);
  if (!byDay) return { lastIn: null, exit: null, seen: 0 };
  const days = [...byDay.keys()].sort();
  let lastIn: string | null = null, exit: string | null = null;
  for (const d of days) {
    const has = byDay.get(d)!.has(key);
    if (has) { lastIn = d; exit = null; continue; }
    if (lastIn && !exit) exit = d;
  }
  return { lastIn, exit, seen: days.length };
}

/** Кто состоит в акции на последний снятый день. */
export function membersOn(read: PromoRead, key: string, day: string): string[] {
  const out: string[] = [];
  for (const [art, byDay] of read.byArt) if (byDay.get(day)?.has(key)) out.push(art);
  return out.sort();
}

/** Разбор колонки acts снимка кабинета: ТИП(S)@цена[с..по];ТИП(S)@цена[с..по].
 *  Цена намеренно отбрасывается: в публичный репозиторий она не едет. */
export function parseActs(acts: string): PromoWin[] {
  const out: PromoWin[] = [];
  for (const m of (acts || "").matchAll(/([A-Z]+)\([^)]*\)@[^\[]*\[(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2}|\d{4})\]/g)) {
    out.push({ t: m[1]!, from: m[2]!, to: m[3]! });
  }
  return out;
}

/** Снимки кабинета: tools/reakciya/data-cabinet/snapshot_<дата>.psv, колонки art и acts.
 *  Папки нет - пустая карта, и это норма: в git она не едет. */
export function loadPromoFromSnapshots(dir = "tools/reakciya/data-cabinet"): PromoRow[] {
  const out: PromoRow[] = [];
  if (!existsSync(dir)) return out;
  const files = readdirSync(dir).filter((f) => /^snapshot_\d{4}-\d{2}-\d{2}\.psv$/.test(f)).sort();
  for (const f of files) {
    const date = f.slice("snapshot_".length, "snapshot_".length + 10);
    const lines = readFileSync(`${dir}/${f}`, "utf-8").split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) continue;
    const head = lines[0]!.split("|").map((h) => h.trim());
    const iArt = head.indexOf("art"), iActs = head.indexOf("acts");
    if (iArt < 0 || iActs < 0) continue;      // старый формат снимка: колонки acts нет
    for (const l of lines.slice(1)) {
      const c = l.split("|");
      const art = (c[iArt] ?? "").trim();
      if (!art) continue;
      out.push({ date, art, promos: parseActs(c[iActs] ?? "") });
    }
  }
  return out;
}
