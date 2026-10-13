#!/usr/bin/env python3
"""FENIKS iter7: independent expectation for the CPO row of «Реклама по карточкам» after N5/N6
(written from spec v2.3 + N5/N6 text and my iter6 rework, not from build-katya.ts):
 - revenue/units per day = postings of export orders (orders_daily, first posting in file order), not cancelled;
 - revenue goes to the export's campaign (expected 28753239) if it has any ads_daily row in the period,
   else to the first «за заказ» campaign by spend in the period (spec fallback);
 - DRR = API spend of that campaign on days of period inside [1st day of month of coverage start .. coverage end] / revenue;
   period wider than that window -> «N из M дн.» mark.
Also: ranking of all campaigns by |API spend over coverage - export charges| (robustness of the N5 pick),
days with revenue where the export campaign has no ads_daily row (fallback reachability).
usage: cpo7_probe.py <sandbox> [out.json] [extra periods f:t ...]"""
import collections, datetime as dt, json, re, sys

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i7"
SB = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else f"{S}/cpo7_{SB}.json"
EXTRA = [tuple(x.split(":")) for x in sys.argv[3:]]
D = f"{S}/{SB}/analytics-mvp/data/"
CPO_ID = "28753239"


def nd(f):
    return [json.loads(l) for l in open(D + f, encoding="utf-8") if l.strip()]


cpo, od, skud, ads = nd("cpo_orders.ndjson"), nd("orders_daily.ndjson"), nd("cpo_sku_daily.ndjson"), nd("ads_daily.ndjson")
html = open(f"{S}/{SB}/analytics-mvp/public/katya-reklama-kartochki.html", encoding="utf-8").read()
m = re.search(r"const CAMP_META=(\{.*?\});const CAMP_CARD=", html)
META = json.loads(m.group(1)) if m else {}
is_cpo = lambda cid: bool(re.search("за заказ", str(META.get(str(cid), {}).get("instr", "")), re.I))

post = collections.defaultdict(list)
for r in od:
    o = str(r.get("order") or "")
    post[o[: o.rfind("-")]].append(r)
day = collections.defaultdict(lambda: [0.0, 0.0, 0])
miss = 0
for r in cpo:
    ps = post.get(str(r["order"]), [])
    if not ps:
        miss += 1
        continue
    a = day[ps[0]["d"]]
    a[0] += float(r["sp"] or 0)
    for p in ps:
        if p.get("status") != "cancelled":
            a[1] += float(p.get("revenue") or 0)
            a[2] += int(p.get("units") or 0)
cd = sorted({str(r["d"]) for r in skud})
cfrom, cto = cd[0], cd[-1]
wfrom = cfrom[:7] + "-01"
charges = sum(v[0] for v in day.values())
rep = {"coverage": [cfrom, cto], "window": [wfrom, cto], "miss": miss, "charges_found_orders": round(charges, 2),
       "charges_all_rows": round(sum(float(r["sp"]) for r in cpo), 2)}
# N5 pick ranking
byid = collections.Counter()
for r in ads:
    if cfrom <= r["d"] <= cto:
        byid[str(r["id"])] += float(r["sp"] or 0)
rank = sorted(byid.items(), key=lambda kv: abs(kv[1] - charges))
rep["pick_rank_all"] = [(k, round(v), round(abs(v - charges)), is_cpo(k), META.get(k, {}).get("instr", "?")) for k, v in rank[:6]]
rep["pick_rank_cpo_only"] = [(k, round(v), round(abs(v - charges))) for k, v in rank if is_cpo(k)][:4]
rep["cpo_typed_campaigns"] = sorted(k for k in META if is_cpo(k))
# rows per (campaign, day)
rows = collections.defaultdict(dict)
for r in ads:
    rows[str(r["id"])][r["d"]] = rows[str(r["id"])].get(r["d"], 0.0) + float(r["sp"] or 0)
