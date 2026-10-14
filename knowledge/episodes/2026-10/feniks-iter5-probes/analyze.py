import json, sys, re
S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad"
fn = sys.argv[1]
probe = json.load(open(S + "/cpo_probe_" + (sys.argv[2] if len(sys.argv) > 2 else "br") + ".json"))
tot = {"periods": 0, "no_itogo": 0, "errs": 0, "pay_ne": 0, "rek_ne_plashka": 0, "rek_ne_minus_pr": 0, "same_flag_wrong": 0, "neg": 0, "neg_nonG10": 0, "bad": 0,
       "mk_cell_mismatch": 0, "cpo_mismatch": 0, "adm_ne_plashka": 0}
othercols = {}


def col(o, pre):
    return next((v for kk, v in (o or {}).items() if kk.startswith(pre)), None) or 0


for l in open(S + "/" + fn):
    r = json.loads(l)
    tot["periods"] += 1
    k = f"{r['f']}..{r['t']}"
    mt = (r.get("money") or {}).get("tot") or {}
    tt = (r.get("tab") or {}).get("tot") or {}
    mo = (r.get("money") or {}).get("obs") or {}
    to = (r.get("tab") or {}).get("obs") or {}
    flags = []
    if not mt or not tt:
        tot["no_itogo"] += 1
        flags.append(f"NO ITOGO money={bool(mt)} tab={bool(tt)} rows money={(r.get('money') or {}).get('nrows')} tab={(r.get('tab') or {}).get('nrows')}")
    dR = col(tt, "Реклама") - col(mt, "Реклама"); dP = col(tt, "Прочие") - col(mt, "Прочие"); dK = col(tt, "К выплате") - col(mt, "К выплате")
    dObs = col(to, "Прочие") - col(mo, "Прочие")
    diffc = {kk: round((tt.get(kk) or 0) - (mt.get(kk) or 0), 2) for kk in mt if isinstance(mt.get(kk), (int, float)) and abs((tt.get(kk) or 0) - (mt.get(kk) or 0)) > 1}
    for kk in diffc:
        othercols[kk] = othercols.get(kk, 0) + 1
    sub = r["sub"]
    mv = sub["mv"]
    m_adm = re.search(r"АДМ 30% в ИТОГО (больше|меньше), чем на «Деньгах», на ([\d\s  ]+) ₽", sub["note"])
    adm_pl = (1 if m_adm and m_adm.group(1) == "больше" else -1) * int(re.sub(r"\D", "", m_adm.group(2))) if m_adm else 0
    dAdm = col(tt, "АДМ") - col(mt, "АДМ")
    if r["errs"]:
        tot["errs"] += 1; flags.append("ERR " + str(r["errs"][:2]))
    if abs(dK) > 1:
        tot["pay_ne"] += 1; flags.append(f"dPay {dK}")
    if abs(dR - mv) > 1:
        tot["rek_ne_plashka"] += 1; flags.append(f"dRek {dR} != plashka {mv}")
    if abs(dR + dP) > 1:
        tot["rek_ne_minus_pr"] += 1; flags.append(f"dRek {dR} + dPr {dP} != 0")
    if (mv == 0) != sub["same"]:
        tot["same_flag_wrong"] += 1; flags.append("same-flag")
    if abs(dAdm - adm_pl) > 1:
        tot["adm_ne_plashka"] += 1; flags.append(f"dAdm {dAdm} != plashka {adm_pl}")
    g10 = lambda lab: "Атрибуцией не распределено" in lab or "разбивка" in lab
    negs = list(sub["neg"])
    negn = [n for n in negs if not g10(n[1])]
    tot["neg"] += len(negs) > 0; tot["neg_nonG10"] += len(negn) > 0
    if negn:
        flags.append("NEG " + str(negn[:3]))
    if sub["bad"]:
        tot["bad"] += 1
        flags.append("BAD " + str(sub["bad"][:2]))
    if "mkc" in r:
        mm = 0; ex = []
        for cid, cells in r["tabc"]["rows"].items():
            mc = r["mkc"]["rows"].get(cid)
            if mc is None:
                mm += 1; ex.append((cid, "missing on mk")); continue
            is_cpo = "за заказ" in " ".join(cells[:2])
            for i, (a, b) in enumerate(zip(cells, mc)):
                if i == 0:
                    a, b = re.sub(r"[▸▾\s]", "", a), re.sub(r"[▸▾\s]", "", b)
                if is_cpo and i in (4, 5, 6):
                    continue
                if a != b:
                    mm += 1; ex.append((cid, i, a[:30], b[:30]))
        extra = set(r["mkc"]["rows"]) - set(r["tabc"]["rows"])
        if mm or extra:
            tot["mk_cell_mismatch"] += 1; flags.append(f"MK {mm} {ex[:3]} extra {list(extra)[:3]}")
    pr = probe.get(k)
    if pr:
        c = [x for x in sub["cpo"] if x["rev"] not in ("н/д", "")]
        if pr["tab_rev"]:
            ok = bool(c) and int(re.sub(r"\D", "", c[0]["rev"])) == pr["tab_rev"] and int(re.sub(r"\D", "", c[0]["u"])) == pr["tab_u"] and abs(float(re.match(r"[\d.]+", c[0]["drr"]).group(0)) - pr["drr_win"]) < 0.051
        else:
            ok = not c
        if not ok:
            tot["cpo_mismatch"] += 1; flags.append(f"CPO tab {[(x['rev'], x['u'], x['drr']) for x in sub['cpo']]} probe {pr['tab_rev'], pr['tab_u'], pr['drr_win'], pr['days']}")
    print(("OK  " if not flags else "FLAG"), k, f"dRek {dR} dPr {dP} dObs {dObs} dPay {dK} plashka {mv} dAdm {dAdm}/{adm_pl}", " | ".join(flags))
print(json.dumps(tot, ensure_ascii=False))
print("columns that differ tab vs money at ITOGO (periods):", othercols)
