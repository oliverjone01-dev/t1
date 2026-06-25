// Чистый разбор Google-таблицы (CSV-экспорт) -> список конкурентов для input.json.
// Без сети - тестируется на строках. Сетевую часть делает import-sheet.ts.
//
// Идея: Иван ведёт таблицу (по строке на пару «наш товар GG ↔ карточка конкурента»),
// открывает доступ «всем по ссылке», импортёр тянет CSV и пересобирает input.json.

export interface CompItem {
  sku: string;
  seller: string;
  competitor_name: string;
  gg_product: string;
  category: string;
  qualification: string;
}

// Заголовки колонок принимаем и по-русски, и по-английски (нормализуем регистр/ё/пробелы).
const ALIASES: Record<keyof CompItem, string[]> = {
  sku: ["sku", "артикул", "артикул конкурента", "ozon sku", "ozon", "id"],
  seller: ["seller", "продавец", "конкурент", "имя конкурента", "магазин"],
  competitor_name: ["competitor_name", "название конкурента", "стол конкурента", "товар конкурента", "наименование конкурента", "название", "наименование"],
  gg_product: ["gg_product", "товар gg", "наш товар", "наш товар gg", "gg", "товар"],
  category: ["category", "категория"],
  qualification: ["qualification", "квалификация", "приоритет", "кв", "кв."],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");

// Полноценный CSV-парсер: кавычки, экранированные кавычки (""), запятые и переносы внутри полей, BOM.
export function parseCsv(text: string): string[][] {
  let s = text;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // снять BOM
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else { inQ = false; }
      } else { field += c; }
      continue;
    }
    if (c === '"') { inQ = true; }
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* игнор - перенос ловим по \n */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else { field += c; }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Строки таблицы -> валидированные items + список предупреждений (что пропущено и почему).
export function rowsToItems(rows: string[][]): { items: CompItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const header = rows[0];
  if (!header || !header.length) return { items: [], warnings: ["пустая таблица"] };

  const head = header.map(norm);
  const idx = {} as Record<keyof CompItem, number | undefined>;
  (Object.keys(ALIASES) as (keyof CompItem)[]).forEach((field) => {
    const names = new Set(ALIASES[field].map(norm));
    const j = head.findIndex((h) => names.has(h));
    idx[field] = j >= 0 ? j : undefined;
  });

  if (idx.sku == null) {
    warnings.push("не найдена колонка артикула (ожидаются заголовки: «Артикул» / «SKU»)");
    return { items: [], warnings };
  }

  const cell = (r: string[], field: keyof CompItem): string => {
    const j = idx[field];
    return j == null ? "" : (r[j] ?? "").trim();
  };

  const items: CompItem[] = [];
  const seen = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => !(c ?? "").trim())) continue; // пустая строка
    const skuRaw = cell(row, "sku");
    const sku = skuRaw.replace(/\D/g, ""); // вытащить только цифры (можно вставить и ссылку на карточку)
    if (!sku) { warnings.push(`строка ${r + 1}: пустой/нечисловой артикул «${skuRaw}» - пропущена`); continue; }
    if (seen.has(sku)) { warnings.push(`строка ${r + 1}: артикул ${sku} уже есть - дубль пропущен`); continue; }
    seen.add(sku);
    items.push({
      sku,
      seller: cell(row, "seller"),
      competitor_name: cell(row, "competitor_name"),
      gg_product: cell(row, "gg_product"),
      category: cell(row, "category"),
      qualification: cell(row, "qualification"),
    });
  }
  if (!items.length) warnings.push("ни одной валидной строки (нужен хотя бы один числовой артикул)");
  return { items, warnings };
}

// Любую ссылку на Google-таблицу превращаем в URL CSV-экспорта.
// gid подставляем ТОЛЬКО если он есть в ссылке или передан явно: иначе экспортируем
// первую вкладку (export?format=csv без gid). Подстановка gid=0 по умолчанию ломала
// таблицы, где первая вкладка не нулевая (Google отвечает HTTP 400).
export function toCsvExportUrl(input: string, fallbackGid = ""): string {
  const u = input.trim();
  if (/export\?format=csv/i.test(u)) return u; // уже готовый CSV-URL
  const m = u.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const id = m ? m[1] : (/^[a-zA-Z0-9_-]{20,}$/.test(u) ? u : "");
  if (!id) return u; // не распознали - вернём как есть, пусть решает вызывающий
  const gid = (u.match(/[#&?]gid=(\d+)/) || [])[1] || fallbackGid;
  const base = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  return gid ? `${base}&gid=${gid}` : base;
}
