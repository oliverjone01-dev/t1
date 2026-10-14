# Блок 3а из перехваченной выгрузки Excel (sheet1.xml): строки от «3а.» до «4.».
import json, sys, re, html
d = json.load(open(sys.argv[1], encoding="utf-8"))
m = sys.argv[2]
rec = d["months"][m]
print("exportError:", rec.get("exportError"), "files:", rec.get("xlsxFiles"))
x = rec.get("xlsxSheet") or ""
rows = re.findall(r"<row[^>]*>(.*?)</row>", x, re.S)
out = []
for r in rows:
    cells = re.findall(r"<c ([^>]*)>(.*?)</c>|<c ([^>]*)/>", r, re.S)
    vals = []
    for a, body, empty in cells:
        if empty:
            vals.append(""); continue
        t = re.search(r"<t[^>]*>(.*?)</t>", body, re.S)
        v = re.search(r"<v>(.*?)</v>", body, re.S)
        vals.append(html.unescape(t.group(1)) if t else (v.group(1) if v else ""))
    out.append(vals)
on = False
for vals in out:
    first = vals[0] if vals else ""
    if first.startswith("3а."):
        on = True
    elif on and re.match(r"^4\.", first):
        break
    if on:
        print(" | ".join(vals))
print("всего строк листа:", len(out))
print("пометки в листе (выписк|не свер|ГИПОТЕЗ|в пути|платёжк):", [v for vals in out for v in vals if re.search(r"выписк|не свер|ГИПОТЕЗ|платёжк|не обновил", v, re.I)][:6])
