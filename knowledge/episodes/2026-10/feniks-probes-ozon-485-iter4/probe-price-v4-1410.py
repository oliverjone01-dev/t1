#!/usr/bin/env python3
# ФЕНИКС #485 iter4, проба P1 (повтор на базе 14.10): все файлы читаются из коммита REV через git show, не из рабочей копии.
# 1) 6 строк 16.10 пересчитаны из prices_daily / gap_daily за 14.10; 2) 23 прочие строки = v3; 3) статус на 16.10 по правилу
# priceStatus (plan-tab.ts:123-132); 4) add_price_1610.py@REV на копии данных@REV в scratchpad даёт v4@REV байт в байт.
# Запуск: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-485-iter4/probe-price-v4-1410.py b246e4c
import json
import pathlib
import subprocess
import sys

REPO, REV = "/home/user/t1", (sys.argv[1] if len(sys.argv) > 1 else "HEAD")
SCR = pathlib.Path("/tmp/claude-0/-home-user-t1/4e867a09-3dd0-52ad-b13c-8ffe5311d2f9/scratchpad/repro-iter4")
ARTS = ["GGT-48-2-2-100-180", "GGT-48-3-3-100-180", "GGT-48-5-1-100-180", "GGT-46-2-2-100", "GGT-46-3-3-100", "GGT-46-5-1-100"]
DAY, TODAY = "2026-10-14", "2026-10-16"
show = lambda p: subprocess.check_output(["git", "-C", REPO, "show", f"{REV}:{p}"])
nd = lambda b: [json.loads(x) for x in b.decode("utf-8").splitlines() if x.strip()]

v3 = json.loads(show("analytics-mvp/data/plan_2026-10-15_v3.json"))
v4b = show("analytics-mvp/data/plan_2026-10-15_v4.json")
v4 = json.loads(v4b)
pd = nd(show("analytics-mvp/data/prices_daily.ndjson"))
gd = nd(show("analytics-mvp/data/gap_daily.ndjson"))
hist = {}
for r in pd:
    if r["offer"] in ARTS:
        hist.setdefault(r["offer"], {})[r["d"]] = float(r["price"])
s2s = {r["art"]: float(r["site_to_seller"]) for r in gd if r.get("date") == DAY and r.get("art") in ARTS and r.get("site_to_seller")}
old = {p["art"]: p for p in v3["price"]}

print(f"REV {REV}: v4 строк {len(v4['price'])}, уникальных {len({p['art'] for p in v4['price']})}; ключи v3 == v4: {sorted(v3) == sorted(v4)}; "
      f"отличаются: {[k for k in v3 if v3[k] != v4[k]]}")
bad = 0
for p in [x for x in v4["price"] if x["art"] in ARTS]:
    h = hist[p["art"]]
    now = round(h[DAY]); new = int(round(now * 0.9 / 10) * 10); site = round(now * s2s[p["art"]])
    ok = (p["price_now"], p["price_new"], p["site_now"], p["when"]) == (now, new, site, "16.10")
    bad += not ok
    last_d = max(h); last = h[last_d]
    if last <= p["price_new"] * 1.005:
        st = f"снижена {(last / p['price_now'] - 1) * 100:.1f}"
    elif last < p["price_now"] * 0.995:
        st = f"частично {(last / p['price_now'] - 1) * 100:.1f} из -10.0"
    else:
        st = "сегодня 16.10: пока не снижена" if TODAY == "2026-10-16" else "по плану/не снижена"
    o = old.get(p["art"])
    print(f'{p["art"]} | 14.10 {h[DAY]} -> v4 {p["price_now"]}/{p["price_new"]}/site {p["site_now"]} | пересчёт {"OK" if ok else "РАСХОЖДЕНИЕ"} '
          f'| v3: {o["when"] + " " + str(o["price_now"]) + "->" + str(o["price_new"]) if o else "нет"} | срез {last_d} {last} -> {st}')
print("расхождений в 6 строках:", bad)
rest4 = [p for p in v4["price"] if p["art"] not in ARTS]
rest3 = [p for p in v3["price"] if p["art"] not in ARTS]
print("23 прочие строки == v3:", rest4 == rest3, len(rest4))

SCR.joinpath("analytics-mvp/data").mkdir(parents=True, exist_ok=True)
for f in ("plan_2026-10-15_v3.json", "prices_daily.ndjson", "gap_daily.ndjson", "skus_live_30d.json", "sku_taxonomy.json"):
    SCR.joinpath("analytics-mvp/data", f).write_bytes(show("analytics-mvp/data/" + f))
SCR.joinpath("add_price_1610.py").write_bytes(show("knowledge/episodes/2026-10/ozon-testy-scripts/v8/add_price_1610.py"))
out = subprocess.run(["python3", "-I", str(SCR / "add_price_1610.py")], cwd=SCR, capture_output=True, text=True)
print("скрипт exit", out.returncode, out.stderr.strip()[-200:])
print("v4 из скрипта == v4@REV байт в байт:", SCR.joinpath("analytics-mvp/data/plan_2026-10-15_v4.json").read_bytes() == v4b)
