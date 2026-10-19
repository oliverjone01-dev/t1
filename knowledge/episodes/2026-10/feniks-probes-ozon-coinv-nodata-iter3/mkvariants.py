"""Build DATA_DIR variants for page probes (writes only under the scratch dir given as argv[2]).
v0 - data as is; vZ - zeros (site price == ours, WITH SKU) injected; vN - gap 5.0 (sensitivity control).
Injections:
  T4: test-4 clean item GGK-02-3-3-80, its row 2026-10-19 -> value      (stop signal «разрыв обвалился к нулю»)
  PL: plan item GGT-48-2-2-100-180, extra evening row 2026-10-19 SKU   (plan block G1b, SKU variant)
  BD: bid item GGM-20-2, its row 2026-10-02 -> value                   (bid summary / chart)
"""
import json, os, sys
SRC, OUT = sys.argv[1], sys.argv[2]
VALS = {"vZ": (1.0, 0.0), "vN": (0.95, 5.0)}
lines = open(os.path.join(SRC, "gap_daily.ndjson"), encoding="utf-8").read().split("\n")
for v in ["v0", "vZ", "vN"]:
    d = os.path.join(OUT, v, "data")
    os.makedirs(d, exist_ok=True)
    for name in os.listdir(SRC):
        if name == "gap_daily.ndjson":
            continue
        dst = os.path.join(d, name)
        if not os.path.lexists(dst):
            os.symlink(os.path.join(SRC, name), dst)
    out, hit = [], {"T4": 0, "PL": 0, "BD": 0}
    for l in lines:
        if v != "v0" and l.strip():
            r = json.loads(l)
            s2s, g = VALS[v]
            if (r["date"], r["art"]) in (("2026-10-19", "GGK-02-3-3-80"), ("2026-10-02", "GGM-20-2")):
                hit["T4" if r["art"] == "GGK-02-3-3-80" else "BD"] += 1
                r = {**r, "site_to_seller": s2s, "gap_pct": g}
                l = json.dumps(r, ensure_ascii=False)
        out.append(l)
    if v != "v0":
        s2s, g = VALS[v]
        extra = {"date": "2026-10-19", "art": "GGT-48-2-2-100-180", "sku": "5444460310", "site_to_seller": s2s, "gap_pct": g,
                 "src": "prices_raw", "oa_used": False, "snap": "вечер", "ts": "2026-10-19T20:00:00+03:00"}
        while out and out[-1] == "":
            out.pop()
        out.append(json.dumps(extra, ensure_ascii=False)); out.append("")
        hit["PL"] = 1
    open(os.path.join(d, "gap_daily.ndjson"), "w", encoding="utf-8").write("\n".join(out))
    os.makedirs(os.path.join(OUT, v, "out"), exist_ok=True)
    print(v, hit)
