"""K2 analysis: systemic zero day on the page. Usage: python3 -I anmass.py <scratch dir>"""
import re
import sys

S = sys.argv[1]
for rev in ("0bb36b5", "b0096cf"):
    try:
        p = open(f"{S}/pb/vMass/out_{rev}/katya-tests.html", encoding="utf-8").read()
    except FileNotFoundError:
        print(rev, "no page")
        continue
    base = open(f"{S}/pb/v0/out_{rev}/katya-tests.html", encoding="utf-8").read()
    stop = re.findall(r"разрыв обвалился к нулю у ([^<]*?) - товар", p)
    chips = p.count("выпал из бустинга?")
    chips0 = base.count("выпал из бустинга?")
    print(f"{rev}: stop items={stop[0].split(', ') if stop else []}")
    print(f"      chips «выпал из бустинга?»: {chips} (v0 {chips0})")
    for pat in (r"(\d+) наблюдаемых дней подряд \(по ([0-9-]+)\)",):
        print(f"      streak v0={re.findall(pat, base)[:3]} vMass={re.findall(pat, p)[:3]}")
