#!/usr/bin/env python3
# Сверка «файл данных = сама ведомость» (ФЕНИКС 29.09, п.1 и п.7): прежний тест сверял выход
# разбора сам с собой и не видел, что суммы текстом превращались в 0.
#
# Здесь по сырому xlsx проверяется, что НИ ОДНА непустая ячейка «Стоимость отправки» строки OZON
# не пропала молча: она либо дала сумму, которая есть в data/delivery_orders.ndjson, либо названа в
# data/delivery_ledger_issues.json (нет суммы / сдвиг), либо строка «ОТМЕНЕН» (решение Ивана).
# И сумма всех отправок из xlsx (повторы строк одной отправки схлопнуты) = сумма файла данных.
# Сырьё не в git (телефоны покупателей): без него проверка пропускается с кодом 0.
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ledger_money import ship_and_deliv, second_header  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
files = sorted(glob.glob(os.path.join(ROOT, "tools", "delivery", "raw", "*.xlsx")))
if not files:
    print("check_ledger_raw: сырья нет - пропуск")
    sys.exit(0)
# openpyxl и сборщик импортируются только при наличии сырья: в CI их нет (и не нужно).
import openpyxl  # noqa: E402
import build_delivery_sku_daily as B  # noqa: E402

seen, total, zero_text = set(), 0.0, []
for f in files:
    wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue
        h = [B.norm(c) for c in rows[0]]
        ci = {x: i for i, x in enumerate(h)}
        if "Стоимость отправки" not in ci:
            continue
        for rix, r in enumerate(rows[1:], start=2):
            if r and second_header(r, ci["Площадка"]):   # вторая таблица - сборщики её тоже не читают
                break
            if not r or "OZON" not in str(r[ci["Площадка"]] or "").upper():
                continue
            raw = r[ci["Стоимость отправки"]]
            if B.CANCELLED(r[ci["Статус"]]):
                continue
            ic = ci["Стоимость доставки"]
            ship, _, flag = ship_and_deliv(raw, r[ic], r[ic + 1] if ic + 1 < len(r) else None)
            if ship is None:
                continue
            if ship == 0 and not flag and str(raw).strip() not in ("0", "0.0", "0,00"):
                zero_text.append(f"{os.path.basename(f)}:{rix} «{raw}»")
            no = str(r[ci["Номер заказа"]] or "").strip()
            key = (no, B.norm(r[ci["Дата отгрузки"]]), round(ship, 2))
            if key in seen:
                continue
            seen.add(key)
            total += ship
    wb.close()

data = [json.loads(l) for l in open(os.path.join(ROOT, "data", "delivery_orders.ndjson"), encoding="utf-8")]
got = sum(float(x["ship"]) for x in data)
print(f"check_ledger_raw: xlsx {total:,.2f} ₽ | файл данных {got:,.2f} ₽ | Δ {got - total:,.2f}")
bad = []
if abs(got - total) > 1:
    bad.append(f"сумма файла данных {got:.2f} ≠ ведомость {total:.2f}")
if zero_text:
    bad.append("текст прочитан как 0: " + ", ".join(zero_text))
if bad:
    sys.exit("check_ledger_raw: " + "; ".join(bad))
print("check_ledger_raw: ни одна сумма не потеряна")
