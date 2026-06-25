// Импорт «Объединённых карточек» из Google-таблицы -> data/card_groups.json.
// Без OAuth (CSV-экспорт), работает локально и в Actions. Таблица должна быть открыта
// «всем, у кого есть ссылка → Читатель». Источник: --url / --id [--gid] / env
// CARD_GROUPS_SHEET_URL | CARD_GROUPS_SHEET_ID | CARD_GROUPS_SHEET_GID.
//
// Колонки (рус/англ, порядок любой): Модель, SKU, Артикул(offer), Название, Роль(основная/объединённая).
import { writeFileSync, mkdirSync } from "node:fs";
import { parseCsv, toCsvExportUrl } from "../competitors/sheet.js";
import { rowsToCardGroups } from "./card-groups.js";

const OUT = "data/card_groups.json";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function resolveUrl(): string {
  const gid = arg("--gid") || process.env.CARD_GROUPS_SHEET_GID || "0";
  const direct = arg("--url") || process.env.CARD_GROUPS_SHEET_URL;
  if (direct) return toCsvExportUrl(direct, gid);
  const id = arg("--id") || process.env.CARD_GROUPS_SHEET_ID;
  if (id) return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  throw new Error("источник не задан: --url <ссылка> | --id <sheetId> | env CARD_GROUPS_SHEET_URL/ID");
}

async function main() {
  const url = resolveUrl();
  console.log(`Тяну CSV: ${url}`);
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}. Открой доступ к таблице «всем, у кого есть ссылка» (Читатель).`);
  const csv = await res.text();
  if (/^\s*<(!doctype|html)/i.test(csv)) throw new Error("вместо CSV пришла HTML-страница (Google просит логин). Открой доступ по ссылке.");

  const { groups, warnings } = rowsToCardGroups(parseCsv(csv));
  for (const w of warnings) console.log("⚠ " + w);
  if (!groups.length) throw new Error("из таблицы не получено ни одной группы (нужны колонки «Модель» и «SKU»).");

  const out = {
    generated_note: `импорт объединённых карточек из Google-таблицы (${groups.length} моделей)`,
    source: "google-sheet",
    imported_at: new Date().toISOString().slice(0, 10),
    groups,
  };
  mkdirSync("data", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  const skuCount = groups.reduce((s, g) => s + g.skus.length, 0);
  console.log(`Готово: ${groups.length} моделей, ${skuCount} SKU -> ${OUT}`);
  console.log("Дальше: пересборка дашборда подхватит состыковку кампания -> карточка.");
}

main().catch((e) => { console.error("Импорт не удался:", e instanceof Error ? e.message : e); process.exit(1); });
