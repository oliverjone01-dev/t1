// РАЗВЕДКА (Иван 25.09.2026, п. 1.4): есть ли у OZON отчёт о реализации за незакрытый месяц, чтобы
// брать базу налога «Реализовано» (F «Реализовано на сумму» + G «Выплаты по механикам лояльности
// партнёров») из документа, а не оценкой. Кандидат - POST /v1/finance/realization/by-day (по
// публикациям OZON: отчёт о реализации за день, глубина до 32 дней, подписки Premium Plus/Pro,
// без отмен и невыкупов). Точного формата запроса и ответа из окружения не узнать - сайты OZON
// закрыты, поэтому спрашиваем сам API.
//
// Репозиторий публичный, логи задач видны всем: печатаем ТОЛЬКО структуру ответа (пути ключей),
// число строк и суммы по дню, без строк по товарам и без цен отдельных позиций.
// Запуск: OZON_SELLER_* в env; npx tsx src/scripts/ozon/realization-day-probe.ts [YYYY-MM-DD ...]
import { OzonSeller } from "../../connector/ozon-seller.js";

const HOST = "https://api-seller.ozon.ru";

function keyPaths(o: any, pre = "", out = new Set<string>(), depth = 0): Set<string> {
  if (depth > 6 || o == null || typeof o !== "object") return out;
  if (Array.isArray(o)) { if (o.length) keyPaths(o[0], pre + "[]", out, depth + 1); return out; }
  for (const k of Object.keys(o)) { const p = pre ? pre + "." + k : k; out.add(p + ":" + (Array.isArray(o[k]) ? "array" : typeof o[k])); keyPaths(o[k], p, out, depth + 1); }
  return out;
}
// Сумма числовых полей по имени во всём дереве, раздельно для веток продажи и возврата.
function sums(rows: any[]): Record<string, number> {
  const s: Record<string, number> = {};
  const walk = (o: any, br: string) => {
    if (o == null || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach((x) => walk(x, br)); return; }
    for (const k of Object.keys(o)) {
      const v = o[k], b = /return/i.test(k) ? "return" : /deliver|sale|sold/i.test(k) ? "delivery" : br;
      if (typeof v === "number" && /amount|coinvest|stars|bonus|quantity|price|total|fee|commission/i.test(k)) s[b + "." + k] = (s[b + "." + k] || 0) + v;
      else if (v && typeof v === "object") walk(v, b);
    }
  };
  rows.forEach((r) => walk(r, "row"));
  for (const k in s) s[k] = Math.round(s[k]! * 100) / 100;
  return s;
}

async function tryBody(headers: Record<string, string>, path: string, body: unknown) {
  const res = await fetch(`${HOST}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const txt = await res.text();
  return { status: res.status, txt };
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("realization-day-probe: OZON_SELLER_* нет - пропуск"); return; }
  const headers = { "Client-Id": clientId, "Api-Key": apiKey, "Content-Type": "application/json" };
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dates = process.argv.slice(2).filter(Boolean);
  if (!dates.length) dates.push(y);

  for (const d of dates) {
    const [yy, mm, dd] = d.split("-").map(Number);
    const variants: unknown[] = [{ date: d }, { day: dd, month: mm, year: yy }, { date: { from: d, to: d } }];
    console.log(`\n=== /v1/finance/realization/by-day ${d} ===`);
    for (const body of variants) {
      try {
        const r = await tryBody(headers, "/v1/finance/realization/by-day", body);
        console.log(`  тело ${JSON.stringify(body)} -> HTTP ${r.status}`);
        if (r.status !== 200) { console.log("   ответ:", r.txt.slice(0, 300)); continue; }
        const data = JSON.parse(r.txt);
        console.log("   структура ответа:", Array.from(keyPaths(data)).slice(0, 80).join(" | "));
        const res = data.result ?? data;
        const rows: any[] = res.rows ?? res.items ?? res.report_rows ?? (Array.isArray(res) ? res : []);
        const skus = new Set(rows.map((x) => String(x?.item?.sku ?? x?.sku ?? "")));
        const posts = new Set(rows.map((x) => String(x?.posting_number ?? x?.posting?.posting_number ?? "")).filter(Boolean));
        console.log(`   строк ${rows.length}, SKU ${skus.size}, номеров отправлений ${posts.size}`);
        console.log("   суммы за день:", JSON.stringify(sums(rows)));
        break; // первый рабочий вариант тела - дальше не пробуем
      } catch (e) { console.log(`  тело ${JSON.stringify(body)} -> ошибка ${(e as Error).message}`); }
    }
  }

  // Второй кандидат: цена для покупателя в отправлениях (financial_data). Только пути ключей.
  try {
    const posts = await new OzonSeller({ clientId, apiKey }).postings(y, y);
    const withFd = posts.find((p) => p.financial_data);
    console.log(`\n=== financial_data отправлений за ${y}: отправлений ${posts.length} ===`);
    if (withFd) console.log("   структура:", Array.from(keyPaths(withFd.financial_data)).join(" | "));
  } catch (e) { console.log("postings FAILED:", (e as Error).message); }
}

main().catch((e) => { console.error("realization-day-probe FAILED:", (e as Error).message); process.exit(0); });
