// Разбор гугл-таблицы «Объединённые карточки» -> группы SKU одной модели OZON.
// Чистый модуль (без сети), переиспользует CSV-утилиты импортёра конкурентов.
//
// Зачем: OZON склеивает несколько SKU в одну карточку (модель). Эта карта позволяет
// в дашборде состыковать кампанию -> продвигаемый SKU -> вся объединённая карточка
// (состав + ролл-ап рекламы по модели). Точное ad-attributed дробление картой НЕ
// восстанавливается (нужен attribution-отчёт OZON) - только состав и суммы [ДАННЫЕ].
import { parseCsv } from "../competitors/sheet.js";

export interface CardSku { sku: string; offer: string; name: string; role: string; }
export interface CardGroup { model: string; main: string; skus: CardSku[]; }

const ALIASES: Record<string, string[]> = {
  model: ["модель", "model", "карточка", "объединённая карточка", "обьединенная карточка", "группа"],
  sku: ["sku", "ozon sku", "артикул sku", "id"],
  offer: ["offer", "offer_id", "артикул", "код"],
  name: ["name", "название", "наименование", "товар"],
  role: ["role", "роль", "тип"],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
const isMain = (role: string) => /основ|main|гл/i.test(role);

// Строки таблицы -> группы по модели + предупреждения. Каждая строка = один SKU модели.
export function rowsToCardGroups(rows: string[][]): { groups: CardGroup[]; warnings: string[] } {
  const warnings: string[] = [];
  const header = rows[0];
  if (!header || !header.length) return { groups: [], warnings: ["пустая таблица"] };

  const head = header.map(norm);
  const idx = {} as Record<string, number | undefined>;
  for (const [field, names] of Object.entries(ALIASES)) {
    const set = new Set(names.map(norm));
    const j = head.findIndex((h) => set.has(h));
    idx[field] = j >= 0 ? j : undefined;
  }
  if (idx.model == null || idx.sku == null) {
    warnings.push("нужны колонки «Модель» и «SKU»");
    return { groups: [], warnings };
  }
  const cell = (r: string[], f: string) => { const j = idx[f]; return j == null ? "" : (r[j] ?? "").trim(); };

  const byModel = new Map<string, CardGroup>();
  const seen = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => !(c ?? "").trim())) continue;
    const model = cell(row, "model");
    const sku = cell(row, "sku").replace(/\D/g, "");
    if (!model || !sku) { warnings.push(`строка ${r + 1}: пустая модель/SKU - пропущена`); continue; }
    const key = model + "|" + sku;
    if (seen.has(key)) { warnings.push(`строка ${r + 1}: SKU ${sku} в модели «${model}» повторяется - дубль пропущен`); continue; }
    seen.add(key);
    const g = byModel.get(model) || { model, main: "", skus: [] };
    const role = cell(row, "role");
    g.skus.push({ sku, offer: cell(row, "offer"), name: cell(row, "name"), role });
    if (isMain(role) && !g.main) g.main = sku;
    byModel.set(model, g);
  }
  const groups = [...byModel.values()].map((g) => ({ ...g, main: g.main || g.skus[0]?.sku || "" }));
  for (const g of groups) {
    if (g.skus.length < 2) warnings.push(`модель «${g.model}»: только 1 SKU - объединение не имеет смысла`);
  }
  if (!groups.length) warnings.push("ни одной валидной группы");
  return { groups, warnings };
}

// Удобные карты для джойна в дашборде: sku -> model, model -> группа.
export function indexGroups(groups: CardGroup[]): { skuToModel: Record<string, string>; byModel: Record<string, CardGroup> } {
  const skuToModel: Record<string, string> = {};
  const byModel: Record<string, CardGroup> = {};
  for (const g of groups) {
    byModel[g.model] = g;
    for (const s of g.skus) skuToModel[s.sku] = g.model;
  }
  return { skuToModel, byModel };
}
