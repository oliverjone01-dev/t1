#!/usr/bin/env python3
# Проверка сборщиков «Оплаты за заказ» на фикстурах xlsx (ФЕНИКС O2 13.10): повтор выгрузки месяца не удваивает
# списания, поздний файл заменяет свой период, файл без «Период:» и строка вне периода - отказ с кодом 1.
# Запуск из analytics-mvp: python3 tools/tests/cpo_raw_check.py   (код 0 - всё прошло)
import importlib.util
import json
import os
import shutil
import sys
import tempfile

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, "cpo"))
from cpo_raw import read_raw, CpoRawError  # noqa: E402

HDR = ["Дата", "ID заказа", "Номер заказа", "SKU", "Артикул", "Расход, ₽"]
# Сентябрь: 818 149 ₽ (сумма выгрузки 01-30.09 из decisions.md 01.10), заказ 0002 - две строки (два товара).
SEP = [["03.09.2026", "1", "0001-0001", 111, "GGM-01", 400000.0],
       ["10.09.2026", "2", "0002-0002", 222, "GGM-02", 300000.0],
       ["10.09.2026", "2", "0002-0002", 333, "GGM-03", 18149.0],
       ["29.09.2026", "3", "0003-0003", 111, "GGM-01", 100000.0]]


def xlsx(path, period, rows, title="Оплата за заказ - все товары"):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Statistics"
    ws.append([title])
    if period:
        ws.append([f"Период: {period}"])
    ws.append(HDR)
    for r in rows:
        ws.append(r)
    wb.save(path)


