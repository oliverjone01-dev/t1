// Реклама за клик (CPC) по атрибуции OZON: рекламируемый товар и соседи по объединённой карточке.
// Спека: knowledge/semantic/metrics/ozon-cpc-card-spread.yaml v2 (Иван 01.10). Вкладка «Реклама по карточкам».
//
// 1) Пара = рекламируемый SKU x кампания x месяц. Расход пары по дням - ads_sku_daily (sp).
// 2) Доли пары за месяц - из ads_attr_daily: свои штуки (sold) и штуки соседей (soldM) по дням.
// 3) Сосед: заказ товара той же объединённой карточки (card_groups, снимок) в день атрибуции,
//    штуки = soldM, сумма = omM (допуск 1%, не меньше 2 ₽), до 4 заказов в сочетании; отменённые тоже
//    (атрибуция OZON их включает). Логика 1:1 с пробой tools/tests/cpc_neighbor_match.py (21 из 22 против Union).
// 4) Расход делится по штукам: доля найденного соседа - прямо на его заказ; остальное - на рекламируемый SKU
//    (своя доля, ненайденный сосед, пара без продаж, пара без атрибуции в нашем сборе).
// Выход по дням, чтобы фильтр периодов работал как на «Деньгах». Инвариант: по каждому SKU и дню
// own + сумма долей соседей = round(суммы sp), то есть ровно ряд AN_ADSSKU «Денег».

export interface AdsSkuRow { d: string; cid: string; sku: string; sp: number }
export interface AttrRow { d: string; id: string; sku: string; sold?: number; soldM?: number; omM?: number }
export interface OrderRow { order: string; d: string; sku: string; units: number; revenue: number; status?: string }
export interface CardGroup { main: string; skus: { sku: string }[] }

export interface NbOrder { order: string; d: string; sk: string; st: string; units: number }
export interface CardSpread {
  own: Record<string, [string, number][]>;            // SKU -> [день, расход на сам рекламируемый товар]
  nb: [string, string, string, number][];             // [день расхода, рекламируемый SKU, заказ соседа, сумма]
  nbOrders: Record<string, NbOrder>;                  // заказы соседей
  stat: [string, number, number, number, number, number][]; // [день, CPC, на соседей, сосед не найден, без продаж, без атрибуции]
  pairs: Record<string, PairShare>;                   // ym|sku|cid -> доли (для теста и подсказок)
}
export interface PairShare { sold: number; soldM: number; unk: number; nb: Record<string, number>; attr: boolean }

const ymOf = (d: string) => d.slice(0, 7);

function findNeighbors(pool: OrderRow[], q: number, omM: number): OrderRow[] | null {
  const tol = Math.max(2, 0.01 * omM);
  const n0 = Math.min(q, 4);
  for (let n = 1; n <= n0; n++) {
    // сочетания в порядке файла, как itertools.combinations
    const idx = Array.from({ length: n }, (_, i) => i);
    if (n > pool.length) break;
    for (;;) {
      const comb = idx.map((i) => pool[i]!);
      const u = comb.reduce((a, o) => a + o.units, 0), r = comb.reduce((a, o) => a + o.revenue, 0);
      if (u === q && Math.abs(r - omM) <= tol) return comb;
      let k = n - 1;
      while (k >= 0 && idx[k] === pool.length - n + k) k--;
      if (k < 0) break;
      idx[k]!++;
      for (let j = k + 1; j < n; j++) idx[j] = idx[j - 1]! + 1;
    }
  }
  return null;
}

