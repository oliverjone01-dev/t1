// Тянет ЖИВЫЕ данные OZON из n8n-вебхуков и кладёт в data/. Запуск перед build:site.
// Источник правды - n8n (Иван). Никаких фикстур и выдуманных чисел: либо живой OZON,
// либо последний удачный снимок из data/ (если n8n недоступен - сборку не валим).
// Креды OZON живут в n8n, не в репозитории (Protocol 6: секреты только в vault).
import { writeFileSync, existsSync } from "node:fs";
import { normalizePnl, type RawPnl } from "../util/pnl.js";

const BASE = process.env.N8N_WEBHOOK_BASE || "https://gen-group.app.n8n.cloud/webhook";
const DAYS = process.env.LIVE_DAYS || "30";

// Окно последних N дней до вчера, нижняя граница - старт аккаунта (DOC_02 §3).
function window(days: number): { dateFrom: string; dateTo: string } {
  const FLOOR = "2026-02-01";
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  y.setUTCDate(y.getUTCDate() - 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const to = fmt(y);
  const f = new Date(y); f.setUTCDate(f.getUTCDate() - (days - 1));
  let from = fmt(f);
  if (from < FLOOR) from = FLOOR;
  return { dateFrom: from, dateTo: to };
}

async function hit(path: string, body: Record<string, unknown>): Promise<any> {
  const url = `${BASE}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const json = await res.json();
  if (!json || (typeof json === "object" && Object.keys(json).length === 0)) throw new Error(`${path}: пустой ответ`);
  return json;
}

// Эвристика n8n помечает столы VIOLUR как «перегородки» - чиним подпись (решение Ивана).
function fixViolur<T>(obj: T): T {
  const s = JSON.stringify(obj).replace(/VIOLUR \(перегородки\)/g, "VIOLUR (столы)");
  return JSON.parse(s) as T;
}

// Пишем только при успешном живом ответе; иначе оставляем прошлый снимок в data/.
async function pull(name: string, file: string, run: () => Promise<unknown>): Promise<boolean> {
  try {
    const data = run ? await run() : null;
    writeFileSync(`data/${file}`, JSON.stringify(data, null, 2));
    console.log(`OK   ${name} -> data/${file}`);
    return true;
  } catch (e) {
    const keep = existsSync(`data/${file}`);
    console.warn(`WARN ${name}: ${(e as Error).message}. ${keep ? "оставлен прошлый снимок" : "ФАЙЛА НЕТ"}`);
    return false;
  }
}

async function main() {
  const days = parseInt(DAYS, 10) || 30;
  const w = window(days);
  let okFinance = true;

  await pull("Реклама Performance", "ads_30d.json", async () =>
    fixViolur(await hit("gengroup-ozon-ads", { days: String(days) })));

  // Реклама по стандартным периодам (7/30/90 дн) - чтобы дашборд переключал период
  // МГНОВЕННО на реальные данные, а не ждал живой запрос (Performance API медленный).
  await pull("Реклама по периодам", "ads_periods.json", async () => {
    const out: Record<string, unknown> = {};
    for (const d of [7, 30, 90]) out["p" + d] = fixViolur(await hit("gengroup-ozon-ads", window(d)));
    return out;
  });

  await pull("Товары (live SKU)", "skus_live_30d.json", async () =>
    fixViolur(await hit("gengroup-ozon-skus", { days: String(days) })));

  // P&L: явные даты обязательны (вебхук без них отдаёт OZON 400).
  okFinance = await pull("P&L канал", "pnl_30d.json", async () =>
    normalizePnl(await hit("gengroup-ozon-pnl", w) as RawPnl)) && okFinance;

  okFinance = await pull("P&L по SKU", "pnl_sku_30d.json", async () =>
    await hit("gengroup-ozon-pnl-sku", w)) && okFinance;

  console.log(`Окно ${w.dateFrom}..${w.dateTo} · финансы ${okFinance ? "ОК" : "из прошлого снимка"}`);
}

main();
