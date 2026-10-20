"""Проба iter3: раздел 5 «Цена» на трёх сборках.
  (a) код головы 46cd4bf + data/ головы; (b) код 299cc0c + data/ головы; (c) код 299cc0c + data/ на 74a3280 (данные iter2).
a = b: слияние main не изменило страницу. Раздел 5 в b = c: новые снимки 4641e9d раздел 5 не задели.
Страница режется на зоны: шапка до раздела 1, разделы 1-4 вкладки «План», раздел 5 (от <details class="pt-sec"> до его </details>),
«Как считаем» вкладки, остальная страница (карточки тестов). Отдельно - скрипт данных вкладки «План» (window.PD, в нём price_st).
Для зон, где b и c разошлись, - примеры отличий по токенам.
Запуск: python3 -I p_sec5_compare_iter3.py <a.html> <b.html> <c.html>
ФЕНИКС 2026-10-20, PR #490 iter3 (подтверждение хеша)."""
import sys, re, json, hashlib, difflib, html as H

MARK = '<summary class="sec">'
PD_OPEN = "<" + "script>window.PD="
PD_CLOSE = "<" + "/script>"


def load(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


def zones(s):
    s1 = s.find(MARK + "1. ")
    i5 = s.find('<details class="pt-sec">' + MARK + "5. Цена")
    assert s1 >= 0 and i5 >= 0, "нет раздела 1 или 5"
    te = s.find("</table>", s.find("<table", i5))
    e1 = s.find("</details>", te)              # конец свёртки «Все 29 артикулов»
    e5 = s.find("</details>", e1 + 10) + 10     # конец раздела 5
    k = s.find("<summary>Как считаем</summary>", e5)
    ke = s.find("</details>", k) + 10
    ke = s.find("</details>", ke) + 10          # конец вкладки «План»
    return {"шапка до раздела 1": (0, s1), "разделы 1-4": (s1, i5), "раздел 5": (i5, e5),
            "Как считаем (вкладка План)": (e5, ke), "остальная страница (тесты)": (ke, len(s))}


def pd_script(s):
    i = s.find(PD_OPEN)
    return s[i:s.find(PD_CLOSE, i)] if i >= 0 else None


def cell(x):
    x = x.replace('<div class="muted s">', " ~").replace("<br>", " | ")
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", "", x))).strip()


def table(s):
    i = s.find(MARK + "5. Цена")
    j = s.find("<table", i)
    k = s.find("</table>", j)
    t = s[j:k]
    heads = [re.sub(r"<[^>]+>", "", h).strip() for h in re.findall(r"<th[^>]*>(.*?)</th>", t, re.S)]
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", t[t.find("<tbody>"):], re.S):
        tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        draw = tds[9]
        if draw.strip() == "-":
            kind = "dash"
        elif draw.startswith('<span class="muted"'):
            kind = "gray"
        else:
            col = (re.search(r"color:([^\"]+)\"", draw) or [None, "?"])[1]
            kind = {"#34D399": "green", "#FF7A7E": "red", "inherit": "inherit"}.get(col, "?" + col)
        rows.append([cell(x) for x in tds] + [kind])
    m = re.search(r'</table></div><div class="muted s">(.*?)</div>', s[k:k + 1500], re.S)
    store = H.unescape(m.group(1)).strip() if m else None
    sm = re.search(re.escape(MARK) + r"5\. Цена ([0-9]+) артикулов", s)
    pm = re.search(r'"price_st":(\{[^}]*\})', s)
    return heads, rows, store, (sm.group(1) if sm else None), (json.loads(pm.group(1)) if pm else None)


A, B, C = (load(p) for p in sys.argv[1:4])
md5 = lambda x: hashlib.md5(x.encode("utf-8")).hexdigest()
print(f"страница целиком: a == b {A == B}; b == c {B == C}; байт a={len(A.encode())} b={len(B.encode())} c={len(C.encode())}")
ZA, ZB, ZC = zones(A), zones(B), zones(C)
print("\nзона | байт a / b / c | a == b | b == c | md5 b")
for z in ZA:
    xa, xb, xc = A[slice(*ZA[z])], B[slice(*ZB[z])], C[slice(*ZC[z])]
    print(f"  {z:28s} | {len(xa.encode())} / {len(xb.encode())} / {len(xc.encode())} | {xa == xb} | {xb == xc} | {md5(xb)}")
PA, PB, PC = pd_script(A), pd_script(B), pd_script(C)
print(f"  данные вкладки «План» (window.PD, в нём price_st): байт {len(PB.encode()) if PB else None} | a == b {PA == PB} | b == c {PB == PC}")

hd, rows, store, n, pst = table(A)
hc, rc, storec, nc, pstc = table(C)
print(f"\nшапка (a): {hd}")
print(f"строк: {len(rows)} (c: {len(rc)}); в заголовке раздела: {n} артикулов")
print(f"плашки price_st: a {pst}; c {pstc}; равны {pst == pstc}")
st = {}
for r in rows:
    key = r[6] if r[6].startswith(("не ", "по плану")) else r[6].split(":")[0].split(" ")[0]
    st[key] = st.get(key, 0) + 1
print(f"статусы по строкам (a, сгруппировано): {st}")
kinds, notes = {}, {}
for r in rows:
    kinds[r[-1]] = kinds.get(r[-1], 0) + 1
    nt = r[9].split(" ~")[1].strip() if " ~" in r[9] else None
    notes[nt] = notes.get(nt, 0) + 1
print(f"Δ (a): {kinds}; пометки: {notes}")
print(f"сумма «Заказы 01-14.10» = {sum(int(r[7]) for r in rows)}, сумма «С 15.10» = {sum(int(r[8]) for r in rows if r[8].isdigit())}")
print(f"строки a и c по ячейкам равны: {[r[:-1] for r in rows] == [r[:-1] for r in rc]}; вид Δ равен: {[r[-1] for r in rows] == [r[-1] for r in rc]}")
print(f"строка магазина (a): «{store}»; равна c: {store == storec}")
print("\nартикул | статус | 01-14 | с 15.10 | Δ (вид)")
for r in rows:
    print(f"  {r[1].split(' ~')[0].strip():22s} | {r[6]:28s} | {r[7]:>2s} | {r[8]:>2s} | {r[9].split(' ~')[0]:>5s} ({r[-1]})")

print("\nгде b и c разошлись (код один, данные разные): примеры по токенам")
tok = lambda s: re.findall(r"\d+(?:[.,]\d+)?|[^\d]+", s)
for z in ZB:
    xb, xc = B[slice(*ZB[z])], C[slice(*ZC[z])]
    if xb == xc:
        continue
    p = 0
    while p < min(len(xb), len(xc)) and xb[p] == xc[p]:
        p += 1
    q = 0
    while q < min(len(xb), len(xc)) - p and xb[len(xb) - 1 - q] == xc[len(xc) - 1 - q]:
        q += 1
    tb, tc = tok(xb[p:len(xb) - q]), tok(xc[p:len(xc) - q])
    ops = [o for o in difflib.SequenceMatcher(None, tb, tc, autojunk=False).get_opcodes() if o[0] != "equal"]
    print(f"  [{z}] отличий: {len(ops)}")
    pos = [0]
    for t in tb:
        pos.append(pos[-1] + len(t))
    for tag, i1, i2, j1, j2 in ops[:12]:
        at = p + pos[i1]
        ctx = re.sub(r"<[^>]+>", " ", xb[max(0, at - 160):at])
        ctx = re.sub(r"\s+", " ", ctx)[-90:]
        print(f"     b «{''.join(tb[i1:i2])[:60]}» c «{''.join(tc[j1:j2])[:60]}» | ...{ctx}")
    if len(ops) > 12:
        print(f"     ... ещё {len(ops) - 12}")
