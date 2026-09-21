#!/usr/bin/env python3
# Парсер отчётов OZON «Начисления» (лист «Начисления») -> data/order_accruals.ndjson.
# Авторитетный источник сборов ПО ЗАКАЗУ: полный набор начислений с ключом база+постинг.
#
# ЗАЧЕМ. Блок «Аналитика по заказам» брал сборы из API /v1/finance/accrual/postings по ПОЛНОМУ
# номеру постинга (с суффиксом отправки «-N»). Но OZON часть сборов уровня заказа - прежде всего
# ЭКВАЙРИНГ - привязывает к БАЗОВОМУ номеру заказа (без «-N»). Проверено на августе: эквайринг -
# 402 строки под базой против 13 под постингом, поэтому по заказам он выпадал в 0 (потеря
# -143 233 ₽ за август, ~-1,07 млн за период). Логистика по API тоже приходила неполно.
# Отчёт «Начисления» решает это: одна строка = одно начисление, «ID начисления» = база ИЛИ постинг,
# «Сумма итого, руб.» - знак как у OZON (сбор < 0). Схлопываем всё на БАЗОВЫЙ заказ.
#
# Выход data/order_accruals.ndjson, строка на (база заказа): {order, ym, commission, delivery,
# acquiring, storage, ads, partner, buyer_delivery, other, rev_cash, rev_points, returns, n}.
# Все суммы округлены, знак сохранён. build-katya подмешивает их в блок по заказам по базе.
#
# Запуск из analytics-mvp: python3 tools/accruals/build_order_accruals.py
import openpyxl, glob, os, re, json, collections

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "tools", "accruals", "raw")
OUT = os.path.join(ROOT, "data", "order_accruals.ndjson")


def base(o):
    """XXXXXXXX-YYYY-Z (постинг) -> XXXXXXXX-YYYY (заказ). Двухчастный ID уже база."""
    o = str(o or "").strip()
    p = o.split("-")
    return "-".join(p[:2]) if len(p) >= 2 else o


def bucket(grp, typ):
    g = str(grp or "").strip()
    t = str(typ or "").lower()
    if g == "Продажи":
        if "выручка" in t:
            return "rev_cash"
        if "балл" in t:
            return "rev_points"
        return "rev_other"
    if g == "Вознаграждение Ozon":
        return "commission"
    if g == "Услуги доставки":
        return "delivery"
    if g == "Услуги партнёров":
        if "эквайринг" in t:
            return "acquiring"
        if "размещ" in t or "хранен" in t:
            return "storage"      # временное размещение товара партнёрами = хранение
        # «Услуги партнёров» в дашборде = ТОЛЬКО партнёрская доставка rFBS (услуги realFBS + доставка до
        # места выдачи). Звёздные, страхование, обработка возвратов партнёрами - не доставка -> other.
        if "realfbs" in t or "real fbs" in t or ("доставк" in t and "выдач" in t):
            return "partner"
        return "other"
    if g == "Продвижение и реклама":
        return "ads"
    if g == "Прочие начисления":
        if "доставк" in t and "покупател" in t:
            return "buyer_delivery"
        return "other"
    if g == "Возвраты":
        return "returns"
    # Другие услуги и штрафы + всё нераспознанное
    return "other"


BUCKETS = ["commission", "delivery", "acquiring", "storage", "ads", "partner",
           "buyer_delivery", "other", "rev_cash", "rev_points", "rev_other", "returns"]


def num(x):
    try:
        return float(x)
    except Exception:
        try:
            return float(str(x).replace(" ", "").replace(" ", "").replace(",", "."))
        except Exception:
            return 0.0


def main():
    files = sorted(glob.glob(os.path.join(RAW, "*.xlsx")))
    if not files:
        print("build_order_accruals: нет отчётов в tools/accruals/raw/ - пропуск")
        return
    orders = collections.defaultdict(lambda: collections.Counter())
    ym_of = {}
    seen_ids = set()          # (ID начисления, тип, сумма, дата) - защита от дублей при пересечении файлов
    months = collections.Counter()
    for f in files:
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        ws = wb["Начисления"] if "Начисления" in wb.sheetnames else wb.worksheets[0]
        rows = list(ws.iter_rows(values_only=True))
        # шапка - строка с «ID начисления»
        hi = next((i for i, r in enumerate(rows[:5]) if any(str(c).strip() == "ID начисления" for c in r if c)), 1)
        hdr = [str(c).strip() if c else "" for c in rows[hi]]
        ci = {h: j for j, h in enumerate(hdr)}
        c_id = ci.get("ID начисления", 0)
        c_dt = ci.get("Дата начисления", 1)
        c_grp = ci.get("Группа услуг", 2)
        c_typ = ci.get("Тип начисления", 3)
        c_sum = ci.get("Сумма итого, руб.")
        if c_sum is None:
            c_sum = next((j for j, h in enumerate(hdr) if h.lower().startswith("сумма")), len(hdr) - 1)
        for r in rows[hi + 1:]:
            if r is None or all(c is None for c in r):
                continue
            idv = str(r[c_id] or "").strip()
            if not idv:
                continue                       # начисления без привязки к заказу (общекабинетные) - пропускаем
            dt = str(r[c_dt] or "")[:10]
            s = round(num(r[c_sum]), 2)
            key = (idv, str(r[c_typ] or ""), s, dt)
            if key in seen_ids:
                continue
            seen_ids.add(key)
            b = base(idv)
            bk = bucket(r[c_grp], r[c_typ])
            orders[b][bk] += s
            ym = dt[:7]
            months[ym] += 1
            # месяц заказа помечаем по самой ранней дате начисления (для фильтра периодов)
            if b not in ym_of or ym < ym_of[b]:
                ym_of[b] = ym
        wb.close()
    with open(OUT, "w", encoding="utf-8") as w:
        for b, c in sorted(orders.items()):
            row = {"order": b, "ym": ym_of.get(b, "")}
            for k in BUCKETS:
                if round(c[k]):
                    row[k] = round(c[k])
            row["n"] = 1
            w.write(json.dumps(row, ensure_ascii=False) + "\n")
    tot = collections.Counter()
    for c in orders.values():
        for k in BUCKETS:
            tot[k] += c[k]
    print(f"order_accruals: заказов {len(orders)} | месяцы начислений {dict(months)}")
    print("  Σ по бакетам:")
    for k in BUCKETS:
        if round(tot[k]):
            print(f"    {k:14} {tot[k]:>14,.0f}")
    print(f"  -> {OUT}")


if __name__ == "__main__":
    main()
