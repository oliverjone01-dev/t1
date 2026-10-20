// Юнит-экономика рекламы (блок «Юнит-экономика рекламы» на «Маркетинге»): ставка сборов OZON и с/с по SKU.
//
// Источник с 20.10.2026 - ряд pnl_sku_accrual_daily (accrual-API: только доставленные заказы, выручка и
// сборы по дате заказа). Старый pnl_sku_30d.json замёрз на 07.09: OZON отключил /v3/finance/transaction/list.
// Окно - последние ECON_WIN_DAYS дней ряда (а не выбранный период: начисления приходят после доставки,
// в свежих днях их почти нет).
// Эквайринг и хранение в SKU-ряд не приходят (они уровня кабинета): к ставке SKU добавляем разницу
// ставок канального ряда (pnl_channel_accrual_daily, все сборы) и SKU-ряда за то же окно (Иван 20.10, 1б).
// У SKU меньше ECON_MIN_DAYS дней с доставками - ставка его категории за то же окно (Иван 20.10, 2а).
export const ECON_WIN_DAYS = 60;
export const ECON_MIN_DAYS = 3;

export type SkuAccrRow = { d: string; sku: string; accruals: number; amount: number };
export type ChanRow = { d: string; accruals: number; fees: number };
export type LiveSku = { sku: string | number; rev?: number; units?: number; price?: number | null };
export type Econ = {
  com: number | null; comSrc: string; cogs: number | null; be: number | null; accr: number;
  why: string | null; price: number | null; comRub: number | null; cogsRub: number | null;
};
export type EconMeta = { from: string; to: string; topUp: number | null; warn: string[] };

const r1 = (x: number) => Math.round(x * 10) / 10;
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const rate = (accr: number, amount: number) => ((accr - amount) / accr) * 100;

export function adEcon(
  skuRows: SkuAccrRow[], chRows: ChanRow[], cogs: Record<string, number>, live: LiveSku[],
  catOf: (sku: string) => string, extraSkus: string[],
): { econ: Record<string, Econ>; meta: EconMeta } {
  const warn: string[] = [];
  let to = "";
  for (const r of skuRows) if ((r.accruals || 0) > 0 && r.d > to) to = r.d;
  if (!to) return { econ: {}, meta: { from: "", to: "", topUp: null, warn: ["ряд начислений по SKU пуст - ставки сборов нет"] } };
  const from = addDays(to, -(ECON_WIN_DAYS - 1));

  const bySku: Record<string, { accr: number; amt: number; days: number }> = {};
  const byCat: Record<string, { accr: number; amt: number }> = {};
  let A = 0, M = 0;
  for (const r of skuRows) {
    if (r.d < from || r.d > to) continue;
    const sku = String(r.sku), a = r.accruals || 0, m = r.amount || 0;
    const s = (bySku[sku] ||= { accr: 0, amt: 0, days: 0 });
    s.accr += a; s.amt += m; if (a > 0) s.days++;
    const c = (byCat[catOf(sku)] ||= { accr: 0, amt: 0 });
    c.accr += a; c.amt += m;
    A += a; M += m;
  }
  // Надбавка за эквайринг и хранение: ставка канала (все сборы) минус ставка SKU-ряда за то же окно.
  // Оба ряда берут выручку из одних постингов по дате заказа - начислено должно совпасть.
  let CA = 0, CF = 0;
  for (const r of chRows) if (r.d >= from && r.d <= to) { CA += r.accruals || 0; CF += r.fees || 0; }
  let topUp: number | null = null;
  if (A > 0 && CA > 0) {
    if (Math.abs(CA - A) / A > 0.01) warn.push(`начислено в канале ${Math.round(CA)} и по SKU ${Math.round(A)} за ${from}..${to} расходятся больше 1% - надбавку за эквайринг и хранение не добавляю`);
    else {
      const t = (-CF / CA) * 100 - rate(A, M);
      if (t < 0) warn.push(`надбавка за эквайринг и хранение отрицательная (${r1(t)} п.п.) - беру 0`);
      topUp = r1(Math.max(0, t));
    }
  } else warn.push("канального ряда за окно нет - надбавку за эквайринг и хранение не добавляю");

  const liveBy: Record<string, LiveSku> = {};
  for (const s of live) liveBy[String(s.sku)] = s;
  const skus = new Set<string>([...Object.keys(bySku), ...live.map((s) => String(s.sku)), ...extraSkus.map(String)]);
  const econ: Record<string, Econ> = {};
  for (const sku of skus) {
    const s = bySku[sku], cat = catOf(sku), c = byCat[cat];
    let base: number | null = null, comSrc = "";
    if (s && s.days >= ECON_MIN_DAYS && s.accr > 0) { base = rate(s.accr, s.amt); comSrc = `по SKU, ${s.days} дн. с доставками`; }
    else if (c && c.accr > 0) { base = rate(c.accr, c.amt); comSrc = `по категории «${cat}» (у SKU ${s ? s.days : 0} дн. с доставками)`; }
    const com = base == null ? null : r1(base + (topUp || 0));
    const L = liveBy[sku];
    const price = L && (L.units || 0) > 0 && (L.rev || 0) > 0 ? Math.round(L.rev! / L.units!) : (L && L.price ? Math.round(L.price) : null);
    const cu = cogs[sku] || 0;
    const cogsPct = cu > 0 && price ? r1((cu / price) * 100) : null;
    const be = com != null && cogsPct != null ? r1(100 - com - cogsPct) : null;
    const why = com == null ? "нет начислений ни по SKU, ни по категории" : (!(cu > 0) ? "нет себестоимости" : (cogsPct == null ? "нет цены" : null));
    econ[sku] = {
      com, comSrc, cogs: cogsPct, be, accr: Math.round(s ? s.accr : 0), why, price,
      comRub: price != null && com != null ? Math.round((price * com) / 100) : null, cogsRub: cu > 0 ? Math.round(cu) : null,
    };
  }
  return { econ, meta: { from, to, topUp, warn } };
}
