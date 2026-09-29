#!/usr/bin/env python3
# Чтение денежных ячеек ведомости доставки. Общий модуль для build_delivery_sku_daily.py и
# tools/orders/build_order_joins.py (ФЕНИКС 29.09, п.1: прежний num() молча превращал в 0 суммы,
# записанные текстом, и 17 отправок на 82 406 ₽ выпали из расхода).
#
# Правило: сумма читается при любом написании, а что прочитать нельзя - НЕ ноль, а ошибка сборки с
# номером строки. Пустая ячейка и явные маркеры пустоты («FALSE», «-») - это «суммы нет», и такие
# строки перечисляются отдельно, чтобы страница о них сказала.
import re

EMPTY = {"", "false", "true", "ложь", "-", "—", "none", "nan"}
_SPACES = re.compile(r"[\s    ]+")
_NUM = r"\d+(?:[.,]\d+)?"


class MoneyError(ValueError):
    pass


_CUR = re.compile(r"(₽|руб\.?|р\.)$", re.I)                       # «8 849,00 ₽» (выгрузка 29.09)


def _one(tok):
    t = _CUR.sub("", _SPACES.sub("", tok))
    if "+" in t.rstrip("+-"):                                   # «3647+3132» - две суммы в ячейке
        return sum(_one(x) for x in t.rstrip("+-").split("+"))
    m = re.fullmatch(rf"({_NUM})[хxXХ*×]({_NUM})", t)          # «1871х2» = 1871 × 2
    if m:
        return float(m.group(1).replace(",", ".")) * float(m.group(2).replace(",", "."))
    t = t.rstrip("+-")                                          # «7450\n+» в столбце доставки
    if re.fullmatch(_NUM, t):
        return float(t.replace(",", "."))
    raise MoneyError(tok)


def parse_money(x):
    """-> (сумма | None, пометка). None - суммы нет (пусто, FALSE, «-»).
    Несколько строк в ячейке - несколько отправок одного заказа: складываются (решение 29.09).
    Непонятный текст - MoneyError, а не 0."""
    if x is None or isinstance(x, bool):
        return None, "пусто"
    if isinstance(x, (int, float)):
        return float(x), ""
    s = str(x)
    if s.strip().lower() in EMPTY:
        return None, s.strip() or "пусто"
    lines = [ln for ln in s.split("\n") if _SPACES.sub("", ln).strip("+-")]
    if not lines:
        return None, "пусто"
    vals = [_one(ln) for ln in lines]
    note = "несколько сумм" if len(vals) > 1 else ("текст" if s != str(vals[0]) else "")
    return sum(vals), note


def ship_and_deliv(ship_cell, deliv_cell):
    """Стоимость отправки (наш расход) и доставки (платит покупатель) из одной строки.
    Сдвиг столбцов (сентябрь 2026): в «отправке» FALSE, а расход уехал в «доставку». Тогда берём
    его как расход, а доход покупателя по строке неизвестен. -> (ship|None, deliv|None, флаг)."""
    ship, _ = parse_money(ship_cell)
    try:
        deliv, _ = parse_money(deliv_cell)
    except MoneyError:
        deliv = None                                            # доход - справочный, сборку не роняет
    # TRUE вместо FALSE: та же строка, сдвинутая на столбец (выгрузка 29.09, 55712580-0145-1).
    if ship is None and str(ship_cell or "").strip().lower() in ("false", "true") and deliv:
        return deliv, None, "сдвиг"
    return ship, deliv, ""


def _flag(x):
    return isinstance(x, bool) or str(x or "").strip().lower() in ("false", "true")


def client_paid(ship_cell, deliv_cell, right_cell):
    """Оплата доставки клиентом - для сверки с OZON (в расход не идёт). Столбцы местами поехали,
    берём ближайший (Иван 29.09): FALSE/TRUE в «отправке» - строка сдвинута вправо, оплата клиента
    в соседнем правом столбце (80885520-0398-1: 6 900 = OZON); FALSE/TRUE справа от «доставки» -
    вторая таблица, где оплата клиента стоит слева, в «отправке» (38472524-0611-1: 5 599 = OZON).
    -> сумма | None."""
    def v(x):
        try:
            return parse_money(x)[0]
        except MoneyError:
            return None
    if _flag(ship_cell):
        return v(right_cell)
    if _flag(right_cell):
        return v(ship_cell)
    return v(deliv_cell)


def second_header(row, col):
    """Строка-шапка посреди листа («Площадка» в столбце площадки): ниже идёт другая таблица со своими
    названиями столбцов (выгрузка 29.09: «Оплата от клиента» на месте «Стоимости отправки»). Читать её
    по шапке первой таблицы нельзя - сборщики останавливаются и называют её (решение по ней - Ивана)."""
    return str(row[col] or "").strip() == "Площадка"


if __name__ == "__main__":
    cases = {
        "3 484,00": 3484.0, "11 823 ": 11823.0, "4 884,92 \n": 4884.92,
        "\n8 643,70": 8643.7, "4 373,70 \n2 223,52": 6597.22, "1871х2": 3742.0,
        "2910.00\n": 2910.0, "6512.50": 6512.5, 5000: 5000.0, "7450\n+": 7450.0,
        "8\u00a0849,00 ₽": 8849.0, "12\u00a0800,00 ₽": 12800.0, "3647+3132": 6779.0,
    }
    for c, want in cases.items():
        got, _ = parse_money(c)
        assert abs(got - want) < 0.005, (c, got, want)
    for c in [None, "", "FALSE", "-"]:
        assert parse_money(c)[0] is None, c
    try:
        parse_money("около 3 тыс")
        raise SystemExit("непонятный текст должен падать")
    except MoneyError:
        pass
    assert ship_and_deliv("FALSE", 7201.88) == (7201.88, None, "сдвиг")
    assert ship_and_deliv("FALSE", None) == (None, None, "")
    assert ship_and_deliv("TRUE", 6227.47) == (6227.47, None, "сдвиг")
    assert ship_and_deliv(2947.52, 2399) == (2947.52, 2399.0, "")
    assert client_paid("FALSE", 7201.88, "6900\n-") == 6900.0
    assert client_paid(5599, 5276.5, "FALSE") == 5599.0
    assert client_paid(4176, "3400\n-", 2900) == 3400.0
    assert client_paid("TRUE", 6227.47, "FALSE") is None
    print("ledger_money: все проверки прошли")
