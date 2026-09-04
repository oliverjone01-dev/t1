// Этап 0: проверка связи с Яндекс Маркет Partner API (только чтение).
// Печатает список кампаний (campaignId, тип размещения, домен, бизнес-кабинет) и по одной
// кампании делает пробный stats/orders за вчера. Ключ: YM_API_KEY локально / секрет
// YM_DASHBOARD_1 в Actions. Ничего в кабинете не меняет.
// Запуск: npm run ym:ping. В CI итог уходит в $GITHUB_STEP_SUMMARY (без ключа).
import { appendFileSync } from "node:fs";
import { loadEnv } from "../../env.js";
import { accounts, resolveTargets, targetSummary, bizName, windowDays } from "./common.js";
import { ymBusinessIdsFromEnv, shape } from "../../connector/ym-partner.js";

async function main() {
  loadEnv();
  const accs = accounts();
  console.log(`[Market] ключей задано: ${accs.length} (${accs.map((a) => `${a.label}/${a.env}`).join(", ")})`);
  const targets = await resolveTargets(accs);
  console.log(`[Market] кампаний всего: ${targets.length}`);
  console.log(targetSummary(targets));
  const byBiz: Record<string, number> = {};
  for (const t of targets) byBiz[t.campaign.businessId] = (byBiz[t.campaign.businessId] || 0) + 1;
  for (const b of ymBusinessIdsFromEnv()) console.log(`  кабинет ${b} (${bizName(b)}): кампаний ${byBiz[b] || 0}${byBiz[b] ? "" : "  <- ни один ключ не видит этот кабинет"}`);
  const picked = targets.map((t) => t.campaign);
  const apiOf = new Map(targets.map((t) => [t.campaign.id, t.account.api]));

  const w = windowDays(7);
  const lines: string[] = [];
  for (const c of picked) {
    try {
      const api = apiOf.get(c.id)!;
      const orders = await api.ordersStats(c.id, { dateFrom: w.dateFrom, dateTo: w.dateTo });
      const items = orders.reduce((s, o) => s + o.items.length, 0);
      const statuses: Record<string, number> = {};
      for (const o of orders) statuses[o.status] = (statuses[o.status] || 0) + 1;
      const sample = orders[0];
      lines.push(`campaign ${c.id}: заказов за ${w.dateFrom}..${w.dateTo}: ${orders.length} (позиций ${items}); статусы ${JSON.stringify(statuses)}`);
      if (sample) lines.push(`  пример: creationDate=${sample.creationDate.replace(/\d/g, "9")} (формат запроса: ${api.orderDateFormat}) status=${sample.status} items=${sample.items.length} commissions=${sample.commissions.map((x) => x.type).join("|") || "-"} priceTypes=${[...new Set(sample.items.flatMap((i) => i.prices.map((p) => p.type)))].join("|") || "-"}`);
      if (apiOf.get(c.id)!.lastRawOrder) lines.push(`  сырые ключи заказа: ${JSON.stringify(shape(apiOf.get(c.id)!.lastRawOrder))}`);
    } catch (e) { lines.push(`campaign ${c.id}: stats/orders ОШИБКА: ${(e as Error).message.slice(0, 200)}`); }
  }
  for (const l of lines) console.log(l);

  const summary = [
    "## Яндекс Маркет: связь подтверждена", "",
    `Ключей: **${accs.length}**, кампаний: **${picked.length}**`, "",
    "| campaignId | тип | домен | businessId | кабинет | ключ |", "|---|---|---|---|---|---|",
    ...targets.map((t) => `| ${t.campaign.id} | ${t.campaign.placementType} | ${t.campaign.domain || "-"} | ${t.campaign.businessId} | ${bizName(t.campaign.businessId, t.campaign.businessName)} | ${t.account.label} |`),
    "", "```", ...lines, "```",
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
  console.log("OK: Partner API отвечает, ключ рабочий, кабинет не трогали (только GET/stats).");
}

main().catch((e) => { console.error("Ошибка связи с Маркетом:", (e as Error).message); process.exit(1); });