export function cardSpread(ads: AdsSkuRow[], attr: AttrRow[], orders: OrderRow[], groups: CardGroup[]): CardSpread {
  const card: Record<string, string> = {};
  for (const g of groups) for (const s of g.skus) card[String(s.sku)] = String(g.main);
  const members: Record<string, Set<string>> = {};
  for (const [s, c] of Object.entries(card)) (members[c] ||= new Set()).add(s);
  const byDay: Record<string, OrderRow[]> = {};
  for (const o of orders) if (o.units > 0) (byDay[o.d] ||= []).push(o);

  const pairs: Record<string, PairShare> = {};
  const nbOrders: Record<string, NbOrder> = {};
  for (const r of attr) {
    const sku = String(r.sku), k = ymOf(r.d) + "|" + sku + "|" + String(r.id);
    const p = (pairs[k] ||= { sold: 0, soldM: 0, unk: 0, nb: {}, attr: true });
    p.sold += Number(r.sold) || 0;
    const q = Number(r.soldM) || 0;
    if (!q) continue;
    p.soldM += q;
    const sib = members[card[sku] ?? ""] || new Set<string>();
    const pool = (byDay[r.d] || []).filter((o) => o.sku !== sku && sib.has(o.sku));
    const hit = findNeighbors(pool, q, Number(r.omM) || 0);
    if (!hit) { p.unk += q; continue; }
    for (const o of hit) {
      p.nb[o.order] = (p.nb[o.order] || 0) + o.units;
      nbOrders[o.order] = { order: o.order, d: o.d, sk: o.sku, st: String(o.status || ""), units: o.units };
    }
  }

  // Дневной расход по SKU и доли соседей (float), округление - на уровне SKU x день.
  const skuDay: Record<string, number> = {};                  // sku|d -> sp
  const nbF: Record<string, number> = {};                     // d|sku|order -> float
  const st: Record<string, number[]> = {};                    // d -> [tot, nb, unk, nosale, noattr] float
  for (const r of ads) {
    const sku = String(r.sku || ""); if (!sku) continue;
    const sp = Number(r.sp) || 0;
    skuDay[sku + "|" + r.d] = (skuDay[sku + "|" + r.d] || 0) + sp;
    const s = (st[r.d] ||= [0, 0, 0, 0, 0]);
    const p = pairs[ymOf(r.d) + "|" + sku + "|" + String(r.cid)];
    if (!p) { s[4]! += sp; continue; }
    const U = p.sold + p.soldM;
    if (!U) { s[3]! += sp; continue; }
    s[2]! += sp * p.unk / U;
    for (const [o, u] of Object.entries(p.nb)) {
      const k = r.d + "|" + sku + "|" + o;
      nbF[k] = (nbF[k] || 0) + sp * u / U;
    }
  }
  const nb: [string, string, string, number][] = [];
  const nbSkuDay: Record<string, number> = {};
  for (const [k, v] of Object.entries(nbF)) {
    const [d, sku, o] = k.split("|") as [string, string, string];
    const a = Math.round(v); if (!a) continue;
    nb.push([d, sku, o, a]);
    nbSkuDay[sku + "|" + d] = (nbSkuDay[sku + "|" + d] || 0) + a;
  }
  nb.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const own: Record<string, [string, number][]> = {};
  const totDay: Record<string, number> = {}, nbDay: Record<string, number> = {};
  for (const [k, v] of Object.entries(skuDay)) {
    const [sku, d] = k.split("|") as [string, string];
    const tot = Math.round(v), n = nbSkuDay[k] || 0;
    // Инвариант: доля соседей не больше расхода этого SKU в этот день (иначе задвоение, К4).
    if (n > tot + 1) throw new Error(`cpc-card-spread ${sku} ${d}: соседям ${n} при расходе ${tot}`);
    (own[sku] ||= []).push([d, tot - n]);
    totDay[d] = (totDay[d] || 0) + tot; nbDay[d] = (nbDay[d] || 0) + n;
  }
  for (const sku in own) own[sku]!.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const stat: CardSpread["stat"] = Object.keys(st).sort().map((d) => {
    const s = st[d]!;
    return [d, totDay[d] || 0, nbDay[d] || 0, Math.round(s[2]!), Math.round(s[3]!), Math.round(s[4]!)];
  });
  return { own, nb, nbOrders, stat, pairs };
}
