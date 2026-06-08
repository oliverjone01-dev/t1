// Парсер таксономии и джойн sku -> offer -> модель/категория.
// Таксономия чистая (Категория,Подкатегория,Линия,Модель,Артикул,Наименование),
// Артикул - список offer_id (через пробелы/переводы строк внутри ячейки).

export interface TaxRow {
  category: string;
  sub: string;
  line: string;
  model: string;
  offers: string[];
  name: string;
}

// Простой CSV-парсер с поддержкой кавычек и переводов строк внутри полей.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export function parseTaxonomy(text: string): TaxRow[] {
  const rows = parseCsv(text);
  const out: TaxRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.length < 5 || !r[3]) continue;
    const offers = (r[4] || "")
      .split(/[\s\n\r]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    out.push({ category: r[0] || "", sub: r[1] || "", line: (r[2] || "").trim(), model: (r[3] || "").trim(), offers, name: r[5] || "" });
  }
  return out;
}

// offer_id -> таксономия (реверс-индекс).
export function offerIndex(tax: TaxRow[]): Map<string, TaxRow> {
  const m = new Map<string, TaxRow>();
  for (const t of tax) for (const o of t.offers) m.set(o, t);
  return m;
}

// Нормализация имени модели для нечёткого джойна с таблицей себеса.
export function normModel(s: string): string {
  return s.toUpperCase().replace(/[^A-ZА-Я0-9]/g, "");
}
