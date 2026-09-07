// Гейт накопительного факт-слоя Маркета (пробел, который пропустил потерю 4 898 строк реестра).
//
// Существующий дельта-гейт сторожит ТОЛЬКО три 30-дневные производные (skus_live_30d, pnl_30d,
// pnl_sku_30d). Накопительные файлы - заказы, реестр взаиморасчётов, реализация, показы - копятся
// за девять месяцев и не сторожатся ничем. Живой факт 2026-09-07: чистка реестра по неверному ключу
// снесла 4 898 строк и 9 354 730 ₽ за 2026-03..2026-06, все 30-дневные производные при этом не
// шелохнулись, и прогон завершился зелёным.
//
// Здесь сторожим то, что копится: число строк и сумму по месяцам. Накопительный файл имеет право
// расти и уточняться, но не имеет права терять уже собранный месяц.
// Запуск: tsx validate-facts.ts <файл.ndjson> <прошлый.ndjson|""> [--month-key=d|date|ym] [--sum=amount]
import { readFileSync, existsSync } from "node:fs";

const DROP = Number(process.env.YM_FACTS_DROP_GATE || 0.1); // просадка месяца >10% = блок

function rows(p: string): any[] {
  if (!p || !existsSync(p)) return [];
  return readFileSync(p, "utf-8").split("\n").filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function main() {
  const [file, prevFile] = [process.argv[2]!, process.argv[3] || ""];
  const arg = (n: string, d: string) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split("=")[1]!;
  const mk = arg("month-key", "d"), sumK = arg("sum", "");
  const cur = rows(file);
  if (!cur.length) { console.error(`FACTS INVALID: ${file} пуст или нечитаем`); process.exit(1); }
  const prev = rows(prevFile);
  if (!prev.length) { console.log(`facts-gate ${file}: строк ${cur.length}, прошлого снимка нет - сравнивать не с чем`); return; }

  const agg = (rs: any[]) => {
    const m: Record<string, { n: number; s: number }> = {};
    for (const r of rs) {
      const key = String(r[mk] || "").slice(0, 7); if (!key) continue;
      const b = (m[key] ||= { n: 0, s: 0 });
      b.n++; if (sumK) b.s += Number(r[sumK]) || 0;
    }
    return m;
  };
  const a = agg(prev), b = agg(cur);
  const bad: string[] = [];
  for (const [mth, p] of Object.entries(a)) {
    const c = b[mth] || { n: 0, s: 0 };
    if (c.n < p.n * (1 - DROP)) bad.push(`${mth}: строк было ${p.n}, стало ${c.n}`);
    else if (sumK && Math.abs(p.s) > 1 && Math.abs(c.s) < Math.abs(p.s) * (1 - DROP)) bad.push(`${mth}: сумма ${sumK} была ${Math.round(p.s)}, стала ${Math.round(c.s)}`);
  }
  if (bad.length) {
    console.error(`FACTS INVALID: ${file} потерял уже собранные месяцы (порог ${Math.round(DROP * 100)}%):\n  ${bad.join("\n  ")}`);
    console.error("Накопительный файл не имеет права терять собранный месяц. Проверь ключ чистки в продьюсере: он обязан совпадать с ключом возобновляемости.");
    process.exit(1);
  }
  console.log(`facts-gate ${file}: строк ${prev.length} -> ${cur.length}, месяцев ${Object.keys(a).length} -> ${Object.keys(b).length}, потерь нет`);
}
main();
