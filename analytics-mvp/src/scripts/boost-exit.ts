// Дата выхода из максимального бустинга: наша ручная и снятая с площадки.
//
// ЗАЧЕМ ДВЕ. Ручное поле «этап2» в tests.json это НАМЕРЕНИЕ: день, когда мы нажали кнопку.
// eb_pct из снимка кабинета это ФАКТ ПЛОЩАДКИ: день, когда бустинг перестал показываться,
// а значит изменилась цена покупателя. Замер привязан к цене, поэтому считать надо от даты
// площадки, а ручную держать подписью действия. Расхождение больше суток не усредняется:
// усреднение спрятало бы ровно ту разницу, ради которой обе даты и собираются.
//
// ПОЧЕМУ НЕ ПОРОГ, А НОЛЬ. Ноль это чистое состояние, подбирать нечего. На 23.09 в нуле
// ровно 29 товаров из 500, остальные 471 с ненулевым (чаще всего 55.0, таких 185).
//
// ПОЧЕМУ ПОДТВЕРЖДЕНИЕ СЛЕДУЮЩИМ ДНЁМ. Один нулевой снимок это может быть сбой съёма, а
// решение снимать акцию стоит денег. Подтверждение стоит сутки задержки и снимает вопрос.
//
// ПРО ПРОПУЩЕННЫЙ ДЕНЬ. Серия чистых дней считается по НАБЛЮДАЕМЫМ дням: пропуск съёма её
// не обнуляет, иначе карточка мигала бы от потерянного снимка (22.09 такой уже был).
// Это намеренно мягче правила плато в boost-readiness, где перешагивать пропуск запрещено:
// там пропуск может спрятать движение, здесь он прячет только подтверждение того же нуля.
// Календарный размах серии возвращается рядом, чтобы большая дыра была видна.
import { readdirSync, readFileSync, existsSync } from "node:fs";

/** Сколько подряд чистых наблюдаемых дней даёт право считать по автодате. */
export const CLEAN_DAYS_FOR_GATE = 5;

export interface EbPoint { date: string; pct: number }

export type ExitSource = "manual" | "auto" | "none";

export interface ExitDecision {
  /** Дата, от которой считается замер. Пусто - замер ещё нельзя считать. */
  measure: string | null;
  /** Откуда взято разрешение считать: ручное поле или автомат. */
  source: ExitSource;
  /** Наше намерение, как записано руками. */
  manual: string | null;
  /** Факт площадки: первый подтверждённый нулевой день. */
  auto: string | null;
  /** Чистых наблюдаемых дней подряд на дату asOf. */
  streak: number;
  /** Календарный размах этой серии в днях: больше streak - значит внутри есть пропуски. */
  span: number;
  /** Расхождение ручной и авто в днях. null - сравнивать не с чем. */
  disagreeDays: number | null;
  why: string;
}

const day = (s: string): number => Date.parse(s + "T00:00:00Z") / 86400000;

/** Первый наблюдаемый день с нулём после серии ненулевых, подтверждённый следующим
 *  наблюдаемым днём. Ряд должен начинаться с ненулевого: если он весь нулевой, мы не видели
 *  перехода и выдумывать его нельзя. */
export function autoExitDate(points: EbPoint[]): string | null {
  const p = [...points].sort((a, b) => a.date.localeCompare(b.date));
  let seenNonZero = false;
  for (let i = 0; i < p.length; i++) {
    const cur = p[i]!;
    if (cur.pct !== 0) { seenNonZero = true; continue; }
    if (!seenNonZero) continue;                    // ряд начался с нуля: перехода не видели
    const next = p[i + 1];
    if (!next) return null;                        // подтверждения ещё нет
    if (next.pct === 0) return cur.date;
    seenNonZero = true;                            // ноль оказался одиночным, ищем дальше
  }
  return null;
}

/** Чистых наблюдаемых дней подряд на дату asOf, считая назад от последнего наблюдения
 *  не позже asOf. Пропуск съёма серию не рвёт. */
export function cleanStreak(points: EbPoint[], asOf: string): { streak: number; span: number } {
  const p = [...points].filter((x) => x.date <= asOf).sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  for (let i = p.length - 1; i >= 0; i--) {
    if (p[i]!.pct !== 0) break;
    streak += 1;
  }
  if (!streak) return { streak: 0, span: 0 };
  const from = p[p.length - streak]!.date, to = p[p.length - 1]!.date;
  return { streak, span: day(to) - day(from) + 1 };
}

/** Решение по гейту. Ручное поле главнее как РАЗРЕШЕНИЕ считать; когда есть и автодата,
 *  замер всё равно идёт от неё, потому что цена покупателя менялась тогда. */
