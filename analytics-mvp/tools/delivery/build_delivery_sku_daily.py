#!/usr/bin/env python3
# Разнос НАШЕГО расхода на доставку (счёт перевозчика ПЭК/СДЭК и т.п.) по артикулам из ручной
# ведомости доставки. Только OZON, только ЗАКРЫТЫЕ месяцы (текущий месяц исключается - по нему
# ведомость ещё неполная, и по требованию Ивана текущий месяц не трогаем).
#
# Зачем: OZON в своих транзакциях показывает лишь свой сбор за логистику (колонка «Логистика» +
# realFBS), который в 4-6 раз меньше нашего реального счёта перевозчика. Наш расход на отправку
# (FBS/realFBS через ПЭК/СДЭК) в дашборде не отражался вовсе - прибыль была завышена. Ведомость
# доставки даёт «Стоимость отправки» по каждому заказу с артикулом -> разносим по SKU отдельным
# столбцом «Наша доставка».
#
# Колонки ведомости: Площадка, Номер заказа, Артикул, Дата отгрузки, ..., Адрес, Стоимость отправки,
# Стоимость доставки. «Стоимость отправки» = наш расход (разносим). «Стоимость доставки» = что платит
# клиент (пишем в поле deliv ТОЛЬКО для сверки, в дашборде не показываем).
#
# Вход:  tools/delivery/raw/*.xlsx  (в git не хранятся, см. .gitignore)
# Выход: data/delivery_sku_daily.ndjson  - {d, offer, ship, deliv, n} по (артикул, день отгрузки)
#        data/delivery_cities.json       - {offer: [[город, кол-во], ...]} для примечания к столбцу
#
# Запуск из analytics-mvp:  python3 tools/delivery/build_delivery_sku_daily.py
import openpyxl, glob, os, json, re, collections, datetime, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "tools", "delivery", "raw")
OUT = os.path.join(ROOT, "data", "delivery_sku_daily.ndjson")
OUT_CITY = os.path.join(ROOT, "data", "delivery_cities.json")
CUR_MONTH = datetime.date.today().strftime("%Y-%m")  # текущий месяц исключаем (закрытые только)
YEAR = 2026
MES = {"янв": 1, "фев": 2, "мар": 3, "апр": 4, "мая": 5, "май": 5, "июн": 6, "июл": 7,
       "авг": 8, "сен": 9, "окт": 10, "ноя": 11, "дек": 12}


def norm(s):
    return re.sub(r"\s+", " ", str(s).strip()) if s else ""


# кириллица -> латиница (гомоглифы) в коде артикула: GGTP-20-3х2 -> GGTP-20-3x2
_HOMO = str.maketrans({
    "А": "A", "В": "B", "С": "C", "Е": "E", "Н": "H", "К": "K", "М": "M", "О": "O",
    "Р": "P", "Т": "T", "Х": "X", "У": "Y",
    "а": "a", "в": "b", "с": "c", "е": "e", "н": "h", "к": "k", "м": "m", "о": "o",
    "р": "p", "т": "t", "х": "x", "у": "y",
})


def nrm_art(s):
    return str(s).strip().translate(_HOMO) if s else ""


# Код артикула: латиница/цифры с дефисами (GGT-03-3-5-O-20090, B-100-200-9003). Примечания в
# ячейке (KONUX, BEPX=«ВЕРХ», «HALFEO Slim Black XL», «(комплект…)») дефис-структуры не имеют.
_CODE_RE = re.compile(r"^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$")


def clean_arts(raw):
    # Ячейка «Артикул» бывает грязной: «2 шт GGP-01-2-B-240-100», мультиартикул через перенос,
    # код + примечание на второй строке. Возвращаем список чистых кодов артикулов.
    if not raw:
        return []
    out = []
    for part in re.split(r"[\n;]+", str(raw)):
        p = re.sub(r"^\s*\d+\s*ш[тt]\.?\s*", "", part.strip(), flags=re.I)  # снять «N шт»
        p = nrm_art(p)
        if _CODE_RE.match(p) and p not in out:
            out.append(p)
    return out


def parse_date(s):
    if not s:
        return None
    m = re.match(r"(\d{1,2})\s+([а-я]+)", str(s).strip().lower())
    if not m:
        return None
    mon = next((v for k, v in MES.items() if m.group(2).startswith(k)), None)
    return f"{YEAR}-{mon:02d}-{int(m.group(1)):02d}" if mon else None


def num(x):
    if x is None:
        return 0.0
    try:
        return float(str(x).replace(",", ".").split("\n")[0].strip() or 0)
    except Exception:
        return 0.0


def city_of(addr):
    # Адрес вида «Регион, город/район, улица...». Берём первые два сегмента как пункт назначения.
    if not addr:
        return "—"
    parts = [p.strip() for p in str(addr).split(",") if p.strip()]
    return ", ".join(parts[:2]) if parts else "—"


