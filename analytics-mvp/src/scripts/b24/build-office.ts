// Запекает rop/data/rop.json в персональный дашборд ОФИС-МЕНЕДЖЕРА (квалификация лидов GG).
// Данные общие с РОПом (один снимок Bitrix), но дашборд отдельный и лёгкий: только лиды.
// Запуск: npx tsx src/scripts/b24/build-office.ts (после fetch-rop.ts).
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "rop/data/rop.json";
const TPL = "office/office-command.template.html";
const OUT = "public/office-command.html";

const rop = JSON.parse(readFileSync(SRC, "utf-8"));
const tpl = readFileSync(TPL, "utf-8");

// Только нужные поля лида - страница остаётся лёгкой
const leads = (rop.leads || []).map((l: any) => ({
  id: l.id, mgr: l.mgr || "—", status: l.status || "-", code: l.statusCode || "",
  conv: !!l.converted, junk: !!l.junk, created: l.created || null, closed: l.closed || null,
  source: l.source || "не указан", dir: l.dir || "не указано", t: (l.title || "").slice(0, 80),
}));

const DATA = {
  leads,
  generatedAt: rop.generated_at || null,
  bakedAt: new Date().toISOString(),
  b24Portal: (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, ""),
};

const i = tpl.indexOf("const DATA=");
if (i < 0) { console.error("В шаблоне нет 'const DATA='"); process.exit(1); }
let j = tpl.indexOf("{", i), depth = 0, end = -1;
for (let k = j; k < tpl.length; k++) { const c = tpl[k]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { end = k; break; } } }
const out = tpl.slice(0, i) + "const DATA=" + JSON.stringify(DATA) + tpl.slice(end + 1);
writeFileSync(OUT, out);
console.log(`build-office: лидов ${leads.length} -> ${OUT} (${(out.length / 1048576).toFixed(2)} MB)`);
