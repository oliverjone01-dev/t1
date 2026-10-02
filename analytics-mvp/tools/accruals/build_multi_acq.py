#!/usr/bin/env python3
# Эквайринг заказов с несколькими артикулами по дням (отчёты OZON «Начисления», лист «Начисления»)
# -> data/acct_multi_acq_daily.ndjson: {d, acq} (acq < 0, знак как у OZON).
#
# ЗАЧЕМ (Иван 02.10, вариант «а»). Транзакции OZON (pnl-account-daily) кладут операцию эквайринга заказа
# с несколькими разными артикулами в «прочее кабинета», а эквайринг по артикулам (acq_sku_daily, начисления
# by-day) уже несёт тот же эквайринг по каждому артикулу - он считался дважды. Сверка с выгрузками
# начислений: март-сентябрь 1 831 / 6 816 / 3 770 / 7 369 / 700 / 2 227 / 4 363 ₽ - это и есть остаток
# расхождения «К выплате» с итогом выгрузки. build-katya снимает эту сумму с «прочего кабинета» только в днях,
# где оно идёт из транзакций (с 08.09 «прочее кабинета» берётся из начислений, там дубля нет).
#
# Операция = (ID начисления, дата начисления); несколько артикулов = больше одного разного SKU в её строках.
# Запуск из analytics-mvp: python3 tools/accruals/build_multi_acq.py
import openpyxl, glob, os, json, collections

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "tools", "accruals", "raw")
OUT = os.path.join(ROOT, "data", "acct_multi_acq_daily.ndjson")


def main():
    ops = collections.defaultdict(list)
    for f in sorted(glob.glob(os.path.join(RAW, "accruals_*.xlsx"))):
        ws = openpyxl.load_workbook(f, read_only=True).worksheets[0]
        for i, r in enumerate(ws.iter_rows(values_only=True)):
            if i < 2 or not r or r[15] is None or not r[0] or not r[5] or not r[1]:
                continue
            ops[(str(r[0]).strip(), r[1].strftime("%Y-%m-%d"))].append((str(r[5]).strip(), str(r[3] or ""), float(r[15])))
    day = collections.Counter()
    for (_, d), rows in ops.items():
        if len({s for s, _, _ in rows}) < 2:
            continue
        for _, t, v in rows:
            if "эквайринг" in t.lower():
                day[d] += v
    out = [{"d": d, "acq": round(v, 2)} for d, v in sorted(day.items()) if abs(v) >= 0.005]
    with open(OUT, "w", encoding="utf-8") as fh:
        for r in out:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    by_m = collections.Counter()
    for r in out:
        by_m[r["d"][:7]] += r["acq"]
    print(f"build_multi_acq: {len(out)} дн -> {OUT}; по месяцам: " + ", ".join(f"{m} {round(v)}" for m, v in sorted(by_m.items())))


if __name__ == "__main__":
    main()
