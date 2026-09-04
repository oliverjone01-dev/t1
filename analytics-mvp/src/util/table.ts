// Таблица из текстового отчёта (CSV Маркета: разделитель ';' или ',', кавычки, BOM, CRLF).
// Отчёты Яндекс Маркета приходят файлом; заголовки - русские и меняются от версии к версии,
// поэтому колонки ищем по регулярным выражениям (см. scripts/ym/report-columns.json), а сырые
// заголовки складываем в _probe для первичной настройки маппинга.

export interface Table { headers: string[]; rows: string[][]; delimiter: string }

export function detectDelimiter(firstLine: string): string {
  const cands = [";", ",", "\t"];
  let best = ",", bestN = -1;
  for (const c of cands) { const n = firstLine.split(c).length; if (n > bestN) { bestN = n; best = c; } }
  return best;
}

export function parseDelimited(text: string, delimiter?: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const d = delimiter || detectDelimiter(text.split(/\r?\n/)[0] || "");
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

// Таблица с заголовком. Заголовок - первая строка, где не меньше 2 непустых ячеек (отчёты
// Маркета иногда начинаются с блока «Отчёт сформирован ...» на одну ячейку).
export function toTable(text: string): Table {
  const delimiter = detectDelimiter(text.split(/\r?\n/).find((l) => l.trim()) || "");
  const rows = parseDelimited(text, delimiter);
  let h = 0;
  while (h < rows.length && rows[h]!.filter((x) => x.trim()).length < 2) h++;
  const headers = (rows[h] || []).map((x) => x.trim());
  return { headers, rows: rows.slice(h + 1), delimiter };
}

// Индекс колонки по списку регулярок (первое совпадение). -1, если не нашли.
export function findCol(headers: string[], patterns: string[]): number {
  for (const p of patterns) {
    const re = new RegExp(p, "i");
    const i = headers.findIndex((h) => re.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

// Число из ячейки отчёта: «1 234,56», «1234.56», «−12», «1,234,567.89». Пусто -> 0.
// Не разобралось -> null (ФЕНИКС G12: деньги не превращаются в нули молча; вызывающий считает bad cells).
export function cellNumStrict(s: string | undefined): number | null {
  if (s == null || s.trim() === "" || s.trim() === "-" || s.trim() === "—") return 0;
  let t = s.replace(/[\s\u00A0]/g, "").replace("−", "-").replace(/₽|руб\.?|%/gi, "");
  if (/,\d{3}(,|\.|$)/.test(t) && t.includes(".")) t = t.replace(/,/g, "");      // 1,234,567.89
  else if ((t.match(/,/g) || []).length === 1 && !t.includes(".")) t = t.replace(",", "."); // 1234,56
  else if ((t.match(/,/g) || []).length > 1) t = t.replace(/,/g, "");                 // 1,234,567
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export function cellNum(s: string | undefined): number { return cellNumStrict(s) ?? 0; }

// Маска значения для probe-файлов (в git не должны попадать сырые номера заказов/п/п): цифры -> 9, буквы -> x.
export function maskCell(s: string): string { return s.replace(/\d/g, "9").replace(/[A-Za-zА-Яа-яЁё]/g, "x").slice(0, 24); }

// Дата из ячейки: DD.MM.YYYY, DD-MM-YYYY, YYYY-MM-DD, ISO datetime -> YYYY-MM-DD ('' если не дата).
export function cellDate(s: string | undefined): string {
  if (!s) return "";
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{2})[.\-/](\d{2})[.\-/](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}
