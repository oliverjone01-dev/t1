// Родство товаров: объединённая карточка OZON и линия. Нужно затем, что реклама одного
// варианта тянет за собой соседей, и брат в контроле делает разницу тест минус контроль
// бессмысленной.
//
// ЧИСЛО, ИЗ КОТОРОГО ВСЁ РАСТЁТ. Июль, кампания была только у GGT-47-3-3-90, расход
// 126 766 ₽, сдвиг +17.4 пункта. Пять его братьев по линии без рекламы (двое с копеечным
// расходом 3 286 и 2 874 ₽) дали +8.2..+8.4, медиана +8.3. Перетекание примерно половина
// сдвига на одном наблюдении: направление известно, множитель нет.
//
// ДВА УРОВНЯ РОДСТВА, И ТОЛЬКО ОДИН НАСТОЯЩИЙ
//   карточка - точный признак, но карты пока нет: data/card_groups.json это заметка от
//              25.06 на две модели, а не карта. Правило по карточке до прихода выгрузки
//              из кабинета работает как заглушка;
//   линия    - догадка по префиксу артикула (GGT-47-3-3-90 -> GGT-47). Именно она сейчас
//              и отсекает родню: 224 артикула панели из 475.
// Когда выгрузка ляжет в data-cabinet/card_groups.ndjson, карточка станет главной, а линия
// останется запасной. Читатель уже умеет оба файла, менять его не придётся.
import { readFileSync, existsSync } from "node:fs";

/** Где искать карту объединённых карточек. Первый найденный файл выигрывает. */
export const CARD_MAP_PATHS = ["data-cabinet/card_groups.ndjson", "data/card_groups.json"];

export interface CardMap {
  /** артикул -> идентификатор карточки */
  card: Map<string, string>;
  /** сколько карточек прочитано и из какого файла */
  groups: number; source: string;
  /** true - карта настоящая, false - заглушка на префиксе (файла нет или в нём пара моделей) */
  real: boolean;
}

/** Ниже этого числа групп карта считается заметкой, а не картой. В кабинете у товаров
 *  написано «Объединён (63)», то есть настоящая карта на порядок больше. */
const REAL_MAP_MIN_GROUPS = 20;

/** Линия по артикулу: первые два сегмента. Догадка, а не таксономия: GGT-03 это одно
 *  семейство столов, но внутри него модели могут быть разными. Заменится картой карточек. */
export const lineKey = (art: string): string => art.split("-").slice(0, 2).join("-");

export function loadCardMap(paths: string[] = CARD_MAP_PATHS): CardMap {
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const card = new Map<string, string>();
    let groups = 0;
    const txt = readFileSync(p, "utf-8");
    if (p.endsWith(".ndjson")) {
      for (const l of txt.trim().split("\n").filter(Boolean)) {
        let r: any; try { r = JSON.parse(l); } catch { continue; }
        const id = String(r.card ?? r.main ?? r.model ?? "").trim();
        const arts: string[] = (r.skus || r.offers || []).map((x: any) => String(x.offer ?? x.art ?? x).trim());
        if (!id || arts.length < 2) continue;
        groups += 1;
        for (const a of arts) if (a) card.set(a, id);
      }
    } else {
      let d: any; try { d = JSON.parse(txt); } catch { continue; }
      for (const g of (d.groups || [])) {
        const id = String(g.main ?? g.model ?? "").trim();
        const arts: string[] = (g.skus || []).map((x: any) => String(x.offer ?? "").trim());
        if (!id || arts.length < 2) continue;
        groups += 1;
        for (const a of arts) if (a) card.set(a, id);
      }
    }
    if (!groups) continue;
    return { card, groups, source: p, real: groups >= REAL_MAP_MIN_GROUPS };
  }
  return { card: new Map(), groups: 0, source: "", real: false };
}

/** Ключ родства: карточка, если известна, иначе линия. По нему и схлопываются наблюдения,
 *  и отсеивается родня из контроля. */
export const kinKey = (art: string, m: CardMap): string => m.card.get(art) ?? lineKey(art);

export const isKin = (a: string, b: string, m: CardMap): boolean => a !== b && kinKey(a, m) === kinKey(b, m);

/** Артикулы, родственные хотя бы одному тестовому. Сами тестовые в набор не входят: их
 *  исключают отдельно и по другой причине. */
export function kinOfTests(all: Iterable<string>, testArts: Set<string>, m: CardMap): Set<string> {
  const keys = new Set([...testArts].map((a) => kinKey(a, m)));
  const out = new Set<string>();
  for (const a of all) if (!testArts.has(a) && keys.has(kinKey(a, m))) out.add(a);
  return out;
}

/** Схлопывание по карточке: варианты одной карточки это ОДНО наблюдение, а не несколько.
 *  Иначе медиана считает GGT-35-1-3-100-180 и GGT-35-3-3-100-180 дважды, хотя это одна
 *  карточка OZON, один товар для покупателя и одна реакция площадки.
 *  Схлопываем ТОЛЬКО по настоящей карточке: по линии это было бы слишком грубо, линия
 *  объединяет разные модели. */
export function collapseByCard<T>(
  items: T[],
  artOf: (x: T) => string,
  valueOf: (x: T) => number | null,
  m: CardMap,
): { values: number[]; collapsed: Array<{ card: string; arts: string[] }> } {
  const by = new Map<string, { arts: string[]; vals: number[] }>();
  for (const it of items) {
    const a = artOf(it);
    const key = m.card.get(a) ?? `art:${a}`;   // без карточки товар сам себе группа
    const g = by.get(key) ?? { arts: [], vals: [] };
    g.arts.push(a);
    const v = valueOf(it);
    if (v != null && Number.isFinite(v)) g.vals.push(v);
    by.set(key, g);
  }
  const mid = (v: number[]): number => {
    const s = [...v].sort((x, y) => x - y), i = s.length >> 1;
    return s.length % 2 ? s[i]! : (s[i - 1]! + s[i]!) / 2;
  };
  const values: number[] = [];
  const collapsed: Array<{ card: string; arts: string[] }> = [];
  for (const [key, g] of by) {
    if (g.vals.length) values.push(mid(g.vals));
    if (g.arts.length > 1) collapsed.push({ card: key, arts: g.arts });
  }
  return { values, collapsed };
}
