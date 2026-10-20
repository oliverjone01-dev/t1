"""Проба (а3) iter2: раздел 5 на 49a7bf3 (iter1) против 299cc0c (iter2), одна копия data/.
Числа «01-14.10», «С 15.10», «Δ» на живых данных (окно 4 дня) должны совпасть; меняется только вид Δ (серый + причина)
и строка под таблицей. Остальные колонки - без изменений.
Запуск: python3 -I p_a3_iter1_vs_iter2.py <iter1.html> <iter2.html>
ФЕНИКС 2026-10-20, аудит PR #490 iter2."""
import sys, re, html as H


def sec5(path):
    with open(path, encoding="utf-8") as fh:
        s = fh.read()
    i = s.find('<summary class="sec">5. Цена')
    j = s.find("<table", i)
    k = s.find("</table>", j)
    t = s[j:k]
    heads = [re.sub(r"<[^>]+>", "", h).strip() for h in re.findall(r"<th[^>]*>(.*?)</th>", t, re.S)]
    rows = {}
    for tr in re.findall(r"<tr>(.*?)</tr>", t[t.find("<tbody>"):], re.S):
        tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        txt = [re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", "", x.replace('<div class="muted s">', " ~").replace("<br>", " | ")))).strip() for x in tds]
        a = txt[1].split(" ~")[0].strip()
        draw = tds[9]
        val = re.sub(r"<[^>]+>", "", re.search(r"<span[^>]*>(.*?)</span>", draw, re.S).group(1)) if "<span" in draw else draw.strip()
        gray = draw.startswith('<span class="muted"')
        note = (re.search(r'<div class="muted s">(.*?)</div>', draw, re.S) or [None, None])[1]
        rows[a] = {"txt": txt, "val": val, "gray": gray, "note": note}
    tail = s[k:k + 1500]
    m = re.search(r'</table></div><div class="muted s">(.*?)</div>', tail, re.S)
    return heads, rows, (m.group(1) if m else None)


h1, r1, l1 = sec5(sys.argv[1])
h2, r2, l2 = sec5(sys.argv[2])
print("iter1 шапка:", h1)
print("iter2 шапка:", h2)
print("строк:", len(r1), len(r2), "наборы артикулов равны:", set(r1) == set(r2))
same_num = diff_other = 0
notes = {}
for a in r1:
    x, y = r1[a], r2[a]
    if (x["txt"][7], x["txt"][8], x["val"]) == (y["txt"][7], y["txt"][8], y["val"]):
        same_num += 1
    else:
        print("  ЧИСЛА РАЗНЫЕ", a, (x["txt"][7], x["txt"][8], x["val"]), (y["txt"][7], y["txt"][8], y["val"]))
    others1 = [x["txt"][i] for i in (0, 2, 3, 4, 5, 6, 10, 11, 12)]
    others2 = [y["txt"][i] for i in (0, 2, 3, 4, 5, 6, 10, 11, 12)]
    if others1 != others2:
        diff_other += 1
        print("  ДРУГИЕ КОЛОНКИ РАЗНЫЕ", a, others1, others2)
    notes[y["note"]] = notes.get(y["note"], 0) + 1
print(f"01-14 / С 15.10 / Δ совпали: {same_num} из {len(r1)}; строк с отличием в других колонках: {diff_other}")
print("iter1 серых Δ:", sum(1 for v in r1.values() if v["gray"]), " iter2 серых Δ:", sum(1 for v in r2.values() if v["gray"]))
print("iter2 пометки Δ:", notes)
print("iter2 Δ серым со знаком «+» или «-» в ячейке:", sum(1 for v in r2.values() if v["gray"] and v["val"][:1] in "+-"),
      "из", sum(1 for v in r2.values() if v["gray"]), "(ненулевые)")
print("строка под таблицей iter1:", l1)
print("строка под таблицей iter2:", l2)
