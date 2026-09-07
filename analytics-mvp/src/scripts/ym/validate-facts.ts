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

// Порог просадки месяца. ФЕНИКС 2026-09-07: Number('abc') = NaN, и тогда ВСЕ сравнения давали false -
// гейт печатал «потерь нет» при минус половине; а значение 1 отключало его целиком. Значение вне
// разумного диапазона - это ошибка настройки, и она обязана ронять прогон, а не молча снимать защиту.
function threshold(raw: string | undefined, name: string, def: number, max: number): number {
  if (raw === undefined || raw === "") return def;
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0 || v > max) {
    console.error(`FACTS INVALID: ${name}="${raw}" - не число в диапазоне (0, ${max}]. Гейт не запускается: неверная настройка не должна выглядеть как «потерь нет».`);
    process.exit(1);
  }
  return v;
}
const DROP = threshold(process.env.YM_FACTS_DROP_GATE, "YM_FACTS_DROP_GATE", 0.1, 0.5);  // просадка месяца
const GROW = threshold(process.env.YM_FACTS_GROW_GATE, "YM_FACTS_GROW_GATE", 0.25, 20);  // рост ЗАКРЫТОГО месяца

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

  // Ключ агрегации - пара (кабинет, месяц), если файл её несёт. Чистка в продьюсере идёт по паре,
  // и гейт по одному месяцу пропускал потерю целого кабинета: у 1023124/2026-06 доля в месяце 19.2%,
  // то есть минус половина кабинета - это минус 9.6% месяца, под порогом 10%.
  const byBiz = process.argv.includes("--by=business");
  const agg = (rs: any[]) => {
    const m: Record<string, { n: number; s: number }> = {};
    for (const r of rs) {
      const mon = String(r[mk] || "").slice(0, 7); if (!mon) continue;
      const key = byBiz && r.business ? `${r.business}/${mon}` : mon;
      const b = (m[key] ||= { n: 0, s: 0 });
      b.n++; if (sumK) b.s += Number(r[sumK]) || 0;
    }
    return m;
  };
  const a = agg(prev), b = agg(cur);
  // Самый свежий месяц базового снимка законно добирается прогон за прогоном (текущий месяц ещё
  // идёт), поэтому потолок роста к нему не применяем - иначе гейт кричал бы каждый день. К закрытым
  // месяцам применяем: там рост означает, что разбор сложился поверх уже накопленного.
  const monthOf = (k: string) => k.slice(-7);
  const newest = Object.keys(a).map(monthOf).sort().pop() || "";
  const bad: string[] = [];
  for (const [mth, p] of Object.entries(a)) {
    const c = b[mth] || { n: 0, s: 0 };
    if (c.n < p.n * (1 - DROP)) bad.push(`${mth}: строк было ${p.n}, стало ${c.n} (потеря)`);
    else if (sumK && Math.abs(p.s) > 1 && Math.abs(c.s) < Math.abs(p.s) * (1 - DROP)) bad.push(`${mth}: сумма ${sumK} была ${Math.round(p.s)}, стала ${Math.round(c.s)} (потеря)`);
    // Гейт был односторонним и пропускал ЗАДВОЕНИЕ - а именно оно и грозило реализации: разбор
    // складывает поверх накопленного, и второй проход по той же паре удваивает месяц.
    else if (monthOf(mth) >= newest) continue; // текущий месяц ещё набирается - потолок роста не про него
    else if (c.n >= p.n * (1 + GROW)) bad.push(`${mth}: строк было ${p.n}, стало ${c.n} (закрытый месяц вырос на ${Math.round((c.n / p.n - 1) * 100)}% - похоже на задвоение)`);
    else if (sumK && Math.abs(p.s) > 1 && Math.abs(c.s) >= Math.abs(p.s) * (1 + GROW)) bad.push(`${mth}: сумма ${sumK} была ${Math.round(p.s)}, стала ${Math.round(c.s)} (закрытый месяц вырос на ${Math.round((Math.abs(c.s) / Math.abs(p.s) - 1) * 100)}% - похоже на задвоение)`);
  }
  if (bad.length) {
    console.error(`FACTS INVALID: ${file} - аномалия по месяцам (порог потери ${Math.round(DROP * 100)}%, роста ${Math.round(GROW * 100)}%):\n  ${bad.join("\n  ")}`);
    console.error("Накопительный файл не имеет права ни терять собранный месяц, ни скачкообразно расти. Потеря - проверь ключ чистки в продьюсере (он обязан совпадать с ключом возобновляемости). Рост - проверь, не складывается ли разбор поверх уже накопленного.");
    process.exit(1);
  }
  console.log(`facts-gate ${file}: строк ${prev.length} -> ${cur.length}, месяцев ${Object.keys(a).length} -> ${Object.keys(b).length}, аномалий нет`);
}
main();
