// Реклама «за заказ» (CPO) по отправлениям OZON. Иван 30.09, вариант 1.
//
// Отчёт CPO даёт одну сумму на заказ (номер без хвоста отправления). Раньше она ставилась на КАЖДОЕ
// отправление заказа: 0172335655-0037 из двух отправлений - 1 393 ₽ дважды (июнь +123 600 ₽,
// июль +62 654 ₽, август +46 682 ₽ лишней рекламы).
//
// Теперь сумма заказа ставится один раз:
//   1) на отправления, у артикула которых в дату заказа есть CPO в суточном отчёте (cpo_sku_daily);
//   2) не понять (таких нет) - на все отправления заказа;
// и делится поровну между выбранными, остаток копеек - на последнее. Отменённые не берутся, если
// есть неотменённые (строка отменённого заказа рекламу не несёт).

export interface CpoPosting { order: string; d: string; sku: string; status?: string }

const base = (o: string) => o.replace(/-\d+$/, "");

export function splitCpo(cpoByOrder: Record<string, number>, postings: CpoPosting[], cpoSkuDay: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  const groups: Record<string, CpoPosting[]> = {};
  for (const p of postings) {
    // Ключ отчёта - номер заказа; если в отчёте номер отправления, сумма только его.
    const k = cpoByOrder[base(p.order)] != null ? base(p.order) : cpoByOrder[p.order] != null ? p.order : "";
    if (k) (groups[k] ||= []).push(p);
  }
  for (const [k, ps0] of Object.entries(groups)) {
    const total = Math.round(cpoByOrder[k] || 0);
    if (!total) continue;
    const live = ps0.filter((p) => p.status !== "cancelled");
    const ps = live.length ? live : ps0;
    const hit = ps.filter((p) => (cpoSkuDay[p.d + "|" + p.sku] || 0) > 0);
    const to = hit.length ? hit : ps;
    const each = Math.floor(total / to.length);
    to.forEach((p, i) => { out[p.order] = i === to.length - 1 ? total - each * (to.length - 1) : each; });
  }
  return out;
}
