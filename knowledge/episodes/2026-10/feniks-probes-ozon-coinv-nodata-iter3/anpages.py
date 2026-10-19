import re, sys, html as H
S = "/tmp/claude-0/-home-user-t1/feadf20c-8819-5ff1-a553-d442fce0f391/scratchpad/pb"
def txt(s): return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", s)))
for code in ["head", "iter2"]:
    for v in ["v0", "vZ", "vN"]:
        p = open(f"{S}/{v}/out_{code}/katya-tests.html", encoding="utf-8").read()
        stop = re.findall(r"разрыв обвалился к нулю у ([^<]*?) - товар", p)
        # plan block row for GGT-48-2-2-100-180: first occurrence after the plan table header «Скидка OZON 14.10»
        i0 = p.find("Скидка OZON 14.10")
        j = p.find("GGT-48-2-2-100-180", i0)
        row = txt(p[j:j + 3000])[:160] if j > 0 else "-"
        print(f"{code:5} {v}: stop={stop} | plan row: {row}")