export function decideExit(manual: string | undefined | null, points: EbPoint[], asOf: string): ExitDecision {
  const man = (manual || "").trim() || null;
  const auto = autoExitDate(points);
  const { streak, span } = cleanStreak(points, asOf);
  const disagreeDays = man && auto ? Math.abs(day(auto) - day(man)) : null;

  if (man) {
    return {
      measure: auto ?? man, source: "manual", manual: man, auto, streak, span, disagreeDays,
      why: auto
        ? (disagreeDays! > 1
            ? `ручная дата ${man}, площадка ${auto}, расхождение ${disagreeDays} дн; замер идёт от площадки, там менялась цена покупателя`
            : `ручная дата ${man}, площадка ${auto}, расходятся не больше суток`)
        : `ручная дата ${man}; площадка выхода ещё не подтвердила`,
    };
  }
  if (auto && streak >= CLEAN_DAYS_FOR_GATE) {
    return {
      measure: auto, source: "auto", manual: null, auto, streak, span, disagreeDays: null,
      why: `поле «этап2» пустое, но площадка держит ноль ${streak} наблюдаемых ${streak === 1 ? "день" : "дней"} подряд: считаем по автодате ${auto}`,
    };
  }
  return {
    measure: null, source: "none", manual: null, auto, streak, span, disagreeDays: null,
    why: auto
      ? `автодата ${auto} есть, но чистых дней подряд пока ${streak} из ${CLEAN_DAYS_FOR_GATE}`
      : `поле «этап2» пустое, а площадка подтверждённого нуля пока не дала`,
  };
}

/** Вытяжка eb_pct, которая ЛЕЖИТ В РЕПОЗИТОРИИ: data/eb_daily.ndjson. Сам снимок кабинета
 *  сюда не кладётся, репозиторий публичный (см. eb-daily.ts). */
export function loadEbDaily(path = "data/eb_daily.ndjson"): Map<string, EbPoint[]> {
  const out = new Map<string, EbPoint[]>();
  if (!existsSync(path)) return out;
  for (const l of readFileSync(path, "utf-8").trim().split("\n").filter(Boolean)) {
    let r: any; try { r = JSON.parse(l); } catch { continue; }
    const art = String(r.art ?? "").trim(), date = String(r.date ?? "").slice(0, 10);
    const pct = Number(r.eb_pct);
    if (!art || !date || !Number.isFinite(pct)) continue;
    const arr = out.get(art) ?? [];
    arr.push({ date, pct });
    out.set(art, arr);
  }
  return out;
}

/** Ряды для гейта: вытяжка из репозитория плюс сырые снимки, если они есть локально.
 *  Локальный снимок за тот же день перебивает вытяжку: на маке он свежее. */
export function loadEbSeries(dir = "tools/reakciya/data-cabinet", daily = "data/eb_daily.ndjson"): Map<string, EbPoint[]> {
  const base = loadEbDaily(daily);
  const raw = loadEbFromSnapshots(dir);
  if (!raw.size) return base;
  for (const [art, pts] of raw) {
    const days = new Set(pts.map((p) => p.date));
    const kept = (base.get(art) ?? []).filter((p) => !days.has(p.date));
    base.set(art, [...kept, ...pts].sort((a, b) => a.date.localeCompare(b.date)));
  }
  return base;
}

/** Сырые снимки кабинета: tools/reakciya/data-cabinet/snapshot_<дата>.psv, колонка eb_pct.
 *  Папки нет - пустая карта, и это норма: в git она не едет. */
export function loadEbFromSnapshots(dir = "tools/reakciya/data-cabinet"): Map<string, EbPoint[]> {
  const out = new Map<string, EbPoint[]>();
  if (!existsSync(dir)) return out;
  const files = readdirSync(dir).filter((f) => /^snapshot_\d{4}-\d{2}-\d{2}\.psv$/.test(f)).sort();
  for (const f of files) {
    const date = f.slice("snapshot_".length, "snapshot_".length + 10);
    const lines = readFileSync(`${dir}/${f}`, "utf-8").split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) continue;
    const head = lines[0]!.split("|").map((h) => h.trim());
    const iArt = head.indexOf("art"), iEb = head.indexOf("eb_pct");
    if (iArt < 0 || iEb < 0) continue;
    for (const l of lines.slice(1)) {
      const c = l.split("|");
      const art = (c[iArt] ?? "").trim();
      const raw = (c[iEb] ?? "").trim().replace(",", ".");
      if (!art || raw === "") continue;            // пустое это «не снято», а не ноль
      const pct = Number(raw);
      if (!Number.isFinite(pct)) continue;
      const arr = out.get(art) ?? [];
      arr.push({ date, pct });
      out.set(art, arr);
    }
  }
  return out;
}