def load(mod_path, name):
    spec = importlib.util.spec_from_file_location(name, mod_path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def total(rows):
    return round(sum(r["sp"] for r in rows), 2)


fails = []


def check(name, got, want):
    ok = got == want
    print(("OK  " if ok else "FAIL"), name, "получено", got, "ожидалось", want)
    if not ok:
        fails.append(name)


def refuses(name, raw):
    try:
        read_raw(raw)
    except CpoRawError as ex:
        print("OK  ", name, "- отказ:", ex)
        return
    print("FAIL", name, "- отказа нет")
    fails.append(name)


tmp = tempfile.mkdtemp(prefix="cpo_raw_")
try:
    raw = os.path.join(tmp, "raw")
    os.makedirs(raw)
    xlsx(os.path.join(raw, "cpo_2026-09_a.xlsx"), "01.09.2026 - 30.09.2026", SEP)
    rows, used, _ = read_raw(raw)
    check("сентябрь один файл", total(rows), 818149.0)
    # Повтор того же месяца (вторая выгрузка): было 1 636 298, должно остаться 818 149.
    xlsx(os.path.join(raw, "cpo_2026-09_b.xlsx"), "01.09.2026 - 30.09.2026", SEP)
    rows, used, _ = read_raw(raw)
    check("повтор сентября", total(rows), 818149.0)
    check("повтор: из раннего файла взято строк", used[0][2], 0)

    # Сборщики целиком: оба пишут 818 149 при двух одинаковых файлах.
    data = os.path.join(tmp, "data")
    os.makedirs(data)
    jo = load(os.path.join(TOOLS, "orders", "build_order_joins.py"), "joins_t")
    jo.CPO_RAW, jo.OUT_CPO, jo.CPO_ONLY = raw, os.path.join(data, "cpo_orders.ndjson"), True
    jo.main()
    co = [json.loads(l) for l in open(jo.OUT_CPO, encoding="utf-8")]
    check("cpo_orders при повторе", round(sum(r["sp"] for r in co), 2), 818149.0)
    check("cpo_orders: заказ 0002 одной строкой (день 10.09)", [(r["d"], r["sp"]) for r in co if r["order"] == "0002-0002"], [("2026-09-10", 318149.0)])
    sk = load(os.path.join(TOOLS, "cpo", "build_cpo_sku_daily.py"), "sku_t")
    sk.RAW, sk.OUT = raw, os.path.join(data, "cpo_sku_daily.ndjson")
    sk.main()
    sd = [json.loads(l) for l in open(sk.OUT, encoding="utf-8")]
    check("cpo_sku_daily при повторе", round(sum(r["sp"] for r in sd), 2), 818149.0)

    # Поздний файл с частичным пересечением (15.09-14.10) заменяет 15-30.09 раннего: остаются 03.09 и 10.09 раннего.
    xlsx(os.path.join(raw, "cpo_2026-10.xlsx"), "15.09.2026 - 14.10.2026", [["01.10.2026", "4", "0004-0004", 111, "GGM-01", 5000.0]])
    rows, used, _ = read_raw(raw)
    check("пересечение 15.09-14.10", total(rows), 718149.0 + 5000.0)

    # ФЕНИКС G4: второе скачивание браузера «x (1).xlsx» (исправленное) побеждает «x.xlsx».
    r1 = os.path.join(tmp, "raw_dl")
    os.makedirs(r1)
    xlsx(os.path.join(r1, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026", [["03.09.2026", "1", "A-1", 1, "a", 100.0], ["04.09.2026", "2", "B-1", 1, "a", 50.0]])
    xlsx(os.path.join(r1, "2026-09_cpo_orders (1).xlsx"), "01.09.2026 - 30.09.2026", [["03.09.2026", "1", "A-1", 1, "a", 100.0], ["05.09.2026", "3", "C-1", 1, "a", 70.0]])
    rows, used, _ = read_raw(r1)
    check("G4 «(1)» после оригинала", [u[0] for u in used], ["2026-09_cpo_orders.xlsx", "2026-09_cpo_orders (1).xlsx"])
    check("G4 сумма исправленной выгрузки", total(rows), 170.0)

    # ФЕНИКС G5: cpo_orders заменяет окно периода, как cpo_sku_daily.
    def run_both(raw_dir, prev_orders, prev_sku):
        dd = tempfile.mkdtemp(dir=tmp)
        with open(os.path.join(dd, "cpo_orders.ndjson"), "w", encoding="utf-8") as w:
            w.write("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in prev_orders))
        with open(os.path.join(dd, "cpo_sku_daily.ndjson"), "w", encoding="utf-8") as w:
            w.write("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in prev_sku))
        jo.CPO_RAW, jo.OUT_CPO = raw_dir, os.path.join(dd, "cpo_orders.ndjson")
        jo.main()
        sk.RAW, sk.OUT = raw_dir, os.path.join(dd, "cpo_sku_daily.ndjson")
        sk.main()
        co = [json.loads(l) for l in open(jo.OUT_CPO, encoding="utf-8")]
        sd = [json.loads(l) for l in open(sk.OUT, encoding="utf-8")]
        return round(sum(r["sp"] for r in co), 2), round(sum(r["sp"] for r in sd), 2)
    r5 = os.path.join(tmp, "raw_f2")
    os.makedirs(r5)
    xlsx(os.path.join(r5, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026", [["03.09.2026", "1", "A-1", 1, "a", 100.0]])
    check("G5 F2: заказ пропал из повтора - уходит (cpo_orders, sku_daily)",
          run_both(r5, [{"order": "A-1", "d": "2026-09-03", "sp": 100.0}, {"order": "B-1", "d": "2026-09-04", "sp": 50.0}],
                   [{"d": "2026-09-03", "sku": "1", "offer": "a", "sp": 100.0, "n": 1}, {"d": "2026-09-04", "sku": "1", "offer": "a", "sp": 50.0, "n": 1}]),
          (100.0, 100.0))
    r6 = os.path.join(tmp, "raw_f3")
    os.makedirs(r6)
    xlsx(os.path.join(r6, "2026-09_cpo_orders.xlsx"), "01.09.2026 - 30.09.2026", [["01.09.2026", "9", "X-1", 1, "a", 20.0]])
    check("G5 F3: заказ на стыке месяцев - обе части",
          run_both(r6, [{"order": "X-1", "d": "2026-08-31", "sp": 80.0}], [{"d": "2026-08-31", "sku": "1", "offer": "a", "sp": 80.0, "n": 1}]),
          (100.0, 100.0))
    check("G5: старая строка без дня заменяется по номеру заказа",
          run_both(r6, [{"order": "X-1", "sp": 80.0}, {"order": "Y-1", "sp": 5.0}], [])[0], 25.0)

    # Отказы.
    r2 = os.path.join(tmp, "raw_noper")
    os.makedirs(r2)
    xlsx(os.path.join(r2, "x.xlsx"), None, SEP)
    refuses("файл без «Период:»", r2)
    r3 = os.path.join(tmp, "raw_out")
    os.makedirs(r3)
    xlsx(os.path.join(r3, "x.xlsx"), "01.09.2026 - 30.09.2026", SEP + [["01.10.2026", "5", "0005-0005", 111, "GGM-01", 1.0]])
    refuses("строка вне периода", r3)
    r4 = os.path.join(tmp, "raw_nodate")
    os.makedirs(r4)
    xlsx(os.path.join(r4, "x.xlsx"), "01.09.2026 - 30.09.2026", SEP + [[None, "6", "0006-0006", 111, "GGM-01", 1.0]])
    refuses("заказ без даты", r4)
    # Код выхода сборщика при отказе - 1.
    jo.CPO_RAW = r2
    try:
        jo.main()
        code = 0
    except SystemExit as ex:
        code = ex.code
    check("build_order_joins: код выхода при отказе", code, 1)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("ПРОВАЛОВ:", len(fails), fails if fails else "")
sys.exit(1 if fails else 0)
