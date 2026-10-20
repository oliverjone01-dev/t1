// Юнит-экономика рекламы (блок «Юнит-экономика рекламы» на «Маркетинге»): ставка сборов OZON по SKU
// ЗА ВЫБРАННЫЙ ПЕРИОД (Иван 20.10: «бери ... комиссии только за выбранный период - остальное не проставляй»).
//
// Источник - ряд pnl_sku_accrual_daily (accrual-API: только доставленные заказы, выручка и сборы по дате
// заказа). Старый pnl_sku_30d.json замёрз на 07.09: OZON отключил /v3/finance/transaction/list.
// Ставка SKU = (начислено − к выплате) / начислено за дни периода. Нет начислений по SKU в периоде -
// ставки нет (никаких подстановок окна или категории). Эквайринг и хранение в SKU-ряд не приходят (они
// уровня кабинета): к ставке добавляем разницу ставок канального ряда (pnl_channel_accrual_daily, все
// сборы) и SKU-ряда за тот же период (Иван 20.10, 1б); если начислено в рядах расходится больше 1% или
// канала за период нет - надбавки нет, причина возвращается в warn и выводится на странице.
//
// Строки «доставлен, выручка есть, комиссия 0» исключаются из ставки и из надбавки (их начислено и сборы
// вычитаются и из канала - одна популяция): они занижали ставку ~1 п.п. (ФЕНИКС iter1 gap 2, Иван 20.10: «исключать»).
// Надбавка только для периода, который закончился не позже matureTo (сегодня − UE_MATURE_DAYS): на свежих днях
// эквайринг/хранение уже списаны (по дате начисления), а заказы ещё не доставлены - надбавка раздувалась до 11 п.п.
// (ФЕНИКС iter2 B2).
//
// Функция - строка JS: её же выполняет страница (вставляется в <script>) и тест (new Function), чтобы
// логика жила в одном месте.
//   rows: [[дата, sku, начислено, к выплате, комиссия], ...], ch: [[дата, начислено, сборы(<0)], ...],
//   from/to/matureTo: YYYY-MM-DD -> {by: {sku: {com, accr, days}}, topUp, warn: [..], excluded}
// ueWhy - почему строку кампании нельзя посчитать (null - считаем): без выручки - весь расход в минус и «резать».
export const UE_MATURE_DAYS = 14;
export const UE_STALE_DAYS = 7;   // ряд начислений старше - сборщик, а не недоставка (обычный лаг 3-5 дней)
export const AD_ECON_JS = `function adEconPeriod(rows, ch, from, to, matureTo){
  var by = {}, A = 0, M = 0, XA = 0, XM = 0, nx = 0, warn = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]; if (!r || r[0] < from || r[0] > to) continue;
    var a = +r[2] || 0, m = +r[3] || 0;
    if (a > 0 && +r[4] === 0) { XA += a; XM += m; nx++; continue; }
    var s = by[r[1]] || (by[r[1]] = { accr: 0, amt: 0, days: 0 });
    s.accr += a; s.amt += m; if (a > 0) s.days++; A += a; M += m;
  }
  var CA = -XA, CF = XA - XM;   // сборы исключённых (к выплате − начислено, <0) уже в канале - снимаем их
  for (var j = 0; j < ch.length; j++) { var c = ch[j]; if (!c || c[0] < from || c[0] > to) continue; CA += +c[1] || 0; CF += +c[2] || 0; }
  var topUp = null;
  if (!(A > 0)) warn.push('начислений за период нет: заказы ещё не доставлены');
  else if (matureTo && to > matureTo) warn.push('период захватывает последние ${UE_MATURE_DAYS} дней - эквайринг и хранение не добавлены: OZON списывает их раньше, чем доставляются заказы');
  else if (!(CA > 0)) warn.push('канального ряда за период нет - ставка без эквайринга и хранения');
  else if (Math.abs(CA - A) / A > 0.01) warn.push('начислено в канале и по товарам расходится больше 1% - ставка без эквайринга и хранения');
  else { var t = (-CF / CA) * 100 - ((A - M) / A) * 100; if (t < 0) warn.push('надбавка за эквайринг и хранение отрицательная - взят 0'); topUp = Math.round(Math.max(0, t) * 10) / 10; }
  var out = {};
  for (var k in by) { var b = by[k]; if (!(b.accr > 0)) continue;
    out[k] = { com: Math.round(((b.accr - b.amt) / b.accr * 100 + (topUp || 0)) * 10) / 10, accr: Math.round(b.accr), days: b.days }; }
  return { by: out, topUp: topUp, warn: warn, excluded: nx };
}
function ueWhy(om, ord, com, cogsRub, staleSince){
  if (!(om > 0)) return 'выручки за период нет';
  if (!(ord > 0)) return 'заказов за период нет';
  if (com == null) return staleSince ? 'ряд начислений не обновлялся с ' + staleSince : 'нет начислений по SKU за период (заказы ещё не доставлены)';
  if (cogsRub == null) return 'нет себестоимости';
  return null;
}`;

export type AdEconOut = { by: Record<string, { com: number; accr: number; days: number }>; topUp: number | null; warn: string[]; excluded: number };
export type AdEconFn = (rows: unknown[][], ch: unknown[][], from: string, to: string, matureTo?: string) => AdEconOut;
const __fns = new Function(AD_ECON_JS + "\nreturn [adEconPeriod, ueWhy];")();
export const adEconPeriod: AdEconFn = __fns[0];
export const ueWhy: (om: number, ord: number, com: number | null | undefined, cogsRub: number | null | undefined, staleSince?: string | null) => string | null = __fns[1];

// Строки ndjson -> компактные массивы для страницы. Строка, которая не объект или без даты/SKU, - битая:
// пропускаем и считаем (решение 14.10: сломанные данные не роняют сайт, а видны на странице).
export function packAccrual(skuObjs: unknown[], chObjs: unknown[]): { rows: unknown[][]; ch: unknown[][]; bad: number; last: string | null } {
  let bad = 0;
  const ok = (r: any) => r && typeof r === "object" && typeof r.d === "string";
  const rows: unknown[][] = [], ch: unknown[][] = [];
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  for (const r of skuObjs as any[]) { if (!ok(r) || r.sku == null || !num(r.accruals) || !num(r.amount) || !num(r.commission)) { bad++; continue; } rows.push([r.d, String(r.sku), r.accruals, r.amount, r.commission]); }
  for (const r of chObjs as any[]) { if (!ok(r) || !num(r.accruals) || !num(r.fees)) { bad++; continue; } ch.push([r.d, r.accruals, r.fees]); }
  let last: string | null = null; // последний день с начислениями по SKU: по нему страница видит умерший сборщик
  for (const r of rows) if ((r[2] as number) > 0 && (last == null || (r[0] as string) > last)) last = r[0] as string;
  return { rows, ch, bad, last };
}
