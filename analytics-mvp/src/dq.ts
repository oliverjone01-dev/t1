// Data Quality проверки после синка (S3, ТЗ §5.7).
// Свежесть (есть ли вчера), пропуски дат, провал объёма.

import type { Store } from "./store.js";
import { datesBetween } from "./sync.js";

export interface DqResult {
  ok: boolean;
  freshness: { ok: boolean; latest: string | null; expected: string };
  gaps: string[];
  volumeDrop: { ok: boolean; date: string | null; revenue: number; median: number } | null;
}

// Полный прогон DQ за диапазон [from, expectedLatest].
export function runDq(store: Store, from: string, expectedLatest: string): DqResult {
  const dates = store.distinctDates();
  const latest = dates.length ? dates[dates.length - 1]! : null;

  // свежесть: самая поздняя дата дотягивает до ожидаемой (вчера)
  const freshness = { ok: latest != null && latest >= expectedLatest, latest, expected: expectedLatest };

  // пропуски: даты диапазона, которых нет в БД
  const have = new Set(dates);
  const gaps = datesBetween(from, expectedLatest).filter((d) => !have.has(d));

  // провал объёма: оборот последнего дня против медианы предыдущих 7
  const rev = store.dailyRevenue().filter((r) => r.revenue > 0);
  let volumeDrop: DqResult["volumeDrop"] = null;
  if (rev.length >= 4) {
    const last = rev[rev.length - 1]!;
    const prior = rev.slice(Math.max(0, rev.length - 8), rev.length - 1).map((r) => r.revenue);
    const median = medianOf(prior);
    // аномалия, если упал более чем на 60% от медианы (порог из DOC_04 духа)
    volumeDrop = { ok: last.revenue >= median * 0.4, date: last.date, revenue: last.revenue, median };
  }

  // Фатальны только реальные поломки синка: нет свежего дня (freshness) или дыры в датах (gaps).
  // volumeDrop на ПОСЛЕДНЕМ дне НЕ фатален: свежий день у OZON почти всегда неполный (продажи
  // досчитываются ещё сутки-двое), поэтому низкий объём последнего дня - ожидаемо, а не поломка.
  // Он остаётся в результате как предупреждение (день помечается «частичный»), но не валит синк -
  // иначе свежий день никогда не коммитится и дашборд застревает на пред-предыдущем дне.
  const ok = freshness.ok && gaps.length === 0;
  return { ok, freshness, gaps, volumeDrop };
}

function medianOf(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