rev_days = sorted(d for d, v in day.items() if round(v[1]))
rep["rev_days"] = [rev_days[0], rev_days[-1], len(rev_days)]
rep["rev_days_without_cid_row"] = [d for d in rev_days if d not in rows[CPO_ID]]
rep["rev_days_cid_row_zero_sp"] = [d for d in rev_days if d in rows[CPO_ID] and not rows[CPO_ID][d]]
rep["cid_first_sp_day"] = min((d for d, v in rows[CPO_ID].items() if v > 0), default=None)
rep["cid_first_row_day"] = min(rows[CPO_ID], default=None)
rep["cid_sp_window_before_cov"] = round(sum(v for d, v in rows[CPO_ID].items() if wfrom <= d < cfrom))


def nd_days(f, t):
    return (dt.date.fromisoformat(t) - dt.date.fromisoformat(f)).days + 1


def expect(f, t):
    rv = sum(v[1] for d, v in day.items() if f <= d <= t)
    u = sum(v[2] for d, v in day.items() if f <= d <= t)
    present = {cid: sum(v for d, v in ds.items() if f <= d <= t) for cid, ds in rows.items() if any(f <= d <= t for d in ds)}
    if CPO_ID in present:
        tgt = CPO_ID
    else:
        c = sorted((cid for cid in present if is_cpo(cid)), key=lambda cid: -round(present[cid]))
        tgt = c[0] if c else None
    cf, ct = max(f, wfrom), min(t, cto)
    ncov = nd_days(cf, ct) if cf <= ct else 0
    nall = nd_days(f, t)
    sc = sum(v for d, v in rows.get(tgt, {}).items() if f <= d <= t and cf <= d <= ct) if tgt else 0
    rvr = round(rv)
    return {"f": f, "t": t, "rev": rvr, "units": u, "target": tgt if rvr else None, "ncov": ncov, "nall": nall,
            "sc": round(sc), "sp_cid": round(present.get(CPO_ID, 0)), "cid_present": CPO_ID in present,
            "sp_target": round(present.get(tgt, 0)) if tgt else None,
            "drr": (round(sc / rvr * 1000) / 10) if rvr and tgt else None, "partial": ncov < nall}


P = [("2026-06-01", "2026-06-30"), ("2026-07-01", "2026-07-31"), ("2026-08-01", "2026-08-31"), ("2026-09-01", "2026-09-30"), ("2026-10-01", "2026-10-12"),
     ("2026-06-05", "2026-06-30"), ("2026-06-01", "2026-06-04"), ("2026-05-25", "2026-06-10"), ("2026-06-15", "2026-07-15"), ("2026-07-01", "2026-07-15"),
     ("2026-07-16", "2026-07-31"), ("2026-08-01", "2026-08-15"), ("2026-08-16", "2026-08-31"), ("2026-09-01", "2026-09-15"), ("2026-09-16", "2026-09-30"),
     ("2026-08-15", "2026-09-15"), ("2026-07-01", "2026-09-30"), ("2026-09-20", "2026-10-10"), ("2026-09-25", "2026-10-05"), ("2026-06-01", "2026-10-12"),
     ("2026-09-04", "2026-09-04"), ("2026-06-05", "2026-06-05"), ("2026-06-30", "2026-07-01"), ("2026-07-31", "2026-08-01"), ("2026-08-31", "2026-09-01"),
     ("2026-07-20", "2026-07-26"), ("2026-08-03", "2026-08-09"), ("2026-06-08", "2026-06-14"), ("2026-07-10", "2026-07-10"), ("2026-08-20", "2026-08-20"),
     ("2026-09-30", "2026-09-30"), ("2026-10-01", "2026-10-01"), ("2026-06-20", "2026-08-20"), ("2026-06-01", "2026-09-30"),
     # X6 periods (iter6 FAIL) and more mixed-campaign periods
     ("2026-03-01", "2026-06-10"), ("2026-05-01", "2026-06-05"), ("2026-05-27", "2026-06-05"), ("2026-02-01", "2026-07-14"), ("2026-06-01", "2026-06-07"),
     ("2026-05-31", "2026-06-06"), ("2026-07-10", "2026-07-20"), ("2026-02-12", "2026-10-12")] + EXTRA
rep["periods"] = [expect(f, t) for f, t in P]
json.dump(rep, open(OUT, "w"), ensure_ascii=False, indent=0)
for k, v in rep.items():
    if k != "periods":
        print(k, ":", json.dumps(v, ensure_ascii=False)[:500])
for p in rep["periods"][34:]:
    print(p)
