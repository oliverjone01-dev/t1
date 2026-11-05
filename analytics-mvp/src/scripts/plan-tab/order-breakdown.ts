const DM=(d:string)=>d.slice(8)+"."+d.slice(5,7);
const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const F = (x: number | null | undefined, nd = 0): string => x == null || !Number.isFinite(x) ? "-"
  : x.toFixed(nd).replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace(".", ",");
export interface OrderModel { model: string; units: number; share: number; skus: Array<{ sku: string; offer: string; units: number }> }
export interface OrderBreakdown { total: number | null; end: string; models: OrderModel[] }
const MODEL_COLORS = ["#22d3ee", "#a28eea", "#efbb55", "#65c7a3", "#d58aad", "#72a7ed", "#e89965", "#a6be63"];
export function renderOrderBreakdown(b: OrderBreakdown, start: string, id: string): string {
  const head = `<div class="ob-head"><b>Заказы по моделям</b><span>${DM(start)}-${b.end ? DM(b.end) : "?"} · ${F(b.total)} шт.</span></div>`;
  if (b.total == null || b.total === 0) return `<section class="order-breakdown">${head}<p class="muted">${b.total == null ? "Нет данных за период" : "Заказов за период нет"}</p></section>`;
  // Цвет одинаков у сегмента и его плашки; имя и штуки доступны без наведения, даже у доли в 1 шт.
  const color = (i: number): string => MODEL_COLORS[i % MODEL_COLORS.length]!;
  const strip = `<div class="ob-stack" aria-hidden="true">${b.models.map((m, i) =>
    `<span style="width:${m.share}%;background:${color(i)}"></span>`).join("")}</div>`;
  const pills = `<div class="ob-pills">${b.models.map((m, i) =>
    `<button type="button" class="ob-pill" id="${id}-button-${i}" style="--model-color:${color(i)}" aria-expanded="false" aria-controls="${id}-sku-${i}">`
    + `<span class="ob-name">${esc(m.model)}</span><b>${F(m.units)} шт.</b></button>`).join("")}</div>`;
  const skuPanels = b.models.map((m, i) => `<div class="ob-skus" id="${id}-sku-${i}" role="region" aria-labelledby="${id}-button-${i}" hidden>`
    + m.skus.map((s) => `<div><span>${esc(s.offer)} <span class="muted">· SKU ${esc(s.sku)}</span></span><b>${F(s.units)} шт.</b></div>`).join("") + `</div>`).join("");
  return `<section class="order-breakdown">${head}${strip}${pills}${skuPanels}</section>`;
}

