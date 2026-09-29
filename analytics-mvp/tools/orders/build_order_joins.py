#!/usr/bin/env python3
# Per-order досбор для блока «Аналитика по заказам»: реклама (CPO) и доставка (ведомость) ПО НОМЕРУ
# ЗАКАЗА, чтобы сесть на orders_daily (backbone OZON) в build-katya.
#
# Выход:
#   data/cpo_orders.ndjson       - {order, sp}     реклама «за заказ» по номеру заказа (base, без -N)
#   data/delivery_orders.ndjson  - {order, ship, deliv}  наша/клиентская доставка по номеру постинга
#
# Реклама (ads) в OZON accrual/postings по заказу = 0 (CPO API не отдаёт), поэтому берём из CPO-файлов.
# Доставка (наша+клиентская) в OZON по заказу разрежена - берём из ведомости, как в таблице по артикулам.
# Запуск из analytics-mvp: python3 tools/orders/build_order_joins.py
#
# Номер заказа пишется в delivery_orders.ndjson как есть в ведомости («бывш.», без хвоста, два номера в
# строке). К отправлениям OZON его сводит src/scripts/delivery-match.ts; ненайденное не раскладывается,
# а показывается плашкой (правило Ивана 28.09: knowledge/semantic/rule-find-order-no-spread.md).
import openpyxl, glob, os, json, re, collections
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "delivery"))
from build_delivery_sku_daily import parse_date  # «4 августа» -> 2026-08-04, один разбор на оба сборщика
from ledger_money import ship_and_deliv, MoneyError, second_header  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CPO_RAW = os.path.join(ROOT, "tools", "cpo", "raw")
DL_RAW = os.path.join(ROOT, "tools", "delivery", "raw")
OUT_CPO = os.path.join(ROOT, "data", "cpo_orders.ndjson")
OUT_DL = os.path.join(ROOT, "data", "delivery_orders.ndjson")
OUT_ISSUES = os.path.join(ROOT, "data", "delivery_ledger_issues.json")


def num(x):
    try:
        return float(str(x).replace(",", ".").split("\n")[0].strip() or 0)
    except Exception:
        return 0.0


def norm(s):
    return re.sub(r"\s+", " ", str(s).strip()) if s else ""


