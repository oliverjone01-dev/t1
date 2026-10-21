import { OzonPerformance } from "../../connector/ozon-performance.js";
import { parseAttributionDaily } from "./parse-attribution.js";

export async function attributionReport(perf: OzonPerformance, cid: string, from: string, to: string, deadline: number) {
  const uuid = await perf.requestStatistics([cid], from, to, "DATE");
  if (!uuid) throw new Error("Отчёт без UUID");
  for (let i = 0; i < 60 && Date.now() < deadline; i++) {
    const state = String((await perf.statisticsState(uuid)).state ?? "");
    if (/\b(error|fail|failed|failure)\b/i.test(state)) throw new Error(`Отчёт ${cid}: ${state}`);
    if (/\b(ok|done|success|ready)\b/i.test(state)) {
      const csv = await perf.downloadStatistics(uuid);
      const header = csv.split(/\r?\n/).find(l => /(^|;)\s*sku\s*;/i.test(l) && /продажи в продвижении/i.test(l));
      if (!header || !/(^|;)\s*(день|дата)\s*;/i.test(header) || !/расход/i.test(header)) throw new Error("Неизвестный формат DATE-отчёта");
      const lines = csv.split(/\r?\n/), start = lines.indexOf(header), columns = header.split(";").map(s => s.trim().toLowerCase());
      const skuCol = columns.indexOf("sku"), dateCol = columns.findIndex(s => s === "день" || s === "дата");
      const numeric = columns.map((s,i) => /^(расход|продано товаров|продажи в продвижении)/.test(s) || /добавлен.*корзин/.test(s) ? i : -1).filter(i => i >= 0);
      for (const line of lines.slice(start+1).filter(l => l.trim())) {
        const cells = line.split(";"), sku = cells[skuCol]?.trim();
        if (cells.some(c => /^(всего|итого)$/i.test(c.trim()))) continue;
        if (!sku || !/^\d+$/.test(sku) || Number(sku) <= 0 || !/^\d{2}\.\d{2}\.\d{4}$/.test(cells[dateCol]?.trim() ?? "")) throw new Error("Некорректная строка SKU/даты в отчёте");
        const day = cells[dateCol]!.trim().split(".").reverse().join("-");
        if (new Date(`${day}T00:00:00Z`).toISOString().slice(0,10) !== day) throw new Error("Некорректная календарная дата отчёта");
        for (const i of numeric) if (!/^-?\d+(?:[.,]\d+)?$/.test((cells[i] ?? "").replace(/\s/g,""))) throw new Error("Некорректное число в отчёте");
      }
      return parseAttributionDaily(csv);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error(`Отчёт ${cid} не завершён до дедлайна`);
}

export function supportsSkuReport(campaign: { paymentType?: string }): boolean {
  return String(campaign.paymentType ?? "").toUpperCase() !== "CPO";
}
