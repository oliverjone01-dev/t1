#!/usr/bin/env python3
"""FENIKS iter7 analyzer: tab sweep JSONL (new A, old B) vs independent expectation (cpo7_probe.py).
Checks per period: JS errors; orders table identical A vs B; all non-«за заказ» campaign rows identical A vs B;
CPO revenue/units/DRR/partial mark on the expected target row (A); no revenue on any other «за заказ» row (A);
ИТОГО row identical A vs B except revenue/DRR columns.
usage: an7.py <sweep.jsonl> <probe.json> A B"""
import json, re, sys

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i7/"
fn, pj, A, B = sys.argv[1:5]
probe = {(p["f"], p["t"]): p for p in json.load(open(S + pj))["periods"]}
CPO_IDS = {"28753239", "22421802"}


def num(s):
    if s is None or "н/д" in s:
        return None
    x = re.sub(r"[^\d.\-]", "", s.replace(",", ".").split("*")[0])
    return float(x) if x else None


tot = dict(periods=0, errs=0, orders_table_changed=0, other_camp_changed=0, cpo_ok=0, cpo_bad=0, rev_on_wrong_row=0, partial_ok=0, partial_bad=0, cpo_changed_vs_old=0)
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
    for i in set(a["camps"]) | set(b["camps"]):
        if i in CPO_IDS:
            continue
        if a["camps"].get(i) != b["camps"].get(i):
            tot["other_camp_changed"] += 1
            flags.append(f"camp {i} changed")
    p = probe[k]
    for i in CPO_IDS:
        ca, cb = a["cpo"].get(i), b["cpo"].get(i)
        if (ca or {}).get("cells") != (cb or {}).get("cells"):
            tot["cpo_changed_vs_old"] += 1
            flags.append(f"cpo {i} old {cb and cb['cells'][3:7]} -> new {ca and ca['cells'][3:7]}")
    tgt = p["target"]
    for i, c in a["cpo"].items():
        if i != tgt and c["cells"][4] != "н/д":
            tot["rev_on_wrong_row"] += 1
            flags.append(f"REVENUE ON {i}: {c['cells'][3:7]}")
    if tgt:
        c = a["cpo"].get(tgt)
        if not c:
            tot["cpo_bad"] += 1
            flags.append(f"TARGET ROW {tgt} MISSING")
        else:
            sp, rev, u, drr = (c["cells"][j] for j in (3, 4, 5, 6))
            got = (num(sp), num(rev), num(u), num(drr))
            exp = (p["sp_target"], p["rev"], p["units"], p["drr"])
            ok = got[0] == exp[0] and got[1] == exp[1] and got[2] == exp[2] and got[3] is not None and abs(got[3] - exp[3]) < 0.051
            tot["cpo_ok" if ok else "cpo_bad"] += 1
            if not ok:
                flags.append(f"CPO MISMATCH tab {got} exp {exp}")
            m = re.search(r"\*(\d+) из (\d+) дн", drr or "")
            okp = (bool(m) == p["partial"]) and (not m or (int(m.group(1)), int(m.group(2))) == (p["ncov"], p["nall"]))
            tot["partial_ok" if okp else "partial_bad"] += 1
            if not okp:
                flags.append(f"PARTIAL tab {m and m.groups()} exp {(p['ncov'], p['nall'], p['partial'])}")
    else:
        c = a["cpo"].get("28753239")
        if c and c["cells"][4] != "н/д":
            tot["cpo_bad"] += 1
            flags.append(f"REVENUE WHERE NONE EXPECTED {c['cells'][3:7]}")
        else:
            tot["cpo_ok"] += 1
    print(r["f"], r["t"], "OK" if not flags else "; ".join(flags)[:420])
print(tot)
