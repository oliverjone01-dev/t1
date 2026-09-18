// Ведомость доставки (ручной лист Кати «Стоимость отправки»): НАШ расход на перевозку заказа.
// Маркет в своих сборах показывает только собственный сбор за логистику, счёт перевозчика
// (ПЭК/СДЭК/своя машина) в дашборд не попадал вовсе - прибыль была завышена ровно на него.
//
// Иван 18.09.2026: «это тоже наши расходы, которые до этого не учитывали».
//
// ЛИСТ ПРИХОДИТ ЗАДВОЕННЫМ. В выгрузке 3 585 строк, из них 1 752 уникальных: регистр вставлен в
// файл дважды (517 пар повторов стоят ровно в 1 784 строках друг от друга - это копипаст, а не
// вторая отправка). Пример: заказ 58682682691, ведомость М26-3273, артикул GGT-03-3-5-O-18090,
// 14 445,60 ₽ - четыре байт-в-байт одинаковые строки. Одна ведомость = один вывоз = одна оплата
// перевозчику, поэтому ключ дедупа - ВСЯ строка целиком. Сумма без дедупа завышена вдвое.
// Повторы, стоящие рядом (17 штук), дедуп тоже схлопывает: они отличаются от копипаста только
// расстоянием, а по содержанию это та же ведомость, та же сумма, тот же артикул.

export type DelivRow = {
  order: string; vedomost: string; offer: string; shipped: string;
  status: string; ship: number | null; buyer: number | null; tags: string;
};

// Статусы листа. «Собственная доставка» - тоже выкуп: везли своей машиной, заказ доставлен.
const SOLD = new Set(["Доставлен", "Собственная доставка"]);
// Заказ не доехал или уехал обратно. Перевозку мы всё равно оплатили, и часто дважды (обратная нога).
const LOST = new Set(["ОТМЕНЕН", "Вернули на склад", "Возврат", "Возвращается ЛК"]);

export type DelivClass = "sold" | "lost" | "inflight";
export const classOf = (status: string): DelivClass =>
  SOLD.has(status) ? "sold" : LOST.has(status) ? "lost" : "inflight";

const numOf = (x: unknown): number | null => {
  const s = String(x ?? "").trim().split("\n")[0]!.replace(/ /g, "").replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;   // «FALSE» из формулы листа - это «нет данных», а не ноль
};

// Разбор CSV. Формат простой (кавычки только вокруг поля с запятой), поэтому свой парсер:
// тянуть зависимость ради восьми колонок незачем.
export function parseDeliveryCsv(text: string): DelivRow[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const head = splitCsv(lines[0]!);
  const ix = (n: string) => head.indexOf(n);
  const out: DelivRow[] = [];
  const at = (c: string[], n: string): string => { const i = ix(n); return i < 0 ? "" : (c[i] || "").trim(); };
  for (const l of lines.slice(1)) {
    const c = splitCsv(l);
    const order = at(c, "order");
    if (!order) continue;
    out.push({
      order, vedomost: at(c, "vedomost"), offer: at(c, "offer"), shipped: at(c, "shipped"),
      status: at(c, "status"), ship: numOf(at(c, "ship")), buyer: numOf(at(c, "buyer")), tags: at(c, "tags"),
    });
  }
  return out;
}

function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export type DelivByOrder = {
  ship: number; buyer: number | null; cls: DelivClass; rows: number; known: boolean;
};

// Свод расхода по НОМЕРУ ЗАКАЗА.
// Класс заказа берётся самый «тяжёлый»: если хоть одна отправка ушла в отмену или возврат, заказ
// считается потерянным целиком - деньги за перевозку не вернулись.
export function delivByOrder(rows: DelivRow[]): Map<string, DelivByOrder> {
  // Стоимость берётся ОДИН РАЗ НА ВЕДОМОСТЬ, а не суммой строк. Ведомость - это документ на вывоз,
  // по нему выставляется один счёт перевозчика. В листе одна ведомость может стоять двумя строками
  // с разным статусом: заказ 58884154242, ведомость М26-3383, 8 765 ₽ - строки «Доставлен» и
  // «Вернули на склад». Это не два вывоза, а одна отправка, у которой обновили статус; сумма строк
  // удвоила бы счёт. Разные ведомости одного заказа (довоз, обратная нога после рекламации)
  // складываются - это разные документы и разные счета.
  // Строки без номера ведомости группируются по дате отгрузки: другого различителя у них нет.
  const perDoc = new Map<string, { ship: number | null; buyer: number | null; cls: DelivClass; order: string }>();
  for (const r of rows) {
    const doc = `${r.order}|${r.vedomost || "~" + r.shipped}`;
    const cur = perDoc.get(doc) || { ship: null, buyer: null, cls: "inflight" as DelivClass, order: r.order };
    if (r.ship != null) cur.ship = Math.max(cur.ship ?? 0, r.ship);
    if (r.buyer != null) cur.buyer = Math.max(cur.buyer ?? 0, r.buyer);
    const c = classOf(r.status);
    cur.cls = cur.cls === "lost" || c === "lost" ? "lost" : c === "sold" || cur.cls === "sold" ? "sold" : "inflight";
    perDoc.set(doc, cur);
  }
  const m = new Map<string, DelivByOrder>();
  for (const d of perDoc.values()) {
    const cur = m.get(d.order) || { ship: 0, buyer: null, cls: "inflight" as DelivClass, rows: 0, known: false };
    if (d.ship != null) { cur.ship += d.ship; cur.known = true; }
    if (d.buyer != null) cur.buyer = (cur.buyer || 0) + d.buyer;
    cur.cls = cur.cls === "lost" || d.cls === "lost" ? "lost" : d.cls === "sold" || cur.cls === "sold" ? "sold" : "inflight";
    cur.rows++;
    m.set(d.order, cur);
  }
  return m;
}
