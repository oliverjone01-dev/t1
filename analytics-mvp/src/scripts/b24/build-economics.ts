// Запекает economics/data/economics.json в дашборд ЭКОНОМИКА СДЕЛОК.
// Шаблон: economics/economics-command.template.html. Выход: public/economics-command.html.
// Запуск: npx tsx src/scripts/b24/build-economics.ts (после fetch-economics.ts).

import { readFileSync, writeFileSync } from "node:fs";

const TPL = "economics/economics-command.template.html";
const SRC = "economics/data/economics.json";
const OUT = "public/economics-command.html";
const PORTAL = (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, "");

const src = JSON.parse(readFileSync(SRC, "utf-8"));
const tpl = readFileSync(TPL, "utf-8");

const DATA = {
  generatedAt: src.generated_at || null,
  bakedAt: new Date().toISOString(), // штамп сборки: отличать свежую версию от кэша
  b24Portal: PORTAL,
  category: src.category,
  funnelName: src.funnelName || null,
  sp: src.sp || [],
  deals: src.deals || [],
};

const i = tpl.indexOf("const DATA=");
if (i < 0) { console.error("В шаблоне нет 'const DATA='"); process.exit(1); }
const j = tpl.indexOf("{", i); let depth = 0, end = -1;
for (let k = j; k < tpl.length; k++) { const c = tpl[k]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { end = k; break; } } }
const out = tpl.slice(0, i) + "const DATA=" + JSON.stringify(DATA) + tpl.slice(end + 1);
writeFileSync(OUT, out);
console.log(`build-economics: сделок ${DATA.deals.length} -> ${OUT} (${(out.length / 1048576).toFixed(2)} MB)`);
