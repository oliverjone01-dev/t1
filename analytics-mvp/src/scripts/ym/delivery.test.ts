import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseDeliveryCsv, delivByOrder, classOf, withoutCancelled, resolveOrders, deliveryIssues } from "./delivery-lib.js";

// Ведомость доставки - ручной лист. Иван 18.09.2026: «это тоже наши расходы, которые до этого не
// учитывали» и «проверь чтобы не было задвоений и возможно по одному заказ возвраты, отмены,
// рекламации». Оба требования закреплены здесь числами.

const CSV = readFileSync("fixtures/delivery_ym.csv", "utf-8");
const ROWS = parseDeliveryCsv(CSV);

describe("ведомость доставки: разбор", () => {
  it("лист читается, площадка только Яндекс", () => {
    expect(ROWS.length).toBeGreaterThan(400);
    const bad = ROWS.filter((r) => !r.tags.startsWith("Яндекс"));
    expect(bad.map((r) => r.tags), "в выгрузку просочился OZON или WB").toEqual([]);
  });

  it("«FALSE» из формулы листа - это «нет данных», а не ноль", () => {
    const r = parseDeliveryCsv("order,ship,buyer\n123,FALSE,\n124,0,7\n");
    expect(r[0]!.ship, "FALSE превратился в число - расход стал нулём").toBeNull();
    expect(r[1]!.ship, "настоящий ноль потерялся").toBe(0);
    expect(r[1]!.buyer).toBe(7);
  });

  it("поле с запятой в кавычках не разваливает строку", () => {
    const r = parseDeliveryCsv('order,status,tags\n77,Доставлен,"Яндекс, ПЭК"\n');
    expect(r[0]!.tags).toBe("Яндекс, ПЭК");
    expect(r[0]!.status).toBe("Доставлен");
  });
});

describe("ведомость доставки: задвоение", () => {
  // Файл пришёл вставленным дважды: 3 585 строк при 1 752 уникальных, повторы стоят ровно в
  // 1 784 строках друг от друга. Заказ 58682682691 (ведомость М26-3273, 14 445,60 ₽) лежал в нём
  // четырьмя байт-в-байт одинаковыми строками. Дедуп делается при выгрузке в fixtures - здесь
  // проверяется, что в подключённом листе его следов не осталось.
  it("в подключённой выгрузке нет одинаковых строк", () => {
    const key = (r: any) => JSON.stringify(r);
    const seen = new Map<string, number>();
    for (const r of ROWS) seen.set(key(r), (seen.get(key(r)) || 0) + 1);
    const dup = [...seen].filter(([, n]) => n > 1);
    expect(dup.map(([k, n]) => `${n}× ${k.slice(0, 80)}`), "лист снова задвоен - расход удвоится").toEqual([]);
  });

  // Ведомость = документ на вывоз = один счёт перевозчика. В листе одна ведомость встречается
  // двумя строками с разным статусом: заказ 58884154242, ведомость М26-3383, 8 765 ₽ - «Доставлен»
  // и «Вернули на склад». Это одна отправка с обновлённым статусом, а не два вывоза.
  it("одна ведомость - одна оплата, даже если строк две с разным статусом", () => {
    const two = delivByOrder(parseDeliveryCsv(
      "order,vedomost,ship,status\nA,V1,8765,Доставлен\nA,V1,8765,Вернули на склад\n"));
    expect(two.get("A")!.ship, "сумма строк удвоила счёт перевозчика").toBe(8765);
    expect(two.get("A")!.cls, "возврат по отправке потерялся").toBe("lost");
  });

  it("разные ведомости одного заказа - разные вывозы, складываются", () => {
    const two = delivByOrder(parseDeliveryCsv(
      "order,vedomost,ship,status\nA,V1,100,Доставлен\nA,V2,40,Возврат\n"));
    expect(two.get("A")!.ship, "второй вывоз по заказу потерялся").toBe(140);
  });

  it("на живой ведомости сумма по заказам не расходится с суммой по документам", () => {
    const m = delivByOrder(ROWS);
    const byOrder = [...m.values()].reduce((a, x) => a + x.ship, 0);
    const docs = new Map<string, number>();
    for (const r of ROWS) if (r.ship != null) {
      const k = `${r.order}|${r.vedomost || "~" + r.shipped}`;
      docs.set(k, Math.max(docs.get(k) ?? 0, r.ship));
    }
    const byDoc = [...docs.values()].reduce((a, b) => a + b, 0);
    expect(Math.round(byOrder)).toBe(Math.round(byDoc));
    // Голая сумма строк - то, что получилось бы без схлопывания по ведомости.
    const raw = ROWS.reduce((a, r) => a + (r.ship || 0), 0);
    expect(Math.round(raw), "в листе нет повторов ведомости - тест перестал ловить задвоение").toBeGreaterThan(Math.round(byDoc));
  });
});

