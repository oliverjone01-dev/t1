"""Z1/Z3/U1: DATA_DIR variants for page probes (writes only under argv[2], a scratch dir).
Usage: python3 -I mkvariants4.py <repo analytics-mvp/data> <scratch out dir>
Every variant = symlinks to all data files + a modified copy of gap_daily.ndjson.
  v0   - as is
  vZ   - IN PLACE (the row is the only row of its day): GGK-02-3-3-80 2026-10-19, GGT-48-2-2-100-180 2026-10-19,
         GGM-20-2 2026-10-02 -> site_to_seller 1.0, gap_pct 0.0 (mature cards: test 4 stop, plan chip, bid summary)
  vN   - same rows IN PLACE -> 0.95 / 5.0 (sensitivity control: must fire on any code)
  vE   - EXTRA evening zero row (with SKU) appended for GGK-02-3-3-80 and GGT-48-2-2-100-180 on 2026-10-19,
         morning value kept (day rule M1 should keep the morning value)
  vU   - «as the mac writes it»: the 14 no_site rows unlabeled and restored to site_to_seller 1.0, gap_pct 0.0
         (new cards, no history; the read-time rule must give exactly the same page as v0)
  vM   - vU + vZ together (mature zeros and unlabeled new-card zeros in one file)
"""
import json
import os
import sys

SRC, OUT = sys.argv[1], sys.argv[2]
INPLACE = {("2026-10-19", "GGK-02-3-3-80"), ("2026-10-19", "GGT-48-2-2-100-180"), ("2026-10-02", "GGM-20-2")}
EXTRA = ["GGK-02-3-3-80", "GGT-48-2-2-100-180"]
rows = [json.loads(l) for l in open(os.path.join(SRC, "gap_daily.ndjson"), encoding="utf-8") if l.strip()]


def write(v, out_rows):
    d = os.path.join(OUT, v, "data")
    os.makedirs(d, exist_ok=True)
    for name in os.listdir(SRC):
        if name == "gap_daily.ndjson":
            continue
        dst = os.path.join(d, name)
        if not os.path.lexists(dst):
            os.symlink(os.path.join(SRC, name), dst)
    with open(os.path.join(d, "gap_daily.ndjson"), "w", encoding="utf-8") as f:
        for r in out_rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    os.makedirs(os.path.join(OUT, v, "out"), exist_ok=True)


def inplace(rs, s2s, g):
    out, hit = [], 0
    for r in rs:
        if (r["date"][:10], r["art"]) in INPLACE:
            r = {**r, "site_to_seller": s2s, "gap_pct": g}
            hit += 1
        out.append(r)
    return out, hit


def unlabel(rs):
    out, hit = [], 0
    for r in rs:
        if r.get("no_site") is True:
            r = {k: v for k, v in r.items() if k != "no_site"}
            r["site_to_seller"], r["gap_pct"] = 1.0, 0.0
            hit += 1
        out.append(r)
    return out, hit


write("v0", rows)
vz, h = inplace(rows, 1.0, 0.0); write("vZ", vz); print("vZ in-place", h)
vn, h = inplace(rows, 0.95, 5.0); write("vN", vn); print("vN in-place", h)
ve = list(rows)
skus = {r["art"]: r.get("sku") for r in rows if r["date"].startswith("2026-10-19") and r["art"] in EXTRA}
for a in EXTRA:
    ve.append({"date": "2026-10-19", "art": a, "sku": skus.get(a, ""), "site_to_seller": 1.0, "gap_pct": 0.0,
               "src": "prices_raw", "oa_used": False, "snap": "вечер"})
write("vE", ve); print("vE extra", len(EXTRA), "morning values", {a: [r["gap_pct"] for r in rows if r["art"] == a and r["date"].startswith("2026-10-19")] for a in EXTRA})
vu, h = unlabel(rows); write("vU", vu); print("vU unlabeled", h)
vm, h2 = inplace(vu, 1.0, 0.0); write("vM", vm); print("vM unlabeled", h, "in-place", h2)
