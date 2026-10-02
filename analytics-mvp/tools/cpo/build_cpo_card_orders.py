#!/usr/bin/env python3
# Отчёт кабинета OZON «Оплата за заказ (все товары). Отчёт по заказам» -> data/cpo_card_orders.ndjson.
# Только для вкладки «Реклама по карточкам» (Иван 02.10): CPO по заказу за месяцы, которых нет в
# data/cpo_orders.ndjson, плюс выручка заказа и SKU продвигаемого товара. «Деньги» этот файл не читают.
#
# Вход:  data/raw/ozon-cpo/*.xlsx (выгрузки кабинета, лежат в репо по слову Ивана 02.10).
# Выход: {d, order, sku, psku, n, rev, sp} - строка отчёта как есть (один заказ может дать несколько строк).
# Запуск из analytics-mvp:  python3 tools/cpo/build_cpo_card_orders.py   (нужен openpyxl)
import openpyxl, glob, os, json, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw", "ozon-cpo")
OUT = os.path.join(ROOT, "data", "cpo_card_orders.ndjson")
NEED = ["Дата", "Номер заказа", "SKU", "SKU продвигаемого товара", "Количество", "Стоимость продажи, ₽", "Расход, ₽"]


def main():
    files = sorted(glob.glob(os.path.join(RAW, "*.xlsx")))
    if not files:
        sys.exit("нет .xlsx в " + RAW)
    out, seen = [], set()
    for f in files:
        ws = openpyxl.load_workbook(f, read_only=True, data_only=True).worksheets[0]
        rows = list(ws.iter_rows(values_only=True))
        hi = next((i for i, r in enumerate(rows[:6]) if r and "Номер заказа" in [str(c or "") for c in r]), None)
        if hi is None:
            sys.exit("не отчёт по заказам (нет «Номер заказа»): " + os.path.basename(f))
        ci = {str(h or ""): j for j, h in enumerate(rows[hi])}
        miss = [h for h in NEED if h not in ci]
        if miss:
            sys.exit(os.path.basename(f) + ": нет колонок " + ", ".join(miss))
        n0, mine = len(out), set()
        for r in rows[hi + 1:]:
            if not r or not r[ci["Номер заказа"]]:
                continue
            dd, mm, yy = str(r[ci["Дата"]]).split(".")
            rec = {"d": f"{yy}-{mm}-{dd}", "order": str(r[ci["Номер заказа"]]), "sku": str(r[ci["SKU"]]),
                   "psku": str(r[ci["SKU продвигаемого товара"]]), "n": int(r[ci["Количество"]] or 0),
                   "rev": round(float(r[ci["Стоимость продажи, ₽"]] or 0), 2), "sp": round(float(r[ci["Расход, ₽"]] or 0), 2)}
            key = json.dumps(rec, sort_keys=True)
            if key in seen:  # та же строка в другом файле (месяц выгружен дважды) - не задваиваем
                continue
            mine.add(key)
            out.append(rec)
        seen |= mine
        print(f"  {os.path.basename(f)}: {len(out) - n0} строк, расход {sum(x['sp'] for x in out[n0:]):.2f}")
    out.sort(key=lambda x: (x["d"], x["order"], x["sku"]))
    with open(OUT, "w", encoding="utf-8") as fh:
        for x in out:
            fh.write(json.dumps(x, ensure_ascii=False) + "\n")
    print("->", OUT, len(out))


if __name__ == "__main__":
    main()
