"""Проба (а): раздел 5 «Цена» на голове 49a7bf3 против базы 74a3280, одна копия data/.
Запуск: python3 -I p_a_build_compare.py <head.html> <base.html>
Печатает: число строк, заголовки, price_st (плашки), сверку статусов и «Скидка OZON» по артикулам, смены цены.
ФЕНИКС 2026-10-20, аудит PR #490."""
import sys, re, json, html as H


def sec5(path):
    s = open(path, encoding="utf-8").read()
    i = s.find('<summary class="sec">5. Цена')
    assert i >= 0, "нет раздела 5"
    j = s.find("<table", i)
    k = s.find("</table>", j)
    t = s[j:k]
    heads = [re.sub(r"<[^>]+>", "", h).strip() for h in re.findall(r"<th[^>]*>(.*?)</th>", t, re.S)]
    titles = re.findall(r'<th[^>]*title="([^"]*)"', t)
    body = t[t.find("<tbody>"):]
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", body, re.S):
        tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        cells = []
        for x in tds:
            x = x.replace('<div class="muted s">', " ~").replace("<br>", " | ")
            x = re.sub(r"<[^>]+>", "", x)
            cells.append(re.sub(r"\s+", " ", H.unescape(x)).strip())
        rows.append(cells)
    m = re.search(r'"price_st":(\{[^}]*\})', s)
    pst = json.loads(m.group(1)) if m else None
    sm = re.search(r'<summary class="sec">5\. Цена ([0-9]+) артикулов', s)
    return heads, titles, rows, pst, (sm.group(1) if sm else None)


def art(r):
    return r[1].split(" ~")[0].strip()


hH, tH, rH, pH, nH = sec5(sys.argv[1])
hB, tB, rB, pB, nB = sec5(sys.argv[2])
print("HEAD heads:", hH)
print("BASE heads:", hB)
print("HEAD th titles:")
for x in tH:
    print("   ", x)
print(f"rows head={len(rH)} base={len(rB)}  summary N head={nH} base={nB}")
print("price_st head:", pH)
print("price_st base:", pB, "-> equal:", pH == pB)
date_cols = [h for h in hH if re.fullmatch(r"\d\d\.\d\d", h)]
print("date-like header cols on head:", date_cols)
B = {art(r): r for r in rB}
Hd = {art(r): r for r in rH}
print("arts equal sets:", set(B) == set(Hd), len(set(B)), len(set(Hd)))
mism = 0
for a, rh in Hd.items():
    rb = B[a]
    # head: 0 С,1 Арт,2 14.10,3 Смены,4 Сейчас,5 Целевая,6 Статус,7 З01-14,8 С15,9 Д,10 Ск14,11 Ск сейчас,12 чип
    hs = (rh[0], rh[4], rh[5], rh[6], rh[10], rh[11], rh[12])
    bs = (rb[0], rb[-6], rb[-5], rb[-4], rb[-3], rb[-2], rb[-1])
    if hs != bs:
        mism += 1
        print("MISMATCH", a, hs, bs)
    if rh[2] != rb[2]:
        mism += 1
        print("MISMATCH 14.10", a, rh[2], rb[2])
print("status/discount/now/target/14.10 mismatches:", mism)
print("\nHEAD table (арт | 14.10 | смены | сейчас | статус | з01-14 | с15 | дельта):")
for r in rH:
    print("  " + " | ".join([art(r).ljust(22), r[2].rjust(7), r[3].ljust(34), r[4].rjust(16), r[6].ljust(28), r[7].rjust(3), r[8].rjust(3), r[9].rjust(5)]))
nochg = [art(r) for r in rH if r[3] == "без смен"]
print("без смен:", len(nochg), nochg)
print("GGR-11-1 смены:", Hd.get("GGR-11-1", ["?"] * 4)[3])
print("\nBASE date columns:", [h for h in hB if re.fullmatch(r"\d\d\.\d\d", h)])
print("\nBASE table (арт | даты... ):")
idx = [i for i, h in enumerate(hB) if re.fullmatch(r"\d\d\.\d\d", h)]
for r in rB:
    print("  " + art(r).ljust(22) + " | " + " | ".join(r[i].rjust(7) for i in idx))
