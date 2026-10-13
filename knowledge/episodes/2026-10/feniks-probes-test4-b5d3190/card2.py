import re, html as H, sys
W = sys.argv[1]
for name in sys.argv[2:]:
    path = f"{W}/out-{name}/katya-tests.html"
    h = open(path, encoding="utf-8").read()
    print("#####", name)
    rem = [m for m in re.finditer(r'<div class="(remind[^"]*)">(.*?)</div>', h, re.S) if "Тест 4" in m.group(2)]
    if rem:
        m = rem[0]
        print("REMIND", m.group(1), "::", H.unescape(re.sub('<[^>]+>', '', m.group(2)))[:420].replace("\n", " "))
        st = re.search(r'Нет данных о рекламе или акциях за[^<]*</b>[^<.]*', m.group(2))
        print("  STALE-LINE:", H.unescape(re.sub('<[^>]+>', '', st.group(0))) if st else None)
    else:
        print("REMIND none")
    s = re.split(r'(?=<section)', h)[4]
    s_vis = s.split("<script")[0]
    chips = re.findall(r'<span class="(chip[^"]*)">(.*?)</span>', s, re.S)
    print("CHIP", chips[0][0], "::", H.unescape(re.sub('<[^>]+>', '', chips[0][1])))
    v = re.search(r'<div class="verdict">.*?</table>', s, re.S)
    t = re.sub(r'</tr>', '\n', v.group(0)); t = re.sub(r'</td>', ' | ', t); t = re.sub(r'<[^>]+>', '', t)
    print(H.unescape(t)[:1500])
    for msg in ("График сдвига не строится", "База ещё не набрана", "Точек пока мало", "Нет данных о рекламе"):
        print(f"  [{msg}] in card:", msg in H.unescape(s_vis))
    bad = re.findall(r'NaN|Infinity|undefined', H.unescape(re.sub('<[^>]+>', ' ', s_vis)))
    print("  NaN/Infinity/undefined in visible card:", len(bad))
    for tb in re.findall(r'<table.*?</table>', s, re.S):
        if "GGM-15-2-2" in tb and "Предельная" in tb:
            for row in re.findall(r'<tr>(.*?)</tr>', tb, re.S):
                cells = [H.unescape(re.sub('<[^>]+>', '', c)).strip() for c in re.findall(r'<td[^>]*>(.*?)</td>', row, re.S)]
                if cells:
                    print("   ", cells[0], "| base", cells[2], "| now", cells[3], "|", cells[7][:70])
            break
    print()
