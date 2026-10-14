#!/usr/bin/env python3
# Разнос рекламы «Оплата за заказ» (CPO) по SKU/день из ручных per-order выгрузок кабинета OZON.
#
# Зачем: OZON НЕ отдаёт атрибуцию CPO по SKU через API, поэтому в дашборде CPO целиком лежал в
# «Общих расходах». Ручной отчёт «Оплата за заказ (все товары)» (Статистика по заказам) даёт строку
# на каждый заказ с SKU, артикулом и расходом - из него собираем дневной срез по SKU, который
# build-katya.ts разносит в колонку «Реклама» и на ту же сумму уменьшает «Общие».
#
# Вход:  tools/cpo/raw/*.xlsx  - выгрузки кабинета (в git не хранятся, см. .gitignore).
#        Берём ТОЛЬКО файлы с заголовком-строкой, где есть «ID заказа» (per-order отчёт).
#        Кампанийные отчёты (по SKU, с колонкой «Инструмент») игнорируются - в них нет разбивки
#        CPO по заказу, только агрегат.
# Выход: data/cpo_sku_daily.ndjson  - {d, sku, offer, sp, n} по (sku, дню).
#        Пишется только окно выгрузок: даты из строки «Период: дд.мм.гггг - дд.мм.гггг» каждого файла
#        (нет строки - отказ, код 1; разбор и замена периодов - tools/cpo/cpo_raw.py). Строки прошлого файла вне этих окон остаются:
#        выгрузки прошлых месяцев в raw/ не хранятся, и сентябрьская стёрла бы июнь-август (01.10).
#
# Запуск из analytics-mvp:  python3 tools/cpo/build_cpo_sku_daily.py
# Требуется: python3 + openpyxl.
import glob, os, json, collections, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cpo_raw import read_raw, CpoRawError  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "tools", "cpo", "raw")
OUT = os.path.join(ROOT, "data", "cpo_sku_daily.ndjson")


def main():
    files = sorted(glob.glob(os.path.join(RAW, "*.xlsx")))
    if not files:
        sys.exit("нет ни одного .xlsx в " + RAW + " (положи per-order выгрузки CPO)")
    try:
        rows, used, skipped = read_raw(RAW)  # каждый файл заменяет свой «Период:», поздний по имени побеждает (O2)
    except CpoRawError as ex:
        print("ОТКАЗ:", ex)
        sys.exit(1)
    for f in skipped:
        print("  пропуск (не per-order отчёт):", f)
    daily = collections.defaultdict(lambda: [0.0, 0])  # (sku,d)->[spend,orders]
    sku_off = {}
    permon = collections.defaultdict(float)
    windows = [w for _, w, _, _ in used]
    for r in rows:
        sku, d = r["sku"], r["d"]
        if not sku or sku == "0":
            continue
        daily[(sku, d)][0] += r["sp"]
        daily[(sku, d)][1] += 1
        if r["offer"]:
            sku_off.setdefault(sku, r["offer"])
        permon[d[:7]] += r["sp"]
    out = []
    kept = 0
    try:
        for l in open(OUT, encoding="utf-8"):
            if not l.strip():
                continue
            o = json.loads(l)
            if any(a <= o["d"] <= b for a, b in windows):
                continue  # окно новой выгрузки пишется заново целиком
            out.append(o)
            kept += 1
    except FileNotFoundError:
        pass
    for (sku, d), (sp, n) in sorted(daily.items()):
        out.append({"d": d, "sku": sku, "offer": sku_off.get(sku, sku), "sp": round(sp, 2), "n": n})
    out.sort(key=lambda o: (o["sku"], o["d"]))  # порядок прежнего файла (sku, день): дифф = только новые строки
    print("окна выгрузок:", windows, "| оставлено строк вне окон:", kept)
    with open(OUT, "w", encoding="utf-8") as w:
        for o in out:
            w.write(json.dumps(o, ensure_ascii=False) + "\n")
    print("файлов:", len(used), [(f, f"{w[0]}..{w[1]}", f"строк {n}", f"заменено поздним файлом {x}") for f, w, n, x in used])
    print("CPO по месяцам:", {k: round(v) for k, v in sorted(permon.items())})
    print("строк:", len(out), "| уник SKU:", len(set(k[0] for k in daily)))
    print("записано:", OUT)


if __name__ == "__main__":
    main()
