// Парсер таблицы себестоимости и нечёткий матчинг названий моделей.
// Лист "СС GEN - OZON": Модель, С\С общая, Комиссия%, Логистика%, Реклама%, Итого% OZON.
// С\С: неразрывный пробел как разделитель тысяч, запятая - десятичная.
// Имена моделей в листе и таксономии в разном порядке слов -> матчим по токенам.

import { parseCsv } from "./taxonomy.js";

export interface CogsRow {
  model: string;
  cost: number;
}

export function parseCogsNumber(raw: string): number {
  if (!raw) return 0;
  const s = raw.replace(/[\s ]/g, "").replace(",", ".");
  if (s === "" || s.includes("VALUE")) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseCogs(text: string): CogsRow[] {
  const rows = parseCsv(text);
  const out: CogsRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const model = (r[0] || "").trim();
    const cost = parseCogsNumber(r[1] || "");
    // пропускаем заголовки секций (нет цены) и мусор
    if (!model || cost <= 0) continue;
    out.push({ model, cost });
  }
  return out;
}

// Производственная СС с прямым ключом по SKU (лист «Copy of СС GEN - OZON»,
// экспорт fixtures/cogs_prod_sku.csv: sku, offer, model, cost_prod). Точнее нечёткого
// матча по имени модели - привязка прямо к артикулу OZON.
export interface CogsSkuRow { sku: string; offer: string; model: string; cost: number; }
export function parseCogsSku(text: string): CogsSkuRow[] {
  const rows = parseCsv(text);
  const out: CogsSkuRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const sku = (r[0] || "").trim();
    const cost = parseCogsNumber(r[3] || "");
    if (!/^\d+$/.test(sku) || cost <= 0) continue;
    out.push({ sku, offer: (r[1] || "").trim(), model: (r[2] || "").trim(), cost });
  }
  return out;
}

// Синонимы материалов (в листе и таксономии называют по-разному).
const SYN: Record<string, string> = {
  STONE: "KER", КЕРАМИЧЕСКИЙ: "KER", КЕРАМИЧЕСКИ: "KER", КЕРАМОГРАНИТ: "KER", КЕРАМ: "KER", КЕРАМИЧ: "KER",
  WOOD: "WOOD", ЛДСП: "WOOD",
};
// Шумовые слова, не несущие идентичности модели.
const STOP = new Set([
  "С", "СЕНСОРНЫМ", "СЕНСОРНОЙ", "ВЫКЛЮЧАТЕЛЕМ", "ВЫКЛЮЧАТЕЛЬ", "КНОПКОЙ", "КНОПКА",
  "СМ", "СПОДСВЕТКОЙ", "ПОДСВЕТКОЙ", "В", "И", "НА", "ДЛЯ", "НОВИНКА",
]);

// Токены имени: латиница/кириллица/цифры, верхний регистр, синонимы и стоп-слова.
export function tokens(s: string): string[] {
  return (s.toUpperCase().match(/[A-ZА-ЯЁ0-9]+/g) || [])
    .map((t) => SYN[t] || t)
    .filter((t) => t.length > 0 && !STOP.has(t));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

export interface CogsIndex {
  rows: Array<{ model: string; cost: number; toks: Set<string> }>;
}

export function buildCogsIndex(cogs: CogsRow[]): CogsIndex {
  return { rows: cogs.map((c) => ({ model: c.model, cost: c.cost, toks: new Set(tokens(c.model)) })) };
}

// Лучшее совпадение для модели таксономии. Возвращает null, если ниже порога.
export function matchCogs(taxModel: string, idx: CogsIndex, threshold = 0.6): { cost: number; model: string; score: number } | null {
  const t = new Set(tokens(taxModel));
  if (t.size === 0) return null;
  let best: { cost: number; model: string; score: number } | null = null;
  for (const r of idx.rows) {
    const sc = jaccard(t, r.toks);
    if (!best || sc > best.score) best = { cost: r.cost, model: r.model, score: sc };
  }
  return best && best.score >= threshold ? best : null;
}
