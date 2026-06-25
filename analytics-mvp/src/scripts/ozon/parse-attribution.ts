// Чистый парсер CSV attribution-отчёта OZON Performance (per-SKU «продажи в продвижении» +
// объединённая карточка). Формат подтверждён probe-прогоном (см. ad-attribution-probe).
// Разделитель ';', десятичная запятая, первая строка - инфо кампании, потом шапка, строки SKU,
// строка «Всего» (пропускаем). Выход 1:1 со старым n8n-skuStats, который ждёт фронт (RCACHE).

export interface SkuStat { sku: string; name: string; sp: number; sold: number; om: number; soldModel: number; omModel: number; drr: number; }

const num = (s: string): number => {
  const n = parseFloat(String(s ?? "").replace(/\s| /g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const norm = (s: string) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function parseAttributionCsv(text: string): SkuStat[] {
  const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim());
  const hIdx = lines.findIndex((l) => /(^|;)\s*sku\s*;/i.test(l) && /продажи в продвижении/i.test(l));
  if (hIdx < 0) return [];
  const header = lines[hIdx]!.split(";").map(norm);
  const find = (pred: (h: string) => boolean) => header.findIndex(pred);
  const idx = {
    sku: find((h) => h === "sku"),
    name: find((h) => h.includes("название товара")),
    sp: find((h) => h.startsWith("расход")),
    sold: find((h) => h === "продано товаров"),
    om: find((h) => h.includes("продажи в продвижении") && !h.includes("модели")),
    soldModel: find((h) => h.includes("продано товаров модели")),
    omModel: find((h) => h.includes("продажи в продвижении") && h.includes("модели")),
    drr: find((h) => h.includes("дрр в продвижении")),
  };
  if (idx.sku < 0 || idx.om < 0) return [];

  const out: SkuStat[] = [];
  for (let i = hIdx + 1; i < lines.length; i++) {
    const c = lines[i]!.split(";");
    const skuRaw = (c[idx.sku] ?? "").trim();
    if (!skuRaw || /^всего$/i.test(skuRaw)) continue; // строка «Всего» / пустая
    const sku = skuRaw.replace(/[^\d]/g, "");
    if (!sku) continue;
    out.push({
      sku,
      name: (c[idx.name] ?? "").trim(),
      sp: num(c[idx.sp] ?? ""),
      sold: num(c[idx.sold] ?? ""),
      om: num(c[idx.om] ?? ""),
      soldModel: idx.soldModel >= 0 ? num(c[idx.soldModel] ?? "") : 0,
      omModel: idx.omModel >= 0 ? num(c[idx.omModel] ?? "") : 0,
      drr: idx.drr >= 0 ? Math.round(parseFloat(String(c[idx.drr] ?? "0").replace(",", ".")) * 10) / 10 : 0,
    });
  }
  return out;
}
