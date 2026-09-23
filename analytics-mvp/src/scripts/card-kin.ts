// Родство товаров: варианты, склеенные OZON в одну карточку. Нужно затем, что реклама
// одного варианта тянет за собой соседей, и брат в контроле делает разницу тест минус
// контроль бессмысленной.
//
// ЧТО ЭТО ЗНАЧИТ В ДЕНЬГАХ. Attribution-отчёт OZON (data/ads_attr_daily.ndjson, 144 дня,
// 66 рекламируемых SKU) меряет перетекание сам: у 6 SKU продажи модели больше своих.
// Крайний случай - sku 3492791902: расход 57 363 ₽, своих продаж в продвижении нет вовсе,
// продажи карточки 34 362 ₽. Всё ушло соседям.
//
// РОДСТВО СЧИТАЕТСЯ ТОЛЬКО ПО НАСТОЯЩЕЙ КАРТЕ КАРТОЧЕК.
// Префикс артикула (GGT-47-3-3-90 -> GGT-47) отсюда убран 23.09.2026 по решению Ивана:
// линия объединяет разные модели, то есть это догадка, выглядящая как данные. Она
// одновременно записывала в родню лишнее и пропускала настоящую родню.
//
// Замены префиксу на уровне панели НЕТ, и это проверено, а не решено на глаз. Правило
// «родня = корреляция остатков >= 0.3 хоть с одним из 21 тестового» на панели не работает:
// оно помечает роднёй 490 артикулов из 493, а случайная двадцатка нетестовых помечает
// 99.6 % - столько же. На всех порогах от 0.3 до 0.95 случайная двадцатка ловит БОЛЬШЕ,
// чем настоящая. Корреляция остаётся там, где она и работает: одно сравнение, тест против
// своего кандидата в пару (pick-controls, правило 8; у названной пары 0.87 при фоне 0.011).
//
// Пока настоящей карты нет, kinKey возвращает пустой ключ, и родни не находится вовсе.
// Для счёта это не потеря: медиана группового контроля к чистке нечувствительна, разница
// по соинвесту на тесте 1 равна +9.0 пункта и при 232 контролях, и при 445, и при 493.
import { readFileSync, existsSync } from "node:fs";

/** Где искать карту объединённых карточек. Первый найденный файл выигрывает. */
export const CARD_MAP_PATHS = ["data-cabinet/card_groups.ndjson", "data/card_groups.json"];

export interface CardMap {
  /** артикул -> идентификатор карточки */
  card: Map<string, string>;
  /** сколько карточек прочитано и из какого файла */
  groups: number; source: string;
  /** true - карта настоящая, false - её нет или в файле пара моделей (заметка, а не карта) */
  real: boolean;
}

/** Ниже этого числа групп карта считается заметкой, а не картой. В кабинете у товаров
 *  написано «Объединён (63)», то есть настоящая карта на порядок больше. */
const REAL_MAP_MIN_GROUPS = 20;


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

/** Ключ родства: только настоящая карточка. Пустая строка означает «неизвестно», и
 *  неизвестность НЕ делает товары роднёй: догадка здесь дороже пропуска. */
export const kinKey = (art: string, m: CardMap): string => m.card.get(art) ?? "";

export const isKin = (a: string, b: string, m: CardMap): boolean => {
  if (a === b) return false;
  const ka = kinKey(a, m);
  return ka !== "" && ka === kinKey(b, m);
};

/** Артикулы, родственные хотя бы одному тестовому по КАРТОЧКЕ. Сами тестовые в набор не
 *  входят: их исключают отдельно и по другой причине. Без карты набор пуст, и это честнее,
 *  чем набор, собранный по префиксу. */
export function kinOfTests(all: Iterable<string>, testArts: Set<string>, m: CardMap): Set<string> {
  const keys = new Set([...testArts].map((a) => kinKey(a, m)).filter((k) => k !== ""));
  const out = new Set<string>();
  for (const a of all) {
    if (testArts.has(a)) continue;
    const k = kinKey(a, m);
    if (k !== "" && keys.has(k)) out.add(a);
  }
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
