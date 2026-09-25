// Уровень акционного бустинга eb_pct: СПРАВОЧНАЯ колонка, не признак участия.
//
// ЧЕМ ЭТО БЫЛО И ПОЧЕМУ БОЛЬШЕ НЕТ. До 24.09 ноль в eb_pct считался выходом из акции, и на
// этом стоял гейт замера. Проверка по снимку 23.09 показала: eb_pct > 0 ровно у тех же 471
// товара из 500, у кого eb_act = true и в списке acts есть запись EB. То есть eb_pct
// описывает акцию EB, а тест меряет выход из «Максимального бустинга: усиление», это другая
// акция с другим окном. Товар с eb_pct = 0 при этом спокойно сидит в усилении.
//
// ЧТО ОСТАЛОСЬ. Уровень бустинга по дням: 55 % у 185 товаров, 15 % у 49, ноль у 29,
// остальные между. Величина полезна как описание (падение с 55 на 15 это тоже событие), но
// признаком участия в акции она не является и в гейт не входит. Участие живёт в promo.ts.
import { readdirSync, readFileSync, existsSync } from "node:fs";

export interface EbPoint { date: string; pct: number }

/** Вытяжка eb_pct, которая ЛЕЖИТ В РЕПОЗИТОРИИ: data/eb_daily.ndjson. Сам снимок кабинета
 *  сюда не кладётся, репозиторий публичный (см. ozon/eb-daily.ts). */
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
  for (const [, pts] of out) pts.sort((a, b) => a.date.localeCompare(b.date));
  return out;
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

/** Ряды из файла репозитория, поверх них свежие снимки, если папка на месте. */
export function loadEbSeries(path = "data/eb_daily.ndjson", dir = "tools/reakciya/data-cabinet"): Map<string, EbPoint[]> {
  const base = loadEbDaily(path);
  const raw = loadEbFromSnapshots(dir);
  if (!raw.size) return base;
  for (const [art, pts] of raw) {
    const days = new Set(pts.map((p) => p.date));
    const kept = (base.get(art) ?? []).filter((p) => !days.has(p.date));
    base.set(art, [...kept, ...pts].sort((a, b) => a.date.localeCompare(b.date)));
  }
  return base;
}

/** Уровень на день: последнее наблюдение не позже дня. null - наблюдений нет. */
export function ebOn(series: Map<string, EbPoint[]>, art: string, day: string): number | null {
  const pts = series.get(art);
  if (!pts?.length) return null;
  let out: number | null = null;
  for (const p of pts) if (p.date <= day) out = p.pct;
  return out;
}