def main():
    files = sorted(glob.glob(os.path.join(RAW, "*.xlsx")))
    if not files:
        sys.exit("нет .xlsx в " + RAW)
    # РАЗБОР ПО НОМЕРУ ЗАКАЗА, реальный расход, без задвоения.
    # Отчёт повторяет «Стоимость отправки» на КАЖДОЙ товарной строке отправки. При этом один заказ
    # может иметь НЕСКОЛЬКО реальных отправок (напр. возврат на склад + повторная доставка - обе
    # оплачены). Поэтому единица дедупа - ОТПРАВКА: уникальный (номер заказа, дата отгрузки, сумма
    # отправки). Внутри отправки строки-повторы (по числу товаров) схлопываются; разные отправки
    # заказа считаются раздельно. Берём все статусы, где отправка>0 (реальный оплаченный расход):
    # решение Ивана - «по артикулу реальный расход, только не задвоить».
    events = {}  # (order, date, round(ship,2)) -> {ship, deliv, date, arts, city, st}
    ozon = 0
    for f in files:
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        for ws in wb.worksheets:
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                continue
            hdr = [norm(c) for c in rows[0]]
            ci = {h: j for j, h in enumerate(hdr)}
            need = ["Площадка", "Номер заказа", "Артикул", "Дата отгрузки", "Стоимость отправки", "Стоимость доставки", "Адрес", "Статус"]
            if not all(k in ci for k in need):
                continue
            for r in rows[1:]:
                if r is None or all(c is None for c in r):
                    continue
                if "OZON" not in str(r[ci["Площадка"]] or "").upper():
                    continue
                ozon += 1
                ship = num(r[ci["Стоимость отправки"]])
                if ship <= 0:            # реальный расход: строки без отправки (0) пропускаем
                    continue
                no = str(r[ci["Номер заказа"]] or "").strip()
                d = parse_date(r[ci["Дата отгрузки"]])
                if not no or not d:
                    continue
                key = (no, d, round(ship, 2))
                e = events.get(key)
                if e is None:
                    e = events[key] = {"ship": ship, "deliv": num(r[ci["Стоимость доставки"]]),
                                       "date": d, "arts": [], "city": city_of(r[ci["Адрес"]]),
                                       "st": norm(r[ci["Статус"]])}
                for art in clean_arts(r[ci["Артикул"]]):
                    if art not in e["arts"]:
                        e["arts"].append(art)
        wb.close()

    daily = collections.defaultdict(lambda: [0.0, 0.0, 0])  # (offer,d)->[ship,deliv,отправок]
    cities = collections.defaultdict(collections.Counter)     # offer-> Counter(city)
    permon = collections.defaultdict(float)
    permon_deliv = collections.defaultdict(float)
    bystatus = collections.defaultdict(lambda: [0, 0.0])       # статус -> [отправок, сумма] (инфо)
    skipped_cur = 0
    used = 0
    for e in events.values():
        d = e["date"]
        if d[:7] == CUR_MONTH:            # текущий месяц не трогаем (по требованию Ивана)
            skipped_cur += 1
            continue
        arts = e["arts"] or ["—"]         # отправка без артикула -> псевдо «—» (нераспределённое)
        share = e["ship"] / len(arts)     # мультиартикульная отправка - делим поровну
        dshare = e["deliv"] / len(arts)
        used += 1
        permon[d[:7]] += e["ship"]
        permon_deliv[d[:7]] += e["deliv"]
        bystatus[e["st"] or "(пусто)"][0] += 1
        bystatus[e["st"] or "(пусто)"][1] += e["ship"]
        for art in arts:
            daily[(art, d)][0] += share
            daily[(art, d)][1] += dshare
            daily[(art, d)][2] += 1
            cities[art][e["city"]] += 1
    out = []
    for (offer, d), (ship, deliv, n) in sorted(daily.items()):
        out.append({"d": d, "offer": offer, "ship": round(ship, 2), "deliv": round(deliv, 2), "n": n})
    with open(OUT, "w", encoding="utf-8") as w:
        for o in out:
            w.write(json.dumps(o, ensure_ascii=False) + "\n")
    city_out = {off: c.most_common(12) for off, c in cities.items()}
    with open(OUT_CITY, "w", encoding="utf-8") as w:
        json.dump(city_out, w, ensure_ascii=False)
    print("OZON строк прочитано:", ozon, "| уник отправок (заказ+дата+сумма):", len(events), "| учтено:", used, "| пропущено (текущий месяц", CUR_MONTH, "):", skipped_cur)
    print("«Стоимость отправки» реальный расход по месяцам:", {k: round(v) for k, v in sorted(permon.items())})
    print("«Стоимость доставки» (клиент, ТОЛЬКО сверка) по месяцам:", {k: round(v) for k, v in sorted(permon_deliv.items())})
    print("строк (offer×день):", len(out), "| уник артикулов:", len(cities))
    print("Разбивка отправок по статусу (инфо, все идут в расчёт) - отправок | сумма:")
    for st, (c, s) in sorted(bystatus.items(), key=lambda x: -x[1][1]):
        print(f"    {st!r}: {c} | {s:,.0f}")
    print("записано:", OUT, "|", OUT_CITY)


if __name__ == "__main__":
    main()
