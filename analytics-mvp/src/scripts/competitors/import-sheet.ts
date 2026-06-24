// Импорт конкурентов из Google-таблицы -> src/scripts/competitors/input.json.
// Таблица должна быть открыта «всем, у кого есть ссылка» (Доступ -> Читатель) или опубликована.
// Auth не нужен - тянем CSV-экспорт вкладки, поэтому работает и локально, и в GitHub Actions.
//
// Источник (любой из):
//   --url  <ссылка на таблицу или готовый CSV-export URL>
//   --id   <ID таблицы>  [--gid <номер вкладки, по умолчанию 0>]
//   env COMPETITORS_SHEET_URL / COMPETITORS_SHEET_ID / COMPETITORS_SHEET_GID
//
// Ожидаемые колонки (заголовки в первой строке, рус/англ): Артикул, Продавец,
// Название конкурента, Товар GG, Категория, Квалификация. Лишние колонки игнорируются.
import { writeFileSync, mkdirSync } from "node:fs";
import { parseCsv, rowsToItems, toCsvExportUrl } from "./sheet.js";

const OUT = "src/scripts/competitors/input.json";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function resolveUrl(): string {
  const gid = arg("--gid") || process.env.COMPETITORS_SHEET_GID || "0";
  const direct = arg("--url") || process.env.COMPETITORS_SHEET_URL;
  if (direct) return toCsvExportUrl(direct, gid);
  const id = arg("--id") || process.env.COMPETITORS_SHEET_ID;
  if (id) return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  throw new Error("источник не задан: --url <ссылка> | --id <sheetId> | env COMPETITORS_SHEET_URL/ID");
}

async function main() {
  const url = resolveUrl();
  console.log(`Тяну CSV: ${url}`);
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}. Открой доступ к таблице «всем, у кого есть ссылка» (Читатель) или опубликуй вкладку.`);
  }
  const csv = await res.text();
  if (/^\s*<(!doctype|html)/i.test(csv)) {
    throw new Error("вместо CSV пришла HTML-страница (Google просит логин). Открой доступ к таблице по ссылке.");
  }
  const { items, warnings } = rowsToItems(parseCsv(csv));
  for (const w of warnings) console.log("⚠ " + w);
  if (!items.length) throw new Error("из таблицы не получено ни одной валидной строки.");

  const out = {
    generated_note: `импорт из Google-таблицы (${items.length} строк)`,
    source: "google-sheet",
    imported_at: new Date().toISOString().slice(0, 10),
    items,
  };
  mkdirSync("src/scripts/competitors", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  const cats = new Set(items.map((i) => i.category).filter(Boolean));
  const sellers = new Set(items.map((i) => i.seller).filter(Boolean));
  console.log(`Готово: ${items.length} строк -> ${OUT}`);
  console.log(`Категорий: ${cats.size}${cats.size ? " (" + [...cats].join(", ") + ")" : ""} · конкурентов: ${sellers.size}`);
  console.log("Дальше: npm run katya (демо-лист) и/или прогон пилота (живые данные).");
}

main().catch((e) => { console.error("Импорт не удался:", e instanceof Error ? e.message : e); process.exit(1); });
