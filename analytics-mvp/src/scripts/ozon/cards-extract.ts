// Карта объединённых карточек из выгрузки кабинета -> data/card_groups.json.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Сырая выгрузка card_groups_<дата>.psv лежит в data-cabinet и в git
// не едет: репозиторий публичный, а каталог стоит в .gitignore целиком. Дашборду из семи
// колонок нужны две, артикул и карточка. Их и кладём, вместе с sku (он и так виден в
// адресе товара на витрине). item_id и model_id не кладём, они внутренние.
//
// Рецепт съёма: POST /api/v1/products/list-by-filter, тело snake_case, плюс
// aggregate: {parts:["PART_ITEM","PART_MODEL_COUNT","PART_SELLER_MODEL"], human_texts:true}.
// Без aggregate ручка отдаёт только item_id, поэтому поле карточки и казалось несуществующим.
// Карточка это part_seller_model.seller_model_id.
//
// Запуск: npm run cards (сети не требует).
import { readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { dp } from "../../paths.js";

export const CABINET_DIR = "tools/reakciya/data-cabinet";

export interface CardRow { art: string; sku: string; card: string; declared: number }

/** Разбор выгрузки. Пустая карточка это «не склеен», такую строку не берём: одиночный
 *  товар не карточка, и записывать его группой значит выдумывать родню. */
export function parseCardsPsv(text: string): CardRow[] {
  const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0]!.split("|").map((h) => h.trim());
  const iArt = head.indexOf("art"), iSku = head.indexOf("sku"), iCard = head.indexOf("card_id");
  const iDecl = head.indexOf("card_variants_declared");
  if (iArt < 0 || iCard < 0) return [];
  const out: CardRow[] = [];
  for (const l of lines.slice(1)) {
    const c = l.split("|");
    const art = (c[iArt] ?? "").trim(), cardId = (c[iCard] ?? "").trim();
    if (!art || !cardId) continue;
    const d = Number((c[iDecl] ?? "").trim());
    out.push({ art, sku: iSku >= 0 ? (c[iSku] ?? "").trim() : "", card: cardId, declared: Number.isFinite(d) ? d : 0 });
  }
  return out;
}

export interface CardGroupOut { model: string; main: string; skus: Array<{ sku: string; offer: string }>; declared: number }

/** Строки -> группы. Одиночки отбрасываем: карточка из одного товара родни не создаёт. */
export function toGroups(rows: CardRow[]): { groups: CardGroupOut[]; singles: number; short: CardGroupOut[] } {
  const by = new Map<string, CardRow[]>();
  for (const r of rows) { const a = by.get(r.card) ?? []; a.push(r); by.set(r.card, a); }
  const groups: CardGroupOut[] = [];
  let singles = 0;
  for (const [cardId, rs] of [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (rs.length < 2) { singles += 1; continue; }
    groups.push({
      model: `карточка ${cardId}`,
      main: cardId,
      skus: rs.map((r) => ({ sku: r.sku, offer: r.art })).sort((a, b) => a.offer.localeCompare(b.offer)),
      declared: Math.max(...rs.map((r) => r.declared)),
    });
  }
  // Карточка, в которой OZON объявляет больше вариантов, чем мы собрали: остальные вне
  // нашего каталога. Родню внутри каталога это не ломает, но знать про неполноту надо.
  const short = groups.filter((g) => g.declared > g.skus.length);
  return { groups, singles, short };
}

/** Самая свежая выгрузка карточек в data-cabinet. */
export function latestCardsFile(dir = CABINET_DIR): string | null {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).filter((x) => /^card_groups_\d{4}-\d{2}-\d{2}\.psv$/.test(x)).sort().pop();
  return f ? `${dir}/${f}` : null;
}

function main(): void {
  const file = latestCardsFile();
  if (!file) {
    console.log(`cards: выгрузки нет (${CABINET_DIR}/card_groups_<дата>.psv) - файл не трогаю`);
    return;
  }
  const rows = parseCardsPsv(readFileSync(file, "utf-8"));
  const { groups, singles, short } = toGroups(rows);
  if (!groups.length) { console.error(`cards: из ${file} не собралось ни одной карточки`); return; }
  const imported = file.slice(-14, -4);
  writeFileSync(dp("card_groups.json"), JSON.stringify({
    generated_note: `карта объединённых карточек из кабинета (${groups.length} карточек, ${rows.length} товаров)`,
    source: "cabinet-list-by-filter",
    imported_at: imported,
    groups,
  }, null, 1) + "\n");
  console.log(`card_groups.json: карточек ${groups.length}, товаров ${rows.length}, одиночек ${singles}`);
  if (short.length) {
    console.log(`  карточек, где OZON объявляет больше вариантов, чем есть в каталоге: ${short.length}`);
    for (const g of short.slice(0, 5)) console.log(`    ${g.main}: собрано ${g.skus.length}, объявлено ${g.declared}`);
  }
}

if (process.argv[1]?.endsWith("cards-extract.ts")) main();
