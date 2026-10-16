#!/usr/bin/env python3
"""Переносит таблицы из istoriya-output.md и boost-primery-output.md в один Excel-файл.
Ничего не пересчитывает: ячейка = ячейка таблицы, только числа становятся числами,
а составные ячейки («79 350 / 43 836 / 49%», «8.8% (8.8%-14.0%)») разбиты на колонки.
Запуск: python3 -I excel.py <папка со скриптами> <выход.xlsx>
"""
import re
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
FONT = "Arial"
HEAD_FILL = PatternFill("solid", fgColor="DDE4EE")
NOTE_FILL = PatternFill("solid", fgColor="FFF7D6")
NUM_RE = re.compile(r"^[+-]?\d[\d ]*(?:\.\d+)?$")
PCT_RE = re.compile(r"^[+-]?\d[\d ]*(?:\.\d+)?%$")


def conv(s):
    """Строка таблицы -> (значение, формат). Текст остаётся текстом."""
    s = (s or "").strip()
    if s == "":
        return None, None
    if s in ("-", "н/д"):
        return s, None
    if PCT_RE.match(s):
        return round(float(s[:-1].replace(" ", "")) / 100, 6), "0.0%"
    if NUM_RE.match(s):
        v = float(s.replace(" ", ""))
        return (int(v) if v == int(v) else v), ("#,##0" if v == int(v) else "#,##0.0")
    return s, None


def md_tables(text):
    """Все markdown-таблицы файла: {заголовок секции: [строки]} в порядке появления."""
    out, cur_h, cur = [], None, []
    for line in text.splitlines():
        if line.startswith("#"):
            if cur:
                out.append((cur_h, cur))
            cur_h, cur = line.lstrip("#").strip(), []
        elif "|" in line:
            cells = [c.strip() for c in line.split("|")]
            if all(set(c) <= set("-:") for c in cells if c):
                continue  # строка-разделитель markdown
            cur.append(cells)
        elif cur:
            out.append((cur_h, cur))
            cur = []
    if cur:
        out.append((cur_h, cur))
    return out