def main():
    # --- CPO по номеру заказа (base) ---
    cpo = collections.defaultdict(float)
    for f in sorted(glob.glob(os.path.join(CPO_RAW, "*.xlsx"))):
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        ws = wb["Statistics"] if "Statistics" in wb.sheetnames else wb.worksheets[0]
        rows = list(ws.iter_rows(values_only=True))
        hi = None
        for i, r in enumerate(rows[:5]):
            if any((str(c) if c else "") == "ID заказа" for c in r):
                hi = i
                break
        if hi is None:
            wb.close()
            continue
        hdr = [str(c).strip() if c else "" for c in rows[hi]]
        ci = {h: j for j, h in enumerate(hdr)}
        for r in rows[hi + 1:]:
            if r is None or all(c is None for c in r):
                continue
            no = str(r[ci["Номер заказа"]] or "").strip()
            if no:
                cpo[no] += num(r[ci["Расход, ₽"]])
        wb.close()
    # Сырья CPO нет (оно не в git) - прошлый файл не трогаем, иначе он перезапишется пустым.
    if not cpo:
        print("CPO: сырья нет в", CPO_RAW, "- cpo_orders.ndjson оставлен как есть")
    else:
      with open(OUT_CPO, "w", encoding="utf-8") as w:
        for no, sp in sorted(cpo.items()):
            w.write(json.dumps({"order": no, "sp": round(sp, 2)}, ensure_ascii=False) + "\n")
      print(f"CPO заказов: {len(cpo)} | сумма рекламы: {sum(cpo.values()):,.0f} -> {OUT_CPO}")

    # --- Доставка по номеру постинга (ведомость), дедуп по уникальной отправке ---
    dl = collections.defaultdict(lambda: [0.0, 0.0, "", ""])  # posting -> [ship, deliv, отгрузка, доставка факт]
    bad_cells = []
    issues = {"shift": [], "empty": []}  # сдвиг столбцов / суммы нет - для плашки на странице
    table2 = []  # вторая таблица на листе со своей шапкой - не читается, называется на странице
    seen = set()
    for f in sorted(glob.glob(os.path.join(DL_RAW, "*.xlsx"))):
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        for ws in wb.worksheets:
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                continue
            hdr = [norm(c) for c in rows[0]]
            ci = {h: j for j, h in enumerate(hdr)}
            if "Номер заказа" not in ci or "Стоимость отправки" not in ci:
                continue
            for rix, r in enumerate(rows[1:], start=2):
                if r is None or all(c is None for c in r):
                    continue
                if second_header(r, ci["Площадка"]):
                    tail = [x for x in rows[rix:] if x and "OZON" in norm(x[ci["Площадка"]]).upper()]
                    table2.append({"file": os.path.basename(f), "sheet": ws.title, "row": rix, "ozon_rows": len(tail),
                                   "cols": [norm(c) for c in r if c is not None][-3:]})
                    break
                if "OZON" not in norm(r[ci["Площадка"]]).upper():
                    continue
                no = norm(r[ci["Номер заказа"]])
                if not no:
                    continue
                # Иван 28.09.2026: статус «ОТМЕНЕН» - доставку не учитываем.
                if "Статус" in ci and "отмен" in norm(r[ci["Статус"]]).lower():
                    continue
                try:
                    ic = ci["Стоимость доставки"]
                    sp, dv, flag = ship_and_deliv(r[ci["Стоимость отправки"]], r[ic], r[ic + 1] if ic + 1 < len(r) else None)
                except MoneyError as ex:
                    bad_cells.append(f"{os.path.basename(f)}:{rix} «{ex}»")
                    continue
                ds0 = parse_date(r[ci["Дата отгрузки"]]) if "Дата отгрузки" in ci else None
                if sp is None:
                    # Суммы нет (FALSE без сдвига и т.п.) - не ноль молча, а строка в списке для страницы.
                    if str(r[ci["Стоимость отправки"]] or "").strip():
                        issues["empty"].append({"order": no, "d_ship": ds0, "status": norm(r[ci["Статус"]]) if "Статус" in ci else ""})
                    continue
                if flag == "сдвиг":
                    issues["shift"].append({"order": no, "d_ship": ds0, "ship": round(sp, 2)})
                dv = dv or 0.0
                dshort = norm(r[ci["Дата отгрузки"]]) if "Дата отгрузки" in ci else ""
                key = (no, dshort, round(sp, 2))
                if key in seen:      # схлопываем повтор строк одной отправки
                    continue
                seen.add(key)
                dl[no][0] += sp
                dl[no][1] += dv
                # Даты - запасные для «Нашей доставки» по дате начисления (Иван 28.09): если OZON заказ
                # ещё не начислил, расход встаёт на фактическую доставку, а без неё - на отгрузку.
                # При нескольких отправках заказа берём последнюю дату: расход признан, когда всё доехало.
                ds = parse_date(r[ci["Дата отгрузки"]]) if "Дата отгрузки" in ci else None
                df = parse_date(r[ci["Дата доставки факт."]]) if "Дата доставки факт." in ci else None
                if ds and ds > dl[no][2]:
                    dl[no][2] = ds
                if df and df > dl[no][3]:
                    dl[no][3] = df
        wb.close()
    if bad_cells:
        sys.exit("ведомость: не прочитать сумму (исправьте ячейку, 0 не подставляем):\n  " + "\n  ".join(bad_cells))
    # Повторы строк одной отправки схлопываем и здесь.
    for k in ("shift", "empty"):
        uniq = {}
        for x in issues[k]:
            uniq[(x["order"], x.get("d_ship"))] = x
        issues[k] = sorted(uniq.values(), key=lambda x: (x.get("d_ship") or "", x["order"]))
    issues["table2"] = table2
    with open(OUT_ISSUES, "w", encoding="utf-8") as w:
        json.dump(issues, w, ensure_ascii=False, indent=1)
    print("ведомость: сдвиг столбцов", len(issues["shift"]), "| суммы нет", len(issues["empty"]), "| вторая таблица", table2, "->", OUT_ISSUES)
    with open(OUT_DL, "w", encoding="utf-8") as w:
        for no, (sh, dv, ds, df) in sorted(dl.items()):
            o = {"order": no, "ship": round(sh, 2), "deliv": round(dv, 2)}
            if ds:
                o["d_ship"] = ds
            if df:
                o["d_fact"] = df
            w.write(json.dumps(o, ensure_ascii=False) + "\n")
    print(f"доставка заказов: {len(dl)} | наша: {sum(v[0] for v in dl.values()):,.0f} | клиент: {sum(v[1] for v in dl.values()):,.0f} -> {OUT_DL}")


if __name__ == "__main__":
    main()
