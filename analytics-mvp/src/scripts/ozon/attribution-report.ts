import { OzonPerformance } from "../../connector/ozon-performance.js";
import { parseAttributionDaily } from "./parse-attribution.js";
import { readFileSync, existsSync } from "node:fs";
import { atomicText, shiftDay } from "./collector-integrity.js";
import { reportCsv } from "./report-queue.js";

export type ReportCorrection = { from: string; to: string; values: Record<string, number | null> };
export function replaceCorrections(previous: ReportCorrection[], updates: ReportCorrection[], ranges: Array<[string, string]>): ReportCorrection[] {
  const ordered = ranges.slice().sort((a,b) => a[0].localeCompare(b[0]));
  const covered = (r: ReportCorrection) => {
    let cursor = r.from;
    for (const [a,b] of ordered) {
      if (b < cursor) continue;
      if (a > cursor) return false;
      if (b >= r.to) return true;
      cursor = shiftDay(b, 1);
    }
    return false;
  };
  if (updates.some(r => !covered(r))) throw new Error("Корректировка вне принятых диапазонов");
  // Недатированную сумму нельзя разделить по дням: частичное перекрытие не удаляет её.
  return [...previous.filter(r => !covered(r)), ...updates];
}
export function saveCorrections(collector: string, updates: Record<string, ReportCorrection[]>, ranges?: Record<string, Array<[string, string]>>): void {
  const path = "data/ads_report_adjustments.json";
  const state = existsSync(path) ? JSON.parse(readFileSync(path,"utf8")) : {};
  state[collector] ??= {};
  for (const [cid, reports] of Object.entries(updates)) state[collector][cid] = { loaded_at:new Date().toISOString(),
    reports: ranges?.[cid] ? replaceCorrections(state[collector][cid]?.reports ?? [], reports, ranges[cid]!) : reports };
  atomicText(path, JSON.stringify(state) + "\n");
}

export async function attributionReport(perf: OzonPerformance, cid: string, from: string, to: string, deadline: number, onCorrection?: (row: ReportCorrection) => void) {
      const csv = await reportCsv(perf, cid, from, to, deadline);
      const header = csv.split(/\r?\n/).find(l => /(^|;)\s*sku\s*;/i.test(l) && /продажи в продвижении/i.test(l));
      if (!header || !/(^|;)\s*(день|дата)\s*;/i.test(header) || !/расход/i.test(header)) throw new Error("Неизвестный формат DATE-отчёта");
      const lines = csv.split(/\r?\n/), start = lines.indexOf(header), columns = header.split(";").map(s => s.trim().toLowerCase());
      const skuCol = columns.indexOf("sku"), dateCol = columns.findIndex(s => s === "день" || s === "дата");
      const numeric = columns.map((s,i) => /^(расход|продано товаров|продажи в продвижении)/.test(s) || /добавлен.*корзин/.test(s) ? i : -1).filter(i => i >= 0);
      const corrections: ReportCorrection[] = [];
      for (const line of lines.slice(start+1).filter(l => l.trim())) {
        const cells = line.split(";"), sku = cells[skuCol]?.trim();
        if (cells[dateCol]?.trim() === "Корректировка" && !sku) {
          if (!onCorrection) throw new Error("Недатированная корректировка требует отдельного учёта");
          const values: Record<string,number|null> = {};
          for (const i of numeric) {
            const raw = (cells[i] ?? "").replace(/\s/g, "");
            if (raw && !/^[+-]?\d+(?:[.,]\d+)?$/.test(raw)) throw new Error("Некорректное число корректировки");
            values[columns[i]!] = raw ? Number(raw.replace(",",".")) : null;
            if (raw && !Number.isFinite(values[columns[i]!]!)) throw new Error("Неконечное число корректировки");
          }
          corrections.push({ from, to, values });
          continue;
        }
        if (/^(всего|итого)$/i.test(cells[dateCol]?.trim() ?? "") || /^(всего|итого)$/i.test(sku ?? "")) continue;
        if (!sku || !/^\d+$/.test(sku) || Number(sku) <= 0 || !/^\d{2}\.\d{2}\.\d{4}$/.test(cells[dateCol]?.trim() ?? "")) throw new Error("Некорректная строка SKU/даты в отчёте");
        const day = cells[dateCol]!.trim().split(".").reverse().join("-");
        if (new Date(`${day}T00:00:00Z`).toISOString().slice(0,10) !== day) throw new Error("Некорректная календарная дата отчёта");
        for (const i of numeric) if (!/^-?\d+(?:[.,]\d+)?$/.test((cells[i] ?? "").replace(/\s/g,""))) throw new Error("Некорректное число в отчёте");
      }
      const rows = parseAttributionDaily(csv);
      // Callback только после проверки всего CSV; у вызывающего до принятия окна
      // это накопление metadata в памяти, запись выполняется после основного ряда.
      for (const row of corrections) onCorrection!(row);
      return rows;
}

export function supportsSkuReport(campaign: { paymentType?: string }): boolean {
  return String(campaign.paymentType ?? "").toUpperCase() !== "CPO";
}