describe("ведомость доставки: статусы", () => {
  it("«Собственная доставка» - это выкуп, а не потеря", () => {
    expect(classOf("Доставлен")).toBe("sold");
    expect(classOf("Собственная доставка"), "везли своей машиной - заказ всё равно доставлен").toBe("sold");
  });

  it("отмена, возврат и обратная нога - потеря: деньги за перевозку не вернулись", () => {
    for (const st of ["ОТМЕНЕН", "Вернули на склад", "Возврат", "Возвращается ЛК"]) {
      expect(classOf(st), `${st} перестал считаться потерей`).toBe("lost");
    }
  });

  it("ещё не доехавшее - ни то, ни другое", () => {
    expect(classOf("В очереди")).toBe("inflight");
    expect(classOf("Создан")).toBe("inflight");
  });

  // Иван: «возможно по одному заказу возвраты, отмены, рекламации». Заказ, у которого хоть одна
  // отправка ушла в возврат, считается потерянным ЦЕЛИКОМ: выручки по нему в своде нет, а
  // перевозку оплатили и туда, и обратно.
  it("заказ с возвратом среди отправок считается потерянным целиком", () => {
    const m = delivByOrder(parseDeliveryCsv(
      "order,vedomost,ship,status\nA,V1,100,Доставлен\nA,V2,60,Вернули на склад\n"));
    expect(m.get("A")!.cls).toBe("lost");
    expect(m.get("A")!.ship).toBe(160);
  });

  it("строка без суммы не делает заказ «известным»", () => {
    const m = delivByOrder(parseDeliveryCsv("order,ship,status\nA,FALSE,Доставлен\n"));
    expect(m.get("A")!.known, "пустая строка выдана за «возили бесплатно»").toBe(false);
    expect(m.get("A")!.ship).toBe(0);
  });
});

// Катя 28.09.2026: «расход по заказам в статусе Отменен не учитывай, исключай его».
describe("ведомость: отменённые отправки и номера заказов с пояснением", () => {
  it("строка «ОТМЕНЕН» в расчёт не идёт, возврат остаётся", () => {
    const r = withoutCancelled(parseDeliveryCsv("order,status,ship\nA,ОТМЕНЕН,1000\nB,Вернули на склад,2000\nC,Доставлен,3000\n"));
    expect(r.map((x) => x.order)).toEqual(["B", "C"]);
  });
  it("из ячейки с двумя номерами берётся тот, что есть в выгрузке", () => {
    const r = resolveOrders(parseDeliveryCsv('order,ship\n"60811444291 60812411267 (новый номер)",3794.2\n59256208515/2,100\n'), new Set(["60812411267", "59256208515"]));
    expect(r.map((x) => x.order)).toEqual(["60812411267", "59256208515"]);
  });
  it("из двух известных номеров берётся доставленный, а не отменённый", () => {
    const r = resolveOrders(parseDeliveryCsv('order,ship\n"58695099523 59213615811 (новый номер, старый был отменён)",2947.52\n'),
      new Set(["58695099523", "59213615811"]), new Set(["59213615811"]));
    expect(r[0]!.order).toBe("59213615811");
  });
});

// Катя 29.09.2026: суммы, записанные текстом, не должны молча становиться «нет данных»; сдвиг
// столбцов учитывается; спорные строки видны на плашке. Разбор xlsx - в
// tools/delivery/build_delivery_ym_csv.py, здесь - контракт CSV, который читает сборка.
describe("ведомость доставки: правила 29.09.2026", () => {
  it("не число в сумме - сборка падает с номером строки, а не читает как пусто", () => {
    expect(() => parseDeliveryCsv("order,ship\n1,100\n2,3 932 руб\n")).toThrow(/строка 3/);
    expect(parseDeliveryCsv("order,ship\n1,TRUE\n")[0]!.ship).toBeNull();
  });

  it("в CSV нет ни одной суммы, которую не прочитали (все заполненные ship - числа)", () => {
    const filled = ROWS.filter((r) => r.ship != null);
    expect(filled.length).toBeGreaterThan(500);
    expect(filled.filter((r) => !Number.isFinite(r.ship!))).toEqual([]);
  });

  it("сентябрьская вставка с переставленными столбцами: собственная доставка стоит 1 000 ₽, а не оплату клиента", () => {
    // Заказ 61851500611: в листе «3 500,00 ₽» (оплата клиента, совпадает с Маркетом) и «1 000,00 ₽» (наш расход).
    const r = ROWS.find((x) => x.order === "61851500611")!;
    expect(r.ship, "в расход попала оплата клиента").toBe(1000);
    expect(r.buyer).toBe(3500);
  });

  it("строка с переносом перед суммой («\\n3 932,06») прочитана", () => {
    expect(ROWS.find((x) => x.order === "59784959874")!.ship).toBe(3932.06);
  });

  it("спорные строки попадают на плашку, поправленные - нет", () => {
    const rows = parseDeliveryCsv('order,shipped,status,ship,note\nA,1 мая,Доставлен,500,"FALSE в «Стоимости отправки», расход взят из соседнего столбца"\nB,2 мая,Доставлен,,\nC,3 мая,Доставлен,700,\nD,4 мая,Доставлен,,\n');
    const is = deliveryIssues(rows, new Set(["A", "B", "C"]));
    expect(is.map((x) => x.order).sort(), "D не доставлен по Маркету - не спорный, C с суммой - не спорный").toEqual(["A", "B"]);
    expect(is.find((x) => x.order === "B")!.ship).toBeNull();
  });
});
