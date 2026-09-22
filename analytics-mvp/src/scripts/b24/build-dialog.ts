// Запекает dialog/data/dialog.json в самодостаточную страницу public/dialog.html (/dialog/).
// Запуск: npx tsx src/scripts/b24/build-dialog.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const TPL = "dialog/dialog.template.html";
const DATA = "dialog/data/dialog.json";
const OUT = "public/dialog.html";
// Ручной ИИ-разбор коммуникаций (в сессии, без API), пока полный API-прогон не сделан.
// Ключи (dealId, src=cmt#/act#) стабильны между ночными снимками, поэтому оверлей
// переналивается при КАЖДОЙ сборке и переживает пересбор dialog.json.
const AI_OVERLAY = "dialog/data/ai-tags-manual.json";

const tpl = readFileSync(TPL, "utf-8");
let data = '{"generatedAt":null,"from":"","to":"","days":7,"portal":"","dealsScanned":0,"managers":[],"counts":{},"events":[]}';
try { data = readFileSync(DATA, "utf-8").trim() || data; }
catch { console.warn(`нет ${DATA} - страница соберётся пустой`); }

// Подмешиваем ручные ИИ-теги коммуникаций в scoring.deals[].evTags (ai:true).
// Мягко: файла нет / битый JSON / нет сделки в снимке - пропускаем без падения.
let aiMerged = 0;
try {
  const overlay = JSON.parse(readFileSync(AI_OVERLAY, "utf-8"));
  const obj = JSON.parse(data);
  const deals = (obj.scoring && obj.scoring.deals) || [];
  const byId: Record<string, any> = {};
  for (const d of deals) if (d && d.dealId != null) byId[String(d.dealId)] = d;
  for (const dealId of Object.keys(overlay)) {
    const deal = byId[dealId];
    if (!deal) continue;
    deal.evTags = deal.evTags || {};
    const srcMap = overlay[dealId] || {};
    for (const src of Object.keys(srcMap)) {
      const tags = (srcMap[src] || []).map((t: any) => ({ ...t, ai: true }));
      const cur = Array.isArray(deal.evTags[src]) ? deal.evTags[src] : [];
      // не дублируем при повторной сборке: убираем прежние ИИ-теги с тем же текстом
      const keep = cur.filter((c: any) => !(c && c.ai && tags.some((n: any) => n.t === c.t)));
      deal.evTags[src] = [...keep, ...tags];
      aiMerged += tags.length;
    }
  }
  data = JSON.stringify(obj);
  console.log(`ИИ-оверлей: подмешано тегов ${aiMerged}`);
} catch (e: any) {
  console.warn(`ИИ-оверлей пропущен: ${e && e.message}`);
}

const stamp = new Date().toISOString();
const baked = tpl
  .replace("__DIALOG_DATA__", () => data)
  .replace("__BAKED_AT__", stamp);

mkdirSync("public", { recursive: true });
writeFileSync(OUT, baked);
let n = 0; try { n = (JSON.parse(data).events || []).length; } catch {}
console.log(`-> ${OUT} (${(baked.length / 1048576).toFixed(1)} MB, событий ${n})`);
