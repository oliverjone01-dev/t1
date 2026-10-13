#!/usr/bin/env python3
"""FENIKS iter6 analyzer: tab sweep JSONL (sandboxes A, B) vs independent probe JSON.
usage: an6.py <sweep.jsonl> <probe.json> A B"""
import json, re, sys

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6/"
fn, pj, A, B = sys.argv[1:5]
probe = {(p["f"], p["t"]): p for p in json.load(open(S + pj))["periods"]}
N = lambda s: None if s is None or "н/д" in s else float(re.sub(r"[^\d.\-]", "", s.replace(",", ".").split("*")[0]) or "nan")
tot = dict(periods=0, errs=0, orders_table_changed=0, other_camp_changed=0, cpo_ok=0, cpo_bad=0, rev_on_other_cpo=0, partial_ok=0, partial_bad=0)
for l in open(S + fn):
    r = json.loads(l)
    k = (r["f"], r["t"])
    tot["periods"] += 1
    a, b = r[A], r[B]
    flags = []
    if a["errs"] or b["errs"]:
        tot["errs"] += 1
        flags.append("ERR " + str((a["errs"] + b["errs"])[:2]))
    if (a["ofp"], a["olen"], a["orows"]) != (b["ofp"], b["olen"], b["orows"]):
        tot["orders_table_changed"] += 1
        flags.append("ORDERS TABLE CHANGED")
    cpo_lab = {i for i, c in b["camps"].items() if "за заказ" in " ".join(c[:2]).lower()}
    for i in set(a["camps"]) | set(b["camps"]):
        if i in cpo_lab:
            continue
        if a["camps"].get(i) != b["camps"].get(i):
            tot["other_camp_changed"] += 1
            flags.append(f"camp {i} changed {a['camps'].get(i)} -> {b['camps'].get(i)}")
    p = probe[k]
    c = b["camps"].get("28753239")
    others = {i: b["camps"][i][3:7] for i in cpo_lab if i != "28753239"}
    for i, cells in others.items():
        if cells[1] != "н/д":
            tot["rev_on_other_cpo"] += 1
            flags.append(f"CPO REVENUE ON {i}: {cells}")
    if c is None:
        exp = p["rev"] == 0 and p["sp_period"] == 0
        (flags.append("no 28753239 row (no spend in period)") if exp else flags.append("28753239 ROW MISSING"))
        if exp:
            tot["cpo_ok"] += 1
        else:
            tot["cpo_bad"] += 1
    else:
        sp, rev, u, drr = c[3], c[4], c[5], c[6]
        got = (N(sp), N(rev), N(u), N(drr))
        expd = (p["sp_period"], p["rev"] or None, p["units"] or None, p["drr"])
        ok = got[0] == expd[0] and got[1] == expd[1] and got[2] == expd[2] and (expd[3] is None and got[3] is None or (got[3] is not None and expd[3] is not None and abs(got[3] - expd[3]) < 0.051))
        tot["cpo_ok" if ok else "cpo_bad"] += 1
        if not ok:
            flags.append(f"CPO MISMATCH tab {got} probe {expd}")
        m = re.search(r"\*(\d+) из (\d+) дн", drr or "")
        if p["rev"]:
            exp_part = p["ncov"] < p["nall"]
            okp = (bool(m) == exp_part) and (not m or (int(m.group(1)), int(m.group(2))) == (p["ncov"], p["nall"]))
            tot["partial_ok" if okp else "partial_bad"] += 1
            if not okp:
                flags.append(f"PARTIAL tab {m and m.groups()} probe {(p['ncov'], p['nall'])}")
    print(r["f"], r["t"], "OK" if not flags else "; ".join(flags)[:400])
print(tot)
