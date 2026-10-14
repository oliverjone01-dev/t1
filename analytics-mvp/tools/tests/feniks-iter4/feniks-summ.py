#!/usr/bin/env python3
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for r in d:
    print("=====", r["period"])
    e = r["errs"]
    print("  errors money/card/report:", len(e["money"]), len(e["card"]), len(e["report"]), (e["money"] + e["card"] + e["report"])[:3])
    print("  ИТОГО cols differing money vs tab:", r.get("ordDiffCols"))
    print("  tab additivity:", r.get("tabAdd"), "| money:", r.get("moneyAdd"))
    print("  Общие расходы:", r.get("obshie"))
    print("  negative Реклама order rows on tab:", r.get("negAdOrdersNeg"))
    c = r["camp"]
    print("  campaigns", c["n"], "sum-mismatch", c["bad"][:6], "negative subrows", len(c["neg"]), c["neg"][:6])
    print("  yellow rows", c["yellowN"], c["yellowSample"][:2])
    print("  CPO rows", c["cpo"], "expected", r["cpoExpected"])
    print("  campaigns without subrows (non-CPO):", c["nosubs"], c["nosubsSample"])
    print("  note mismatch:", c["noteMismatch"], "| src1 tail:", c["src1"])
