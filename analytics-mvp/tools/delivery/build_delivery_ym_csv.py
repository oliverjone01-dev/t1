#!/usr/bin/env python3
# Ведомость доставки (ручной лист Кати) -> fixtures/delivery_ym.csv для Яндекс Маркета.
#
# Лист собирается руками из нескольких источников, и раскладка столбцов в нём НЕ одна:
#   - основная часть: «Стоимость отправки» (наш расход) | «Стоимость доставки» («3500\n-»,
#     сколько заплатил покупатель);
#   - сентябрьская вставка: столбцы переставлены - сначала «Оплата от клиента», потом «Стоимость
#     доставки» (наш счёт). В листе 29.09.2026 это строки 1795-2042, заголовок вставки повторён
#     в строке 1877. Проверено по Маркету: первый столбец совпадает с оплатой доставки
#     покупателем из заказа в 47 из 49 заказов, то есть это оплата клиента, а не наш расход;
#   - строки со сдвигом на два столбца: «4500\n-» стоит в «Стоимости отправки», наш расход - в
#     «С/С (для рекламаций)» (строки 1785-1794).
# Раскладка определяется по самой строке (где стоит «N\n±», где «₽», где флажок FALSE/TRUE);
# строка без признаков берёт раскладку предыдущей.
#
# Суммы читаются из текста: неразрывные пробелы, «₽», перенос строки до или после числа
# («\n3 932,06» раньше читалось как пусто, расход терялся). Две суммы в ячейке складываются
# (две отправки одного заказа), «1871х2» умножается. FALSE в ячейке расхода при числе в соседнем
# столбце: число берётся как наш расход, строка помечается. Ячейку, которую нельзя разобрать,
# конвертер не пропускает: падает с номером строки.
#
# Запуск из analytics-mvp:  python3 tools/delivery/build_delivery_ym_csv.py <ведомость.xlsx> [лист]
import csv, re, sys, collections
import openpyxl

OUT = "fixtures/delivery_ym.csv"
BUYER_FMT = re.compile(r"^\s*\d[\d\s .,]*\n\s*[-+]\s*$")   # «3500\n-» - оплата покупателя
FLAGS = {"FALSE", "TRUE"}


class Unparsed(Exception):
    pass


def s(x):
    if x is None:
        return ""
    if isinstance(x, float) and x.is_integer():
        x = int(x)
    return re.sub(r"\s+", " ", str(x).replace("\r", "")).strip()


def kind(x):
    if x is None or (isinstance(x, str) and not x.strip()):
        return "empty"
    if isinstance(x, bool):
        return "flag"
    if isinstance(x, (int, float)):
        return "num"
    t = str(x).strip()
    if t.upper() in FLAGS:
        return "flag"
    if BUYER_FMT.match(str(x)):
        return "buyer"
    if "₽" in t:
        return "rub"
    return "text"


def money(x):
    """Сумма ячейки или None (пусто/FALSE). Неразборчивая ячейка - исключение."""
    k = kind(x)
    if k in ("empty", "flag"):
        return None
    if k == "num":
        return float(x)
    t = str(x).replace(" ", " ").replace("₽", "").replace("\r", "")
    total, seen = 0.0, False
    for line in t.split("\n"):
        line = line.strip()
        if not line or line in ("-", "+"):
            continue
        m = re.fullmatch(r"(\d[\d ]*(?:[.,]\d+)?)\s*(?:[хx×*]\s*(\d+))?", line, flags=re.I)
        if not m:
            raise Unparsed(repr(x))
        v = float(m.group(1).replace(" ", "").replace(",", "."))
        total += v * (int(m.group(2)) if m.group(2) else 1)
        seen = True
    if not seen:
        raise Unparsed(repr(x))
    return total


def layout_of(r, prev):
    """Раскладка строки: (раскладка, столбец нашего расхода, столбец оплаты клиента, пометка)."""
    c13, c14, c15 = kind(r[13]), kind(r[14]), kind(r[15])
    if c13 == "buyer" and c15 == "num":           # «4500\n-» | - | расход в «С/С»
        return "shift2", 15, 13, "расход стоит в столбце «С/С», строка сдвинута на два столбца"
    if c15 == "buyer":                            # FALSE | расход | «4500\n-»
        return "shift1", 14, 15, "FALSE в «Стоимости отправки», расход взят из соседнего столбца"
    if c15 == "flag" or "rub" in (c13, c14):
        return "swapped", 14, 13, ""
    if c14 == "buyer":
        return "main", 13, 14, ""
    # Без признаков: раскладка предыдущей строки (сдвиги - свойство одной строки, не наследуются).
    if prev == "swapped":
        return "swapped", 14, 13, ""
    if c13 == "flag" and c14 == "num":            # FALSE | число: число - наш расход
        return "main", 14, None, "FALSE в «Стоимости отправки», расход взят из соседнего столбца"
    return "main", 13, 14, ""


def fmt(v):
    return "" if v is None else ("%.2f" % v).rstrip("0").rstrip(".")


def main(path, sheet):
    ws = openpyxl.load_workbook(path, data_only=True)[sheet]
    rows = list(ws.iter_rows(values_only=True))
    out, seen, errors = [], set(), []
    layout = "main"
    stat = collections.Counter()
    for i, r in enumerate(rows[1:], 2):
        r = list(r) + [None] * (16 - len(r))
        if s(r[0]) == "Площадка":          # повтор заголовка внутри листа (сентябрьская вставка)
            layout = "swapped"
            continue
        layout, si, bi, note = layout_of(r, layout)
        if not (r[0] and str(r[0]).startswith("Яндекс")):
            continue
        order = s(r[1])
        if not order:
            continue
        try:
            ship = money(r[si])
            buyer = money(r[bi]) if bi is not None else None
            # Ни одна заполненная ячейка денег не должна пропасть молча. В основной раскладке
            # 16-й столбец - «С/С (для рекламаций)», к доставке он не относится.
            for c in ((13, 14) if layout == "main" else (13, 14, 15)):
                if c not in (si, bi) and kind(r[c]) not in ("empty", "flag"):
                    raise Unparsed(f"{r[c]!r} (столбец {c + 1}) не попала ни в расход, ни в оплату клиента")
        except Unparsed as e:
            errors.append(f"строка {i}, заказ {order}: не разобрана сумма {e}")
            continue
        status = s(r[8])
        rec = (order, s(r[2]), s(r[3]), s(r[4]), status, fmt(ship), fmt(buyer), s(r[0]), note)
        if rec in seen:
            stat["повтор строки"] += 1
            continue
        seen.add(rec)
        out.append(rec)
        stat[layout] += 1
    if errors:
        sys.exit("ведомость не разобрана:\n  " + "\n  ".join(errors))
    with open(OUT, "w", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["order", "vedomost", "offer", "shipped", "status", "ship", "buyer", "tags", "note"])
        w.writerows(out)
    csv_sum = sum(float(x[5]) for x in out if x[5])
    print(f"записано {len(out)} строк Маркета, раскладки: {dict(stat)}")
    print(f"наш расход в CSV: {csv_sum:,.2f} ₽ ({sum(1 for x in out if x[5])} строк с суммой, "
          f"{sum(1 for x in out if not x[5])} без суммы)".replace(",", " "))
    print(f"помеченных строк: {sum(1 for x in out if x[8])}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__ or "укажите путь к xlsx")
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "Лист2")
