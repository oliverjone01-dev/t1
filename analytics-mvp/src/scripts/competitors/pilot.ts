// ПИЛОТ: сбор ПУБЛИЧНЫХ данных по конкурентам GG с карточек OZON (composer-api widget_state).
// Решение Ивана: собираем только ФАКТ - цена / базовая цена / рейтинг / отзывы / наличие / остаток.
// Заказы и выручку конкурента OZON не отдаёт (ни Seller API, ни публично) - не оцениваем.
//
// Запуск там, где открыт интернет к ozon.ru (GitHub Actions / локально). В web-контейнере Claude
// домен ozon.ru закрыт сетевой политикой (403) - живой прогон оттуда невозможен.
// ВАЖНО: «только цена» НЕ обходит анти-бот - OZON режет сам скрейпинг по IP дата-центра.
// Если 0 карточек - нужен резидентный прокси (следующая итерация) или платный API.
//
// Использование: tsx src/scripts/competitors/pilot.ts [--out data/competitors]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { withRetry, HttpError } from "../../util/retry.js";
import { parseCard, looksBlocked, type CardData } from "./parse.js";

const OUT_DIR: string = (() => {
  const i = process.argv.indexOf("--out");
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && v.length ? v : "data/competitors";
})();
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const pad = (n: number) => String(n).padStart(2, "0");
const today = () => { const d = new Date(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

interface InputItem { sku: string; seller: string; competitor_name: string; gg_product: string; category: string; qualification: string; }
interface Row extends InputItem, CardData { blocked: boolean; error: string | null; }

async function fetchCard(sku: string): Promise<{ data: CardData; blocked: boolean; error: string | null }> {
  const url = `https://www.ozon.ru/api/composer-api.bx/page/json/v2?url=/product/${sku}/`;
  try {
    return await withRetry(async () => {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json", "Accept-Language": "ru" },
        signal: AbortSignal.timeout(25000),
      });
      const raw = await res.text();
      if (res.status === 403 || res.status === 429) throw new HttpError(res.status, `OZON ${res.status} (анти-бот/политика)`);
      if (!res.ok) throw new HttpError(res.status, `OZON HTTP ${res.status}`);
      if (looksBlocked(raw)) return { data: parseCard(sku, null), blocked: true, error: "анти-бот заглушка вместо JSON" };
      let page: any = null;
      try { page = JSON.parse(raw); } catch { return { data: parseCard(sku, null), blocked: true, error: "не JSON" }; }
      return { data: parseCard(sku, page), blocked: false, error: null };
    }, { retries: 3, baseMs: 1500 });
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : (e as Error).message;
    return { data: parseCard(sku, null), blocked: /403|429|бот/i.test(msg), error: msg };
  }
}

async function main() {
  const input = JSON.parse(readFileSync("src/scripts/competitors/input.json", "utf-8")).items as InputItem[];
  const date = today();
  const rows: Row[] = [];
  let okCount = 0, blocked = 0;

  for (const it of input) {
    const r = await fetchCard(it.sku);
    rows.push({ ...it, ...r.data, blocked: r.blocked, error: r.error });
    if (r.data.ok) okCount++;
    if (r.blocked) blocked++;
    console.log(`${it.sku} ${it.seller.padEnd(12)} ${r.data.ok ? "OK" : (r.blocked ? "BLOCKED" : "FAIL")} цена=${r.data.price ?? "-"} рейт=${r.data.rating ?? "-"} отз=${r.data.reviews ?? "-"} нал=${r.data.available ?? "-"}`);
    await new Promise((res) => setTimeout(res, 1500)); // не долбить OZON
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const snap = { date, source: "ozon composer-api (public card)", fields: "price,priceBase,rating,reviews,stock,available", ok: okCount, blocked, total: rows.length, rows };
  writeFileSync(`${OUT_DIR}/competitors_${date}.json`, JSON.stringify(snap, null, 2));
  writeFileSync(`${OUT_DIR}/report_${date}.md`, renderReport(snap));
  console.log(`\nИтог: ${okCount}/${rows.length} карточек собрано, заблокировано ${blocked}. -> ${OUT_DIR}/competitors_${date}.json`);
  if (okCount === 0) { console.log("::warning::ни одной карточки не собрано - анти-бот OZON по IP дата-центра (нужен резидентный прокси или платный API)"); }
}

function renderReport(s: any): string {
  const L: string[] = [];
  L.push(`# Конкуренты GG - публичные данные с OZON, ${s.date}`);
  L.push("");
  L.push(`Собрано карточек: **${s.ok}/${s.total}**, заблокировано: ${s.blocked}. Источник: публичная карточка OZON (composer-api).`);
  L.push("");
  L.push("Все поля - **[ДАННЫЕ]** (публичны на карточке). Заказы/выручку конкурента OZON не отдаёт - не собираем (решение Ивана).");
  L.push("");
  L.push("| SKU | Продавец | Товар | Цена ₽ | База ₽ | Рейтинг | Отзывы | Остаток | В наличии |");
  L.push("|---|---|---|---|---|---|---|---|---|");
  for (const r of s.rows) {
    const nm = (r.competitor_name || "").slice(0, 24);
    const av = r.available == null ? "-" : (r.available ? "да" : "нет");
    L.push(`| ${r.sku} | ${r.seller} | ${nm} | ${r.price ?? "-"} | ${r.priceBase ?? "-"} | ${r.rating ?? "-"} | ${r.reviews ?? "-"} | ${r.stock ?? "-"} | ${av} |`);
  }
  L.push("");
  L.push("> Снимок за день. Прогон по расписанию даёт историю цен/рейтинга/отзывов конкурентов во времени.");
  return L.join("\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
