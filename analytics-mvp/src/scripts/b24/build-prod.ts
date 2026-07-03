// Запекает prod/data/prod.json в дашборд ПРОИЗВОДСТВО.
// Шаблон: prod/prod-command.template.html. Выход: public/prod-command.html.
// Запуск: npx tsx src/scripts/b24/build-prod.ts (после fetch-prod.ts).

import { readFileSync, writeFileSync } from "node:fs";

const TPL = "prod/prod-command.template.html";
const SRC = "prod/data/prod.json";
const OUT = "public/prod-command.html";
const PORTAL = (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, "");

const prod = JSON.parse(readFileSync(SRC, "utf-8"));
const tpl = readFileSync(TPL, "utf-8");

const DATA = {
  generatedAt: prod.generated_at || null,
  b24Portal: PORTAL,
  entityTypeId: prod.entityTypeId,
  refs: prod.refs || {},
  quotes: prod.quotes || null, // просчёты (потенциал производства); null у старых снимков
  items: prod.items || [],
};

const i = tpl.indexOf("const DATA=");
if (i < 0) { console.error("В шаблоне нет 'const DATA='"); process.exit(1); }
let j = tpl.indexOf("{", i), depth = 0, end = -1;
for (let k = j; k < tpl.length; k++) { const c = tpl[k]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { end = k; break; } } }
const out = tpl.slice(0, i) + "const DATA=" + JSON.stringify(DATA) + tpl.slice(end + 1);
writeFileSync(OUT, out);
console.log(`build-prod: элементов ${DATA.items.length} -> ${OUT} (${(out.length / 1048576).toFixed(2)} MB)`);
