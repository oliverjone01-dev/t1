// ПИЛОТ: сбор данных по конкурентам GG с публичных карточек OZON (composer-api widget_state).
// НЕ Seller API: OZON не отдаёт продажи чужих SKU ни здесь, ни в кабинетном API. Поэтому:
//   [ДАННЫЕ]   - цена, базовая цена, рейтинг, число отзывов, наличие, остаток (если показан).
//   [ГИПОТЕЗА] - заказы и выручка за сутки: ОЦЕНКА по дельте отзывов (или остатка), точность ±%.
//
// Запуск там, где открыт интернет к ozon.ru (GitHub Actions / локально). В web-контейнере Claude
// домен ozon.ru закрыт сетевой политикой (403) - живой прогон оттуда невозможен.
//
// Использование: tsx src/scripts/competitors/pilot.ts [--out data/competitors]
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { withRetry, HttpError } from "../../util/retry.js";
import { parseCard, looksBlocked, type CardData } from "./parse.js";

const OUT_DIR: string = (() => {
  const i = process.argv.indexOf("--out");
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && v.length ? v : "data/competitors";
})();
const BUYBACK_RATE = 0.07; // допущение: ~7% покупателей оставляют отзыв (для оценки заказов по Δотзывов)
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const pad = (n: number) => String(n).padStart(2, "0");
const today = () => { const d = new Date(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

interface InputItem { sku: string; seller: string; competitor_name: string; gg_product: string; category: string; qualification: string; }
interface Row extends InputItem, CardData {
  blocked: boolean;
  error: string | null;
  // [ГИПОТЕЗА] оценки за сутки (заполняются при наличии прошлого снимка)
  orders_est_day: number | null;
  revenue_est_day: number | null;
  est_method: string | null;
  est_confidence: string | null;
}

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

// Последний предыдущий снимок (для дельты «за сутки»), если есть.
function loadPrev(): Record<string, Row> {
  try {
    const files = readdirSync(OUT_DIR).filter((f) => /^competitors_\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
    const last = files[files.length - 1];
    if (!last) return {};
    const j = JSON.parse(readFileSync(`${OUT_DIR}/${last}`, "utf-8"));
    const map: Record<string, Row> = {};
    for (const r of j.rows || []) map[r.sku] = r;
    return map;
  } catch { return {}; }
}

// [ГИПОТЕЗА] оценка заказов за сутки: приоритет - дельта отзывов; запас - дельта остатка.
function estimate(cur: CardData, prev: Row | undefined): Pick<Row, "orders_est_day" | "revenue_est_day" | "est_method" | "est_confidence"> {
  if (!prev) return { orders_est_day: null, revenue_est_day: null, est_method: "нет прошлого снимка (baseline)", est_confidence: "—" };
  // 1) по приросту отзывов
  if (cur.reviews != null && prev.reviews != null) {
    const dRev = Math.max(0, cur.reviews - prev.reviews);
    const orders = Math.round(dRev / BUYBACK_RATE);
    const rev = cur.price != null ? orders * cur.price : null;
    return { orders_est_day: orders, revenue_est_day: rev, est_method: `Δотзывов=${dRev} / выкуп ${BUYBACK_RATE}`, est_confidence: "низкая (±50%), [ГИПОТЕЗА]" };
  }
  // 2) по падению остатка (если OZON показал остаток в обоих снимках)
  if (cur.stock != null && prev.stock != null) {
    const sold = Math.max(0, prev.stock - cur.stock);
    const rev = cur.price != null ? sold * cur.price : null;
    return { orders_est_day: sold, revenue_est_day: rev, est_method: `Δостатка=${prev.stock}->${cur.stock}`, est_confidence: "средняя (±30%, без учёта дозавоза), [ГИПОТЕЗА]" };
  }
  return { orders_est_day: null, revenue_est_day: null, est_method: "нет сигнала (ни отзывов, ни остатка)", est_confidence: "—" };
}

async function main() {
  const input = JSON.parse(readFileSync("src/scripts/competitors/input.json", "utf-8")).items as InputItem[];
  const prev = loadPrev();
  const date = today();
  const rows: Row[] = [];
  let okCount = 0, blocked = 0;

  for (const it of input) {
    const r = await fetchCard(it.sku);
    const est = estimate(r.data, prev[it.sku]);
    rows.push({ ...it, ...r.data, blocked: r.blocked, error: r.error, ...est });
    if (r.data.ok) okCount++;
    if (r.blocked) blocked++;
    console.log(`${it.sku} ${it.seller.padEnd(12)} ${r.data.ok ? "OK" : (r.blocked ? "BLOCKED" : "FAIL")} цена=${r.data.price ?? "-"} отз=${r.data.reviews ?? "-"} зак~${est.orders_est_day ?? "-"}`);
    await new Promise((res) => setTimeout(res, 1500)); // не долбить OZON
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const snap = { date, source: "ozon composer-api (public card)", buyback_rate: BUYBACK_RATE, ok: okCount, blocked, total: rows.length, rows };
  writeFileSync(`${OUT_DIR}/competitors_${date}.json`, JSON.stringify(snap, null, 2));
  writeFileSync(`${OUT_DIR}/report_${date}.md`, renderReport(snap));
  console.log(`\nИтог: ${okCount}/${rows.length} карточек собрано, заблокировано ${blocked}. -> ${OUT_DIR}/competitors_${date}.json`);
  if (okCount === 0) { console.log("::warning::ни одной карточки не собрано - вероятно анти-бот OZON по IP дата-центра (нужен резидентный прокси или платный API)"); }
}

function renderReport(s: any): string {
  const L: string[] = [];
  L.push(`# Конкуренты GG - пилот сбора с OZON, ${s.date}`);
  L.push("");
  L.push(`Собрано карточек: **${s.ok}/${s.total}**, заблокировано: ${s.blocked}. Источник: публичная карточка OZON (composer-api).`);
  L.push("");
  L.push("**[ДАННЫЕ]** - цена/базовая/рейтинг/отзывы/наличие (публичны). **[ГИПОТЕЗА]** - заказы/выручка за сутки (оценка по Δотзывов или Δостатка, OZON их не отдаёт).");
  L.push("");
  L.push("| SKU | Продавец | Товар | Цена ₽ | База ₽ | Рейт | Отз | Остаток | Зак/сут~ | Выручка/сут~ | Метод оценки |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of s.rows) {
    const nm = (r.competitor_name || "").slice(0, 22);
    L.push(`| ${r.sku} | ${r.seller} | ${nm} | ${r.price ?? "-"} | ${r.priceBase ?? "-"} | ${r.rating ?? "-"} | ${r.reviews ?? "-"} | ${r.stock ?? "-"} | ${r.orders_est_day ?? "-"} | ${r.revenue_est_day ?? "-"} | ${r.est_method ?? "-"} |`);
  }
  L.push("");
  L.push("> Заказы/выручка за сутки требуют ДВУХ снимков с разницей ~24ч (первый прогон = baseline, оценок нет).");
  L.push("> Оценка по отзывам опирается на допущение «выкуп 7%» - это [ГИПОТЕЗА], не факт. В отчёты Ивану без пометки не подавать (Protocol 9).");
  return L.join("\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
