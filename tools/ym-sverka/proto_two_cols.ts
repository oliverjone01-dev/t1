// Прототип «два столбца Начислено» (v12). Не билдер: считает по data-ym и печатает JSON.
// Столбец 1 = как сейчас (строки блока ACC buildAccNetting за даты окна).
// Столбец 2 = заказы, у которых ДЕНЕЖНЫЕ сборы Маркета впервые пришли в периоде (дата признания):
//   их платежи покупателя за любые даты (до границы реестра) + возвраты в периоде по признанным заказам;
//   сборы - все денежные сборы в периоде (как столбец 1); наша доставка - ведомость по заказам столбца 2.
const R = process.cwd() + "/"; // запуск из analytics-mvp: npx tsx ../tools/ym-sverka/proto_two_cols.ts
import { readFileSync } from "node:fs";
import { buildAccNetting, accNetKind, accFeeKey, nettingCancelled, accLedgerFullTo, cogsLookup, accNetReady, type AccNettingRow } from "../../analytics-mvp/src/scripts/ym/derive-lib.ts";
import { parseDeliveryCsv, withoutCancelled, resolveOrders, delivByOrder } from "../../analytics-mvp/src/scripts/ym/delivery-lib.ts";

const nd = (f: string) => readFileSync(R + "data-ym/" + f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const net = nd("netting.ndjson") as AccNettingRow[];
const orders = nd("orders.ndjson");
const cogsAt = cogsLookup(JSON.parse(readFileSync(R + "data-ym/sku_cogs.json", "utf-8")));
const ADM = 0.3, TAX = 0.15;
const acc = buildAccNetting(net, orders, cogsAt).rows;
const TO = accLedgerFullTo(acc).to;
const ready = accNetReady(net);

const ordAll = orders.filter((o: any) => !o.service);
const known = new Set(ordAll.map((r: any) => String(r.order)));
const delivered = new Set(ordAll.filter((r: any) => r.status === "DELIVERED").map((r: any) => String(r.order)));
const ordInfo = new Map<string, any>();
for (const o of ordAll) if (!ordInfo.has(o.order)) ordInfo.set(o.order, o);
const deliv = delivByOrder(resolveOrders(withoutCancelled(parseDeliveryCsv(readFileSync(R + "fixtures/delivery_ym.csv", "utf-8"))), known, delivered));

// По заказу: проводки с видом.
type P = { d: string; kind: string; f?: string; a: number; sku: string; qty: number; svc: string };
const byOrd = new Map<string, P[]>();
const qtyOf = (r: AccNettingRow) => { const c = Number(r.count); if (c > 0) return c; const o = ordAll.find((x: any) => x.order === r.order && x.sku === r.sku); return o ? Number(o.count) || 1 : 1; };
let skipNotReady = 0;
for (const r of net) {
  if (!r.order || !String(r.order).trim() || r.d > TO) continue;
  if (!ready(String(r.business || ""), r.d)) { skipNotReady++; continue; }
  if (nettingCancelled(r)) continue;
  const kind = accNetKind(r.type || "", String(r.src || ""));
  const f = kind === "fee" ? accFeeKey(r.service || "", String(r.src || "")) : undefined;
  const p: P = { d: r.d, kind, f, a: Number(r.amount) || 0, sku: r.sku || "", qty: (kind === "pay" || kind === "back") && r.sku ? qtyOf(r) : 0, svc: String(r.service || "") };
  (byOrd.get(String(r.order)) || byOrd.set(String(r.order), []).get(String(r.order))!).push(p);
}
const isMoneyFee = (p: P) => p.kind === "fee" && p.f !== "cofin";
const firstFee = new Map<string, string>();
// Признак продажи: сбор за продажу (размещение) или перевод платежа продавцу - деньгами или баллами.
// «Приём платежа» приходит в день оплаты, штрафы бывают и у отменённых - не признак.
const isSaleFee = (p: P) => p.kind === "fee" && /размещение товарных предложений|перевод платежа/i.test(p.svc);
for (const [o, ps] of byOrd) for (const p of ps) if (isSaleFee(p) && p.a !== 0 && (!firstFee.has(o) || p.d < firstFee.get(o)!)) firstFee.set(o, p.d);
const unitCogs = (sku: string) => cogsAt(sku);

// Общие кабинета (без заказа): удержания + премия, без «Внесено продавцом».
function general(from: string, to: string) {
  let acct = 0, prem = 0;
  for (const r of net) {
    if (r.order && String(r.order).trim()) continue;
    if (r.d < from || r.d > to || r.src === undefined || nettingCancelled(r)) continue;
    const s = String(r.src || "");
    if (/^прем/i.test(s)) prem += r.amount; else if (!/внесено продавц/i.test(s)) acct += r.amount;
  }
  return { acct, prem };
}

function col1(from: string, to: string) {
  const T: any = { acc: 0, got: 0, back: 0, pay: 0, dlv: 0, units: 0, fee: 0, amount: 0, cogs: 0, sold: 0, ret: 0 };
  for (const x of acc) {
    if (x.d < from || x.d > to) continue;
    T.acc += x.accruals; T.got += x.got + x.dgot; T.back += x.back + x.dback; T.pay += x.pay; T.dlv += x.dlv; T.units += x.units; T.sold += x.sold; T.ret += x.ret;
    T.fee += -(x.commission + x.delivery + x.acquiring + x.storage + x.promo + x.otherSvc); T.amount += x.amount; T.cogs += x.cogs || 0;
  }
  T.adm = T.amount * ADM; T.tax = (T.pay + T.dlv) * TAX; T.np = T.amount - T.cogs - T.adm - T.tax;
  const g = general(from, to); T.gen = g.acct + g.prem; T.netAll = T.np + T.gen;
  return T;
}

function col2(from: string, to: string) {
  const T: any = { got: 0, gotPrev: 0, gotIn: 0, back: 0, units: 0, sold: 0, ret: 0, fee: 0, other: 0, cogs: 0, ship: 0, orders: 0, shipOrders: 0, mpDelivOrders: 0, unseen: [] as any[], backNoFee: 0, backNoFeeN: 0, cogsUnknown: 0 };
  // мост к столбцу 1
  const B: any = { inPeriodNoFeeYet: 0, inPeriodFeeLater: 0, inPeriodFeeEarlier: 0, nInFly: 0, nLater: 0 };
  const pop: string[] = [];
  for (const [o, ps] of byOrd) {
    const ff = firstFee.get(o);
    const inPop = !!ff && ff >= from && ff <= to;
    if (inPop) pop.push(o);
    let payIn = 0;
    for (const p of ps) {
      if (p.kind === "pay") {
        if (p.d >= from && p.d <= to) payIn += p.a;
        if (inPop) { T.got += p.a; if (p.d < from) T.gotPrev += p.a; else T.gotIn += p.a; if (p.sku) { T.sold += p.qty; const c = unitCogs(p.sku); if (c != null) T.cogs += c * p.qty; else T.cogsUnknown++; } }
      } else if (p.kind === "back" && p.d >= from && p.d <= to) {
        if (ff && ff <= to) { T.back += p.a; if (p.sku) { T.ret += p.qty; const c = unitCogs(p.sku); if (c != null) T.cogs -= c * p.qty; } }
        else { T.backNoFee += p.a; T.backNoFeeN++; }
      } else if (p.d >= from && p.d <= to && p.kind === "fee" && p.f !== "cofin") T.fee += -p.a;
      else if (p.d >= from && p.d <= to && p.kind === "other") T.other += p.a;
    }
    if (!inPop && payIn) {
      if (!ff) { B.inPeriodNoFeeYet += payIn; B.nInFly++; }
      else if (ff > to) { B.inPeriodFeeLater += payIn; B.nLater++; }
      else B.inPeriodFeeEarlier += payIn;
    }
  }
  // Наша доставка и «кто вёз» по заказам столбца 2.
  for (const o of pop) {
    T.orders++;
    const d = deliv.get(o);
    const mp = (byOrd.get(o) || []).filter((p) => p.kind === "fee" && p.f === "delivery" && /доставк/i.test(p.svc) && !/возврат|невыкуп/i.test(p.svc)).reduce((s, p) => s - p.a, 0);
    if (d && d.known && d.ship > 0) { T.ship += d.ship; T.shipOrders++; }
    else if (mp > 0) T.mpDelivOrders++;
    else { const oi = ordInfo.get(o); T.unseen.push({ order: o, d: firstFee.get(o), sku: oi?.sku || "", name: String(oi?.name || "").slice(0, 60), status: oi?.status || "", inLedger: !!d }); }
  }
  T.acc = T.got + T.back; T.units = T.sold - T.ret;
  // «прочие» проводки (компенсация за потерянный заказ) - в К выплате как в столбце 1
  T.amount = T.acc - T.fee + T.other;
  T.adm = T.amount * ADM; T.tax = T.acc * TAX;
  T.np = T.amount - T.cogs - T.ship - T.adm - T.tax;
  const g = general(from, to); T.gen = g.acct + g.prem; T.netAll = T.np + T.gen;
  return { T, B, pop };
}

// Примеры на стыке месяцев: оплачен в одном месяце, сборы в следующем.
function examples() {
  const out: any[] = [];
  const pick = (cond: (o: string, ps: P[], ff: string) => boolean, n: number) => {
    for (const [o, ps] of byOrd) { const ff = firstFee.get(o); if (!ff) continue; if (cond(o, ps, ff) && out.length < 99) { out.push(o); if (--n <= 0) break; } }
  };
  pick((o, ps, ff) => ps.some((p) => p.kind === "pay" && p.d.startsWith("2026-08")) && ff.startsWith("2026-09"), 2);
  pick((o, ps, ff) => ps.some((p) => p.kind === "pay" && p.d.startsWith("2026-07")) && ff.startsWith("2026-08"), 1);
  pick((o, ps, ff) => ff.startsWith("2026-08") && ps.some((p) => p.kind === "back" && p.d.startsWith("2026-09")), 1);
  return out.map((o) => {
    const ps = byOrd.get(o)!; const oi = ordInfo.get(o) || {};
    const sum = (k: string, m?: string) => ps.filter((p) => (k === "fee" ? p.kind === "fee" && p.f !== "cofin" : p.kind === k) && (!m || p.d.startsWith(m))).reduce((s, p) => s + p.a, 0);
    return { order: o, sku: oi.sku, name: String(oi.name || "").slice(0, 60), created: oi.created, status: oi.status, firstFee: firstFee.get(o), ship: deliv.get(o)?.ship ?? null,
      rows: ps.filter((p) => p.kind !== "points").map((p) => ({ d: p.d, kind: p.kind, f: p.f || "", svc: p.svc.slice(0, 50), a: p.a })).sort((a, b) => (a.d < b.d ? -1 : 1)),
      pay: { "2026-07": sum("pay", "2026-07"), "2026-08": sum("pay", "2026-08"), "2026-09": sum("pay", "2026-09") }, fee: { "2026-08": sum("fee", "2026-08"), "2026-09": sum("fee", "2026-09") } };
  });
}

const per = [{ k: "Август", from: "2026-08-01", to: "2026-08-31" }, { k: `Сентябрь 01-${TO.slice(8)}`, from: "2026-09-01", to: TO }];
const res = per.map((p) => { const c1 = col1(p.from, p.to); const { T, B } = col2(p.from, p.to); return { ...p, c1, c2: T, bridge: B }; });
console.log(JSON.stringify({ to: TO, skipNotReady, res, ex: examples() }, null, 1));
