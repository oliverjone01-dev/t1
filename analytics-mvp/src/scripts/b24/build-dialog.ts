// Запекает dialog/data/dialog.json в самодостаточную страницу public/dialog.html (/dialog/).
// Запуск: npx tsx src/scripts/b24/build-dialog.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const TPL = "dialog/dialog.template.html";
const DATA = "dialog/data/dialog.json";
const OUT = "public/dialog.html";

const tpl = readFileSync(TPL, "utf-8");
let data = '{"generatedAt":null,"from":"","to":"","days":7,"portal":"","dealsScanned":0,"managers":[],"counts":{},"events":[]}';
try { data = readFileSync(DATA, "utf-8").trim() || data; }
catch { console.warn(`нет ${DATA} - страница соберётся пустой`); }

const stamp = new Date().toISOString();
const baked = tpl
  .replace("__DIALOG_DATA__", () => data)
  .replace("__BAKED_AT__", stamp);

mkdirSync("public", { recursive: true });
writeFileSync(OUT, baked);
let n = 0; try { n = (JSON.parse(data).events || []).length; } catch {}
console.log(`-> ${OUT} (${(baked.length / 1048576).toFixed(1)} MB, событий ${n})`);
