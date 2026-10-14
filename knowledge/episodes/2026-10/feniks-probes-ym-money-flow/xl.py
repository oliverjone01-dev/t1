# Блок «Движение денег» из перехваченной выгрузки Excel (sheet1.xml): строки от заголовка секции до следующей секции или конца.
# python3 -I xl.py <render.json> <месяц> [префикс секции, по умолчанию "7. Движение"]
import json, sys, re, html
d = json.load(open(sys.argv[1], encoding="utf-8"))
m = sys.argv[2]
pref = sys.argv[3] if len(sys.argv) > 3 else "7. Движение"
rec = d["months"][m]
print("exportError:", rec.get("exportError"))
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
    if first.startswith(pref):
        on = True
    elif on and re.match(r"^[0-9]+а?\. ", first):
        break
    if on:
        print(" | ".join(vals).rstrip(" |"))
print("всего строк листа:", len(out))
