// Ночной синк плана маркетинга из Google-таблицы (CSV по ссылке) -> data/plan_monthly.json.
// URL берём из env PLAN_SHEET_CSV_URL, иначе строим gviz-URL по SHEET_ID. Работает БЕЗ Google-
// авторизации, если таблица доступна «по ссылке (просмотр)» или опубликована в веб как CSV.
// Безопасно: если ответ не CSV (закрытая таблица -> HTML логина) или строк OZON нет - файл НЕ
// трогаем. Запуск в ночном синке (без кредов Google). npm run plan:fetch.
import { writeFileSync, readFileSync } from "node:fs";
import { parsePlanCsv } from "./plan-from-sheet.js";

const SHEET_ID = "1Mt7UDX9sfVaVxb-c4u0Nno2dOWOZG7AIxlwTMYGAFCY";
const OUT = "data/plan_monthly.json";
const NOTE = "План по месяцам (источник OZON). Заполняется в Google-таблице, синхронизируется автоматически. Поля: adSpend, rentab, revenue, realized, netProfit, accrued.";

async function main() {
  const url = process.env.PLAN_SHEET_CSV_URL || `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
  let text = "";
  try {
    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) { console.warn(`plan-fetch: HTTP ${r.status} по ссылке таблицы - пропуск (проверь доступ «по ссылке»)`); return; }
    text = await r.text();
  } catch (e) { console.warn("plan-fetch: не удалось скачать CSV -", (e as Error).message, "- пропуск"); return; }
  if (/^\s*</.test(text) || /<html/i.test(text.slice(0, 200))) { console.warn("plan-fetch: пришёл не CSV (таблица закрыта?) - пропуск"); return; }

  const plan = parsePlanCsv(text);
  const months = Object.keys(plan).length;
  if (!months) { console.warn("plan-fetch: строк OZON в таблице нет - файл не трогаем"); return; }
  const obj: Record<string, any> = { _note: NOTE };
  for (const k of Object.keys(plan).sort()) obj[k] = plan[k];
  const next = JSON.stringify(obj, null, 2) + "\n";
  let cur = ""; try { cur = readFileSync(OUT, "utf-8"); } catch { /* нет файла */ }
  if (cur === next) { console.log("plan-fetch: план без изменений"); return; }
  writeFileSync(OUT, next);
  console.log(`plan-fetch: план обновлён из таблицы (${months} мес) -> ${OUT}`);
}

main().catch((e) => { console.error("plan-fetch FAILED:", (e as Error).message); process.exit(0); });
