// Этап 0: проверка связи с Яндекс Маркет Partner API (только чтение).
// Печатает список кампаний (campaignId, тип размещения, домен, бизнес-кабинет) и по одной
// кампании делает пробный stats/orders за вчера. Ключ: YM_API_KEY локально / секрет
// YM_DASHBOARD_1 в Actions. Ничего в кабинете не меняет.
// Запуск: npm run ym:ping. В CI итог уходит в $GITHUB_STEP_SUMMARY (без ключа).
import { appendFileSync } from "node:fs";
import { loadEnv } from "../../env.js";
import { client, resolveCampaigns, campaignSummary, bizName, windowDays } from "./common.js";
import { ymBusinessIdsFromEnv } from "../../connector/ym-partner.js";

async function main() {
  loadEnv();
  const api = client();
  const all = await api.campaigns();
  console.log(`[Market] кампаний у ключа: ${all.length}`);
  console.log(campaignSummary(all));
  const biz = ymBusinessIdsFromEnv();
  const byBiz: Record<string, number> = {};
  for (const c of all) byBiz[c.businessId] = (byBiz[c.businessId] || 0) + 1;
  for (const b of biz) console.log(`  кабинет ${b} (${bizName(b)}): кампаний ${byBiz[b] || 0}${byBiz[b] ? "" : "  <- НЕТ ДОСТУПА или id кабинета другой"}`);
  const picked = await resolveCampaigns(api);
  console.log(`[Market] к обработке: ${picked.length} кампаний`);

  const w = windowDays(7);
  const lines: string[] = [];
  for (const c of picked) {
    try {
      const orders = await api.ordersStats(c.id, { dateFrom: w.dateFrom, dateTo: w.dateTo });
      const items = orders.reduce((s, o) => s + o.items.length, 0);
      const statuses: Record<string, number> = {};
      for (const o of orders) statuses[o.status] = (statuses[o.status] || 0) + 1;
      const sample = orders[0];
      lines.push(`campaign ${c.id}: заказов за ${w.dateFrom}..${w.dateTo}: ${orders.length} (позиций ${items}); статусы ${JSON.stringify(statuses)}`);
      if (sample) lines.push(`  пример: creationDate=${sample.creationDate} status=${sample.status} items=${sample.items.length} commissions=${sample.commissions.map((x) => x.type).join("|") || "-"} priceTypes=${[...new Set(sample.items.flatMap((i) => i.prices.map((p) => p.type)))].join("|") || "-"}`);
    } catch (e) { lines.push(`campaign ${c.id}: stats/orders ОШИБКА: ${(e as Error).message.slice(0, 200)}`); }
  }
  for (const l of lines) console.log(l);

  const summary = [
    "## Яндекс Маркет: связь подтверждена", "",
    `Кампаний у ключа: **${all.length}**, к обработке: **${picked.length}**`, "",
    "| campaignId | тип | домен | businessId | кабинет |", "|---|---|---|---|---|",
    ...all.map((c) => `| ${c.id} | ${c.placementType} | ${c.domain || "-"} | ${c.businessId} | ${bizName(c.businessId, c.businessName)} |`),
    "", "```", ...lines, "```",
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
  console.log("OK: Partner API отвечает, ключ рабочий, кабинет не трогали (только GET/stats).");
}

main().catch((e) => { console.error("Ошибка связи с Маркетом:", (e as Error).message); process.exit(1); });
