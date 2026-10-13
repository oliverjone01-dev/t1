#!/usr/bin/env python3
# Отчёт кабинета OZON «Оплата за заказ (все товары). Отчёт по заказам» -> data/cpo_card_orders.ndjson.
# Только для вкладки «Реклама по карточкам» (Иван 02.10): CPO по заказу за месяцы, которых нет в
# data/cpo_orders.ndjson, плюс выручка заказа и SKU продвигаемого товара. «Деньги» этот файл не читают.
#
# Вход:  data/raw/ozon-cpo/*.xlsx (выгрузки кабинета, лежат в репо по слову Ивана 02.10).
# Выход: {d, order, sku, psku, n, rev, sp} - строка отчёта как есть (один заказ может дать несколько строк).
#   rev = «Стоимость, ₽» - сумма строки (цена × Количество), не «Стоимость продажи, ₽» (цена за штуку;
#   ФЕНИКС G1 13.10). Отменённые здесь не убираются: статус заказа меняется, его берёт сборка из orders_daily.
# Повторная выгрузка: каждый файл заменяет все строки своего окна из строки «Период: дд.мм.гггг - дд.мм.гггг»
#   (как сборщики CPO в main, ФЕНИКС G6). Файлы идут по имени, поздний побеждает: повтор месяца называть
#   с суффиксом, напр. 2026-09_cpo_orders_v2.xlsx.
# Запуск из analytics-mvp:  python3 tools/cpo/build_cpo_card_orders.py   (нужен openpyxl)
import openpyxl, glob, os, json, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw", "ozon-cpo")
OUT = os.path.join(ROOT, "data", "cpo_card_orders.ndjson")
WIN = os.path.join(ROOT, "data", "cpo_card_windows.json")  # окна выгрузок: ДРР «Оплаты за заказ» только по ним (G4)
NEED = ["Дата", "Номер заказа", "SKU", "SKU продвигаемого товара", "Количество", "Стоимость продажи, ₽", "Стоимость, ₽", "Расход, ₽"]


def main():
    files = sorted(glob.glob(os.path.join(RAW, "*.xlsx")))
    if not files:
        sys.exit("нет .xlsx в " + RAW)
    out, wins = [], []
    for f in files:
        ws = openpyxl.load_workbook(f, read_only=True, data_only=True).worksheets[0]
        rows = list(ws.iter_rows(values_only=True))
        per = next((m for r in rows[:3] if r for m in [re.search(r"Период:\s*(\d\d)\.(\d\d)\.(\d{4})\s*-\s*(\d\d)\.(\d\d)\.(\d{4})", str(r[0] or ""))] if m), None)
        if not per:
            sys.exit("нет строки «Период: дд.мм.гггг - дд.мм.гггг»: " + os.path.basename(f))
        w0, w1 = f"{per[3]}-{per[2]}-{per[1]}", f"{per[6]}-{per[5]}-{per[4]}"
        hi = next((i for i, r in enumerate(rows[:6]) if r and "Номер заказа" in [str(c or "") for c in r]), None)
        if hi is None:
            sys.exit("не отчёт по заказам (нет «Номер заказа»): " + os.path.basename(f))
        ci = {str(h or ""): j for j, h in enumerate(rows[hi])}
        miss = [h for h in NEED if h not in ci]
        if miss:
            sys.exit(os.path.basename(f) + ": нет колонок " + ", ".join(miss))
        mine = []
        for r in rows[hi + 1:]:
            if not r or not r[ci["Номер заказа"]]:
                continue
            dd, mm, yy = str(r[ci["Дата"]]).split(".")
            n, price, line = int(r[ci["Количество"]] or 0), float(r[ci["Стоимость продажи, ₽"]] or 0), float(r[ci["Стоимость, ₽"]] or 0)
            if abs(price * n - line) > 1:  # инвариант: сумма строки = цена × Количество
                sys.exit(f"{os.path.basename(f)}: заказ {r[ci['Номер заказа']]}: Стоимость {line} != {price} × {n}")
            rec = {"d": f"{yy}-{mm}-{dd}", "order": str(r[ci["Номер заказа"]]), "sku": str(r[ci["SKU"]]),
                   "psku": str(r[ci["SKU продвигаемого товара"]]), "n": n,
                   "rev": round(line, 2), "sp": round(float(r[ci["Расход, ₽"]] or 0), 2)}
            if not (w0 <= rec["d"] <= w1):
                sys.exit(f"{os.path.basename(f)}: строка {rec['d']} вне окна {w0}..{w1}")
            mine.append(rec)
        drop = sum(1 for x in out if w0 <= x["d"] <= w1)
        out = [x for x in out if not (w0 <= x["d"] <= w1)] + mine
        wins.append([w0, w1])
        print(f"  {os.path.basename(f)}: окно {w0}..{w1}, {len(mine)} строк (заменено прежних {drop}), "
              f"выручка {sum(x['rev'] for x in mine):.2f}, расход {sum(x['sp'] for x in mine):.2f}")
    out.sort(key=lambda x: (x["d"], x["order"], x["sku"]))
    with open(OUT, "w", encoding="utf-8") as fh:
        for x in out:
            fh.write(json.dumps(x, ensure_ascii=False) + "\n")
    wins.sort()
    merged = []
    for w in wins:
        if merged and w[0] <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], w[1])
        else:
            merged.append(list(w))
    with open(WIN, "w", encoding="utf-8") as fh:
        json.dump(merged, fh)
    print("->", OUT, len(out), "окна", merged)


if __name__ == "__main__":
    main()