def write_table(ws, rows, start_row=1, split=None, note=None, text_cols=()):
    """rows: список списков строк (первая - шапка). split: {имя колонки: (новые имена, функция)}."""
    head = rows[0]
    new_head, mapping = [], []
    for i, h in enumerate(head):
        if split and h in split:
            names, fn = split[h]
            new_head += names
            mapping.append((i, fn, len(names)))
        else:
            new_head.append(h)
            mapping.append((i, None, 1))
    r = start_row
    if note:
        ws.cell(r, 1, note).font = Font(name=FONT, italic=True, size=9)
        ws.cell(r, 1).fill = NOTE_FILL
        ws.cell(r, 1).alignment = Alignment(wrap_text=True, vertical="top")
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=max(len(new_head), 6))
        ws.row_dimensions[r].height = 15 * (1 + len(note) // 140)
        r += 1
    for j, h in enumerate(new_head, 1):
        c = ws.cell(r, j, h)
        c.font = Font(name=FONT, bold=True, size=10)
        c.fill = HEAD_FILL
        c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[r].height = 42
    head_row = r
    for row in rows[1:]:
        r += 1
        j = 1
        for i, fn, n in mapping:
            raw = row[i] if i < len(row) else ""
            parts = fn(raw) if fn else [raw]
            for p in parts:
                v, fmt = (p, None) if head[i] in text_cols else conv(p)
                c = ws.cell(r, j, v)
                c.font = Font(name=FONT, size=10)
                if fmt:
                    c.number_format = fmt
                j += 1
    return head_row, r


def autosize(ws, maxw=28):
    widths = {}
    for row in ws.iter_rows():
        for c in row:
            if c.value is None or type(c).__name__ == "MergedCell":
                continue
            l = len(str(c.value)) if not isinstance(c.value, float) else 8
            widths[c.column] = max(widths.get(c.column, 0), min(l, maxw))
    for col, w in widths.items():
        ws.column_dimensions[get_column_letter(col)].width = max(8, w + 2)


# разбиение составных ячеек
def split_price(s):
    """'79 350 / 43 836 / 49%' -> три части; '-' -> три '-'."""
    s = s.strip()
    if s in ("-", ""):
        return ["-", "-", "-"]
    parts = [p.strip() for p in s.split("/")]
    return parts if len(parts) == 3 else [s, "", ""]


def split_catalog(s):
    """'121 900 -> 95 650' -> две части."""
    parts = [p.strip() for p in s.split("->")]
    return parts if len(parts) == 2 else [s, ""]


def split_rate(s):
    """'8.8% (8.8%-14.0%)' -> медиана, мин, макс; '-' / 'нет буста' -> текст в медиане."""
    m = re.match(r"^([\d.]+%) \(([\d.]+%)-([\d.]+%)\)$", s.strip())
    if m:
        return [m.group(1), m.group(2), m.group(3)]
    return [s.strip(), "", ""]


def split_range(s):
    """'49%-55%' -> две части."""
    m = re.match(r"^([\d.]+%)-([\d.]+%)$", s.strip())
    return [m.group(1), m.group(2)] if m else [s, ""]


ist = (SRC / "istoriya-output.md").read_text(encoding="utf-8")
bst = (SRC / "boost-primery-output.md").read_text(encoding="utf-8")
T_ist = md_tables(ist)
T_bst = md_tables(bst)

wb = Workbook()
ws0 = wb.active
ws0.title = "Как читать"

# ---------- Лист 1. Инструменты по месяцам
ws = wb.create_sheet("1 Инструменты по мес")
rows = next(t for h, t in T_ist if h.startswith("1."))
_, last = write_table(ws, rows, note="Какие рекламные инструменты работали в каждом месяце и на каком кабинете. Баллы - из отчёта Маркета по баллам, деньги - из реестра взаиморасчётов. «Из них с бустом» - доля доставленных заказов, за которые списан буст.")
m = re.search(r"Прочие списания баллов за всё время: (\{.*\})", ist)
if m:
    r = last + 2
    ws.cell(r, 1, "Прочие списания баллов за всё время (не реклама)").font = Font(name=FONT, bold=True, size=10)
    for k, v in re.findall(r"'([^']+)': '([^']+)'", m.group(1)):
        r += 1
        ws.cell(r, 1, k).font = Font(name=FONT, size=10)
        val, fmt = conv(v)
        c = ws.cell(r, 2, val)
        c.font = Font(name=FONT, size=10)
        c.number_format = fmt
ws.freeze_panes = "C3"
autosize(ws)

# ---------- Лист 2. Ставки по неделям
ws = wb.create_sheet("2 Ставки по неделям")
rows = next(t for h, t in T_ist if h.startswith("2."))
rows[0] = ["Товар"] + ["нед. с " + d for d in rows[0][1:]]
write_table(ws, rows, note="Какая ставка буста была списана с доставленных заказов по неделям создания заказа. «9%-14% (3)» = в эту неделю 3 заказа, ставки от 9% до 14%. Пусто = доставленных заказов в неделю не было. Ставка кабинета читается по списаниям, это [ГИПОТЕЗА].")
ws.freeze_panes = "B3"
autosize(ws, maxw=16)
ws.column_dimensions["A"].width = 22

# ---------- Лист 3. Смены ставки (список -> строки)
ws = wb.create_sheet("3 Смены ставки")
rows = [["Товар", "№ по порядку", "ставка", "первый заказ с этой ставкой", "последний заказ с этой ставкой", "заказов с этой ставкой"]]
sec = ist.split("Смены ставки по товарам")[1].split("Товары с 2+ доставками")[0]
for line in sec.splitlines():
    if not line.startswith("- "):
        continue
    sku, chain = line[2:].split(":", 1)
    for n, step in enumerate(chain.split("->"), 1):
        m = re.match(r"\s*([\d.]+%) \(([\d.]+)(?:-([\d.]+))?, (\d+)\)", step)
        if m:
            d1, d2 = m.group(2), m.group(3) or m.group(2)
            rows.append([sku.strip(), str(n), m.group(1), "2026-" + d1.replace(".", "-"), "2026-" + d2.replace(".", "-"), m.group(4)])
write_table(ws, rows, note="Та же история ставок, но списком: каждая строка - одно значение ставки (округлено до 0,1%), с какого по какой день заказы шли с ней и сколько их было. Важно: это СПИСАННАЯ ставка, а не выставленная. Буст Маркета работает по правилу второго аукциона: списывается не ваша ставка, а столько, сколько нужно, чтобы обойти соседа, но не больше вашего потолка. Поэтому разброс значений внутри товара - это аукцион, а не ручные смены. Ручное изменение доказано только там, где списание превысило прежний максимум (потолок подняли).")
r = ws.max_row + 2
m = re.search(r"Товары с 2\+ доставками в месяце и без буста вообще.*?: (\{.*\})", ist)
if m:
    ws.cell(r, 1, "Товары с 2+ доставками в месяце и без буста вообще: " + m.group(1).replace("'", "")).font = Font(name=FONT, size=10)
ws.freeze_panes = "A3"
autosize(ws)

# ---------- Лист 4. Цены по месяцам
ws = wb.create_sheet("4 Цены по месяцам")
rows = next(t for h, t in T_ist if h.startswith("3."))
split = {}
for h in rows[0][1:]:
    if "карточка / покупатель" in h:
        mo = h.split(":")[0]
        split[h] = ([f"{mo} цена карточки", f"{mo} платит покупатель", f"{mo} скидка Маркета"], split_price)
    elif "каталог" in h:
        split[h] = (["каталог 16.10: цена до скидки продавца", "каталог 16.10: цена"], split_catalog)
write_table(ws, rows, split=split, note="Медианы по доставленным заказам: цена карточки, сколько покупатель заплатил деньгами и скидка Маркета в % от цены карточки. Топ-10 товаров по бусту. «-» = в этом месяце доставок не было. Последние две колонки - из каталога на 16.10.")
ws.freeze_panes = "B3"
autosize(ws, maxw=14)
ws.column_dimensions["A"].width = 22

# ---------- Лист 5. Скидка по месяцам
ws = wb.create_sheet("5 Скидка по месяцам")
rows = next(t for h, t in T_ist if h.startswith("4.1"))
split = {"мин-макс (10-90 перцентиль)": (["10-й перцентиль", "90-й перцентиль"], split_range)}
write_table(ws, rows, split=split, note="Скидка Маркета - баллы покупателю за счёт Маркета; продавцу эта сумма возвращается баллами, и ими списываются размещение (комиссия) и буст. Все проценты - от цены карточки, медиана по доставленным заказам месяца. «Скидка минус размещение» - запас баллов сверх комиссии, он и уходит на буст.")
ws.freeze_panes = "C3"
autosize(ws)

# ---------- Лист 6. Скидка по цене
ws = wb.create_sheet("6 Скидка по цене")
rows = next(t for h, t in T_ist if h.startswith("4.2"))
split = {"10-90 перцентиль": (["10-й перцентиль", "90-й перцентиль"], split_range)}
_, last = write_table(ws, rows, split=split, note="Зависит ли скидка Маркета от цены карточки: все доставленные заказы июль-октябрь, разбиты по ценовым полкам. Монотонности нет: по полкам 20-40, 40-60, 60-90, 90+ тыс. скидка одинаковая, 52-56%.")
m = re.search(r"заказов (\d+) в (\d+) товарах; корреляция «ставка выше среднего -> скидка Маркета выше среднего»: ([\d.]+); «цена карточки выше среднего -> скидка Маркета выше»: ([\d.]+)", ist)
if m:
    r = last + 2
    ws.cell(r, 1, "Связь внутри одного товара (отклонения от среднего по товару; товары с 5+ доставками июль-октябрь)").font = Font(name=FONT, bold=True, size=10)
    for i, (k, v, fmt) in enumerate([
        ("заказов в расчёте", int(m.group(1)), "#,##0"),
        ("товаров в расчёте", int(m.group(2)), "#,##0"),
        ("корреляция: ставка буста выше среднего -> скидка Маркета выше среднего", float(m.group(3)), "0.00"),
        ("корреляция: цена карточки выше среднего -> скидка Маркета выше", float(m.group(4)), "0.00"),
        ("как читать корреляцию", "0 = связи нет, 1 = полная связь; 0,36 - слабая, 0,14 - почти нет", None),
    ], 1):
        ws.cell(r + i, 1, k).font = Font(name=FONT, size=10)
        c = ws.cell(r + i, 2, v)
        c.font = Font(name=FONT, size=10)
        if fmt:
            c.number_format = fmt
ws.freeze_panes = "B3"
autosize(ws)
ws.column_dimensions["A"].width = 60

# ---------- Лист 7. Скидка внутри товара
ws = wb.create_sheet("7 Скидка внутри товара")
rows = next(t for h, t in T_ist if h.startswith("4.4"))
write_table(ws, rows, note="Медиана скидки Маркета по месяцам внутри одного товара (топ-10 по бусту). «Размах» - разница между максимумом и минимумом по месяцам: у большинства скидка плавает на 6-12 пунктов, у GGL-07-XL-2 стабильна.")
ws.freeze_panes = "B3"
autosize(ws)
ws.column_dimensions["A"].width = 22

# ---------- Лист 8. Пример заказа
ws = wb.create_sheet("8 Пример заказа")
sec = ist.split("### 4.5")[1].split("\n\n")[0]
nums = {
    "цена карточки": r"цена карточки ([\d ]+);",
    "покупатель заплатил деньгами": r"покупатель заплатил деньгами ([\d ]+) \(([\d.]+)%\)",
    "скидка Маркета (пришла продавцу баллами)": r"скидка Маркета ([\d ]+) \(([\d.]+)%\)",
    "баллами списано: размещение (комиссия)": r"размещение ([\d ]+) \(([\d.]+)%\)",
    "баллами списано: буст": r"буст ([\d ]+); деньгами",
    "деньгами удержано: буст": r"деньгами удержано: буст ([\d ]+)",
    "деньгами удержано: перевод платежа": r"перевод платежа ([\d ]+) \+ ([\d ]+)\.",
    "итого деньгами продавцу (около)": r"деньгами продавцу около ([\d ]+)",
    "себестоимость": r"себестоимости ([\d ]+)",
}
rows = [["статья", "сумма, ₽", "% от цены карточки", "кошелёк"]]
wallet = {"цена карточки": "", "покупатель заплатил деньгами": "деньги", "скидка Маркета (пришла продавцу баллами)": "баллы",
          "баллами списано: размещение (комиссия)": "баллы", "баллами списано: буст": "баллы", "деньгами удержано: буст": "деньги",
          "деньгами удержано: перевод платежа": "деньги", "итого деньгами продавцу (около)": "деньги", "себестоимость": "деньги"}
for k, pat in nums.items():
    m = re.search(pat, sec)
    if not m:
        continue
    g = m.groups()
    if k == "деньгами удержано: перевод платежа":
        amount = str(int(g[0].replace(" ", "")) + int(g[1].replace(" ", "")))
        pct = ""
    else:
        amount = g[0]
        pct = (g[1] + "%") if len(g) > 1 and g[1] else ""
    rows.append([k, amount, pct, wallet[k]])
write_table(ws, rows, note="Один заказ KONUX 5-1 (62710061827 от 05.10) по строкам реестра: как цена карточки раскладывается на деньги покупателя и скидку Маркета, и что из этого Маркет списывает баллами, а что деньгами. Перевод платежа = 2 709 + 126.")
ws.freeze_panes = "A3"
autosize(ws)
ws.column_dimensions["A"].width = 44

# ---------- Лист 9. Буст по товарам (6 SKU, по месяцам, длинный формат)
ws = wb.create_sheet("9 Буст по товарам")
sku_tables, seen = [], set()
for h, t in T_bst:  # первая таблица секции товара - по месяцам; окна и дни 5-1 идут на лист 10
    if h.startswith("GG") and h not in seen:
        seen.add(h)
        sku_tables.append((h, t))
rate_split = {"ставка списанная, медиана (мин-макс)": (["ставка списанная, медиана", "ставка мин", "ставка макс"], split_rate)}
long_rows = None
desc_rows = [["Товар", "название", "кабинет", "цена в каталоге 15.10", "остаток", "себестоимость за шт", "вывод в заголовке"]]
for h, t in sku_tables:
    sku, title = h.split(" - ", 1)
    sku = sku.strip()
    # описание под заголовком
    blk = [l for l in bst.split("## " + h)[1].split("\n\n")[0].splitlines() if l.strip()]
    desc = blk[0] if blk else ""
    md = re.match(r"(.*?); кабинет (\w+); цена в каталоге 15\.10 ([\d ]+), остаток (\S+), себестоимость за шт ([\d ]+)", desc)
    desc_rows.append([sku, md.group(1) if md else desc, md.group(2) if md else "", md.group(3) if md else "", (md.group(4) if md.group(4) != "None" else "н/д") if md else "", md.group(5) if md else "", title.strip()])
    monthly = t  # первая таблица секции - по месяцам
    if long_rows is None:
        long_rows = [["Товар"] + monthly[0]]
    for row in monthly[1:]:
        long_rows.append([sku] + row)
_, last = write_table(ws, long_rows, split=rate_split, note="Шесть товаров-примеров по месяцам: заказы, ставка, расход на буст (всего и из него деньгами), выручка по цене карточки, живые деньги покупателей, скидка Маркета, себестоимость, ДРР (буст / выручка по цене карточки), CPO (буст / доставлено), показы и корзина из отчёта показов (есть только с 31.08; «0*» = окно обрезано по 31.08; н/д = отчёта не было). Октябрь не закрыт.")
r = last + 2
ws.cell(r, 1, "Карточки товаров").font = Font(name=FONT, bold=True, size=10)
write_table(ws, desc_rows, start_row=r + 1)
ws.freeze_panes = "C3"
autosize(ws, maxw=18)
ws.column_dimensions["A"].width = 22

# ---------- Лист 10. 5-1 по окнам ставки и по дням
ws = wb.create_sheet("10 KONUX 5-1 детально")
win_tables = [t for h, t in T_bst if h.startswith("GGT-35-5-1")]
# в секции 5-1 три таблицы: по месяцам, по окнам ставки, по дням
sec51 = bst.split("## GGT-35-5-1")[1].split("\n## ")[0]
tabs51 = md_tables("## x\n" + sec51)
tabs51 = [t for _, t in tabs51]
win = tabs51[1]
days = tabs51[2]
win[0][0] = "окно смены ставки"
_, last = write_table(ws, win, split=rate_split, note="KONUX 5-1 по окнам смены ставки (из списаний): до 13.09 буста нет; 13-30.09 ставка 8,8%; с 02.10 13-19%. Ставка и цена для покупателя менялись одновременно, поэтому эффект ставки от эффекта цены по данным не разделить.")
r = last + 2
ws.cell(r, 1, "По дням, октябрь: показы, в карточку, в корзину - из отчёта показов Маркета; создано заказов и буст по доставленным - наши данные").font = Font(name=FONT, bold=True, size=10)
days[0][0] = "день (октябрь)"
write_table(ws, days, start_row=r + 1, text_cols=("ставки",))
ws.freeze_panes = "B3"
autosize(ws, maxw=18)
ws.column_dimensions["A"].width = 26

# ---------- Лист 11. Сверка буста
ws = wb.create_sheet("11 Сверка буста")
rows = next(t for h, t in T_bst if h.startswith("Сверка"))
write_table(ws, rows, note="Проверка, что буст посчитан правильно: сумма буста из реестра взаиморасчётов (баллы + деньги) против отчёта Маркета «Буст» по месяцу проводки. Две разные семьи источников. Разница 0 - сошлось до рубля; октябрь зеркала -33 ₽ при 85,6 тыс.; за июль по зеркалам отчёта Маркета нет.")
ws.freeze_panes = "C3"
autosize(ws)

# ---------- Лист 0. Как читать
guide = [
    ("Что это", "История действий в рекламе Яндекс Маркета, восстановленная по статистике (записей сотрудника нет), и закономерности скидки Маркета. Кабинеты: зеркала 1023124, мебель 74986385. Данные по 15.10.2026, снимок 16.10."),
    ("Откуда цифры", "Выгрузка заказов, реестр взаиморасчётов, отчёт по баллам, отчёт показов (с 31.08), отчёт Маркета «Буст», каталог, себестоимость (analytics-mvp/data-ym). Все цифры [ДАННЫЕ]. Одно допущение: ставку кабинета читаем по списаниям буста (повторы одного значения) - это [ГИПОТЕЗА]."),
    ("Чего в данных нет", "Кто и когда нажимал кнопки; текущие ставки по товарам без продаж; стратегия, акции, кампании показов - только кабинет (П10)."),
    ("Как устроены деньги и баллы", "Покупатель платит деньгами меньше цены карточки, разницу (скидку Маркета) Маркет доплачивает продавцу баллами. Этими баллами Маркет списывает размещение (комиссия 42-49% от цены) и буст. Деньгами продавцу остаётся примерно то, что заплатил покупатель. Лист 8 - пример на одном заказе."),
    ("", ""),
    ("Лист 1 Инструменты по мес", "Какие инструменты работали в каждом месяце: буст всегда (75-100% доставленных с бустом), показы и полки - мелкие суммы и только мебель; полки остановлены 30.09."),
    ("Лист 2 Ставки по неделям", "Списанная ставка буста по 14 товарам по неделям. Списанная не равна выставленной: буст идёт по второму аукциону, Маркет списывает столько, сколько нужно против соседа, но не выше потолка. Разброс внутри товара - аукцион. Потолок виден как повторяющийся максимум (KONUX 14%, зеркала 30%, OSOLIS 11,6%). Доказанные ручные изменения - только рост потолка: 5-1 с 8,8% до 14% (16.09) и до 19% (02-03.10), KONUX 1-3 ступенями с 7% до 14% за июль-сентябрь, зеркала до 30% в июле."),
    ("Лист 3 Смены ставки", "То же списком: каждое значение списанной ставки отдельной строкой с датами и числом заказов. Смена значения не равна смене ставки руками (см. правило второго аукциона на листе)."),
    ("Лист 4 Цены по месяцам", "Цены карточек подняли летом (KONUX 73-79 -> 95,6 тыс.), покупатель платил почти столько же (41-44 тыс.): разницу съела скидка Маркета, выросла с 49% до 57-60%."),
    ("Лист 5 Скидка по месяцам", "Скидка Маркета выросла: медиана 42% (мебель) / 52% (зеркала) в мае-июне -> 55-60% в сентябре-октябре. Без скидки заказов нет. Запас «скидка минус размещение» вырос с +1% до +8-12% - он и уходит на буст."),
    ("Лист 6 Скидка по цене", "От цены карточки скидка почти не зависит (по полкам 52-56%). Внутри товара связь со ставкой буста слабая (0,36), с ценой почти нет (0,14)."),
    ("Лист 7 Скидка внутри товара", "Внутри одного товара скидка плавает на 6-12 пунктов между месяцами; GGL-07-XL-2 стабильна 57-58%."),
    ("Лист 8 Пример заказа", "Один заказ 5-1 от 05.10 по статьям: цена 96 763, покупатель 40 069 деньгами, скидка 56 694 баллами, размещение 46 446 и буст 18 182 баллами, деньгами продавцу около 37 050 при себестоимости 16 933."),
    ("Лист 9 Буст по товарам", "Шесть товаров-примеров по месяцам: что платим за буст и что получаем (заказы, ДРР, CPO, показы, корзина, конверсии)."),
    ("Лист 10 KONUX 5-1 детально", "5-1 по окнам смены ставки (без буста / 8,8% / 13-19%) и по дням октября."),
    ("Лист 11 Сверка буста", "Буст из реестра против отчёта Маркета «Буст»: сошлось до рубля по всем месяцам и кабинетам."),
    ("", ""),
    ("Обозначения", "«-» = в этом периоде событий не было; «н/д» = источника за период нет; «0*» = отчёт показов начинается 31.08, окно обрезано. Проценты от цены карточки, если не сказано иначе. ДРР = буст / выручка доставленных по цене карточки. CPO = буст / доставлено."),
    ("Источник таблиц", "knowledge/episodes/2026-10/ym-reklama-scripts/istoriya-output.md и boost-primery-output.md (скрипты istoriya.py, boost-primery.py). Этот файл собран скриптом excel.py без пересчёта."),
]
ws0.cell(1, 1, "Реклама Яндекс Маркета: история действий по статистике и скидка Маркета (данные по 15.10.2026)").font = Font(name=FONT, bold=True, size=12)
for i, (k, v) in enumerate(guide, 3):
    a = ws0.cell(i, 1, k)
    a.font = Font(name=FONT, bold=True, size=10)
    a.alignment = Alignment(vertical="top")
    b = ws0.cell(i, 2, v)
    b.font = Font(name=FONT, size=10)
    b.alignment = Alignment(wrap_text=True, vertical="top")
    if v:
        ws0.row_dimensions[i].height = 15 * (1 + len(v) // 95)
ws0.column_dimensions["A"].width = 30
ws0.column_dimensions["B"].width = 100

wb.save(OUT)
print("ok", OUT, [ws.title for ws in wb.worksheets])
