// Сопоставление строк ведомости доставки с отправлениями OZON ПО НОМЕРУ ЗАКАЗА.
//
// ПРАВИЛО (Иван 28.09.2026, knowledge/semantic/rule-find-order-no-spread.md): расход по заказу
// ищется по номеру этого заказа и встаёт на его дату заказа. Не нашёлся - НЕ раскладывается по
// другим заказам, артикулу или месяцу, а выводится списком над таблицей, как нехватка СС.
//
// Раньше (22.09-28.09) несошедшийся остаток ведомости раскладывался по заказам артикула, и доставка
// одного заказа попадала в чужой месяц второй раз (46952822-0108-1: 3 559 ₽ при 2 948 ₽ в ведомости).
//
// Как номер записан в ведомости руками и как он читается:
//   «46952822-0108-1»                              - номер отправления, точное совпадение;
//   «0198044483-0090»                              - номер заказа без хвоста отправления: все
//                                                   отправления этого заказа;
//   «46027676-0255-1 46027676-0255-3»              - два отправления в одной строке;
//   «39351709-0446-1 бывш. 39351709-0445-1»       - заказ переоформлен: действует номер ДО «бывш.»,
//                                                   старый (отменённый) берём, только если нового нет.
// Если номер указал несколько отправлений, сумма делится по штукам (остаток - на последнее), а
// отменённые отбрасываются, когда есть неотменённые. Числа не придумываются: делится только сумма
// одной строки ведомости между отправлениями, которые эта строка сама назвала.

export interface LedgerRow { order: string; ship: number; deliv: number }
export interface Posting { order: string; d: string; status?: string; units?: number }
export interface Unmatched { raw: string; ship: number; deliv: number; why: string }
export interface MatchResult {
  byPosting: Map<string, { ship: number; deliv: number }>;
  unmatched: Unmatched[];
  /** Как нашлась каждая строка: exact / base / multi / renamed. Для сверки и тестов. */
  how: Map<string, string>;
}

const TOKEN = /\d{6,10}-\d{3,4}(?:-\d{1,2})?/g;
const base = (o: string) => o.split("-").slice(0, 2).join("-");

export function matchLedger(rows: LedgerRow[], postings: Posting[]): MatchResult {
  const byOrder = new Map<string, Posting>();
  const byBase = new Map<string, Posting[]>();
  for (const p of postings) {
    byOrder.set(p.order, p);
    const b = base(p.order);
    (byBase.get(b) ?? byBase.set(b, []).get(b)!).push(p);
  }
  const resolve = (tok: string): Posting[] => {
    const p = byOrder.get(tok);
    if (p) return [p];
    if (tok.split("-").length === 2) return byBase.get(tok) ?? [];
    return [];
  };
  const byPosting = new Map<string, { ship: number; deliv: number }>();
  const unmatched: Unmatched[] = [];
  const how = new Map<string, string>();
  for (const r of rows) {
    const raw = String(r.order || "").trim();
    const ship = Number(r.ship) || 0, deliv = Number(r.deliv) || 0;
    const exact = byOrder.get(raw);
    let found: Posting[] = [];
    let kind = "";
    if (exact) { found = [exact]; kind = "exact"; }
    else {
      const renamed = /бывш/i.test(raw);
      const [cur, old] = renamed ? raw.split(/бывш\.?/i) : [raw, ""];
      const toks = (s: string) => [...new Set(s.match(TOKEN) ?? [])];
      for (const t of toks(cur!)) found.push(...resolve(t));
      if (!found.length && old) for (const t of toks(old)) found.push(...resolve(t));
      found = [...new Map(found.map((p) => [p.order, p])).values()];
      const live = found.filter((p) => p.status !== "cancelled");
      if (live.length) found = live;
      kind = renamed ? "renamed" : found.length > 1 ? "multi" : "base";
    }
    if (!found.length) {
      if (ship || deliv) unmatched.push({ raw, ship, deliv, why: (raw.match(TOKEN) ?? []).length ? "номера нет в выгрузке заказов OZON" : "в ячейке нет номера заказа" });
      continue;
    }
    how.set(raw, kind);
    const w = found.map((p) => Math.max(0, Number(p.units) || 0));
    const ws = w.reduce((a, b) => a + b, 0);
    let accS = 0, accD = 0;
    found.forEach((p, i) => {
      const last = i === found.length - 1;
      const k = ws > 0 ? w[i]! / ws : 1 / found.length;
      const s = last ? Math.round((ship - accS) * 100) / 100 : Math.round(ship * k * 100) / 100;
      const d = last ? Math.round((deliv - accD) * 100) / 100 : Math.round(deliv * k * 100) / 100;
      accS += s; accD += d;
      const cur = byPosting.get(p.order) ?? { ship: 0, deliv: 0 };
      byPosting.set(p.order, { ship: cur.ship + s, deliv: cur.deliv + d });
    });
  }
  return { byPosting, unmatched, how };
}
