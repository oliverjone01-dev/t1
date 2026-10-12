import re, html as H, sys
for path in sys.argv[1:]:
    h = open(path, encoding="utf-8").read()
    print("#####", path.split("/")[-2])
    for m in re.finditer(r'<div class="(remind[^"]*)">(.*?)</div>', h, re.S):
        if "Тест 4" in m.group(2):
            print("REMIND", m.group(1), "::", H.unescape(re.sub('<[^>]+>', '', m.group(2)))[:700])
            break
    s = re.split(r'(?=<section)', h)[4]
    chips = re.findall(r'<span class="(chip[^"]*)">(.*?)</span>', s, re.S)
    print("CHIP", chips[0][0], "::", H.unescape(re.sub('<[^>]+>', '', chips[0][1])))
    v = re.search(r'<div class="verdict">.*?</table>', s, re.S)
    t = re.sub(r'</tr>', '\n', v.group(0)); t = re.sub(r'</td>', ' | ', t); t = re.sub(r'<[^>]+>', '', t)
    print(H.unescape(t)[:1600])
    stop = re.search(r'<div class="stop">(.*?)</div>', s, re.S)
    print("STOP:", H.unescape(re.sub('<[^>]+>', '', stop.group(1))) if stop else None)
    for t in re.findall(r'<table.*?</table>', s, re.S):
        if "GGM-15-2-2" in t and "Предельная" in t:
            for row in re.findall(r'<tr>(.*?)</tr>', t, re.S):
                cells = [H.unescape(re.sub('<[^>]+>', '', c)).strip() for c in re.findall(r'<td[^>]*>(.*?)</td>', row, re.S)]
                if cells:
                    print("  ", cells[0], "| base", cells[2], "| now", cells[3], "|", cells[7][:90])
            break
    print()
