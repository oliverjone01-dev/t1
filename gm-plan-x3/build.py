"""Сборка страницы «GLASS MEMORY: план x3 на 2027».

Вход: data/fact-2026.json - помесячные агрегаты оплат 2026 из Google-таблицы
«Отчет отдела продаж2» (без персональных данных), выгрузка 20.11.2026.
Выход: index.html (template.html + модель).

Модель: выручка = дилеры + розница.
  дилеры  = активные дилеры в месяц x сделок на дилера x средний чек дилера
  розница = сделок в месяц x средний чек розницы
Допущения 2027 вынесены в ASSUMPTIONS и подписаны на странице как гипотезы.
"""
import json
import statistics as st
from pathlib import Path

ROOT = Path(__file__).parent
fact = json.loads((ROOT / "data/fact-2026.json").read_text(encoding="utf-8"))

# Рабочих дней в ноябре 2026: 20, к 19.11 прошло 13 (4 ноября выходной).
NOV_DONE, NOV_TOTAL = 13, 20

ASSUMPTIONS = {
    "multiplier": 3,              # цель: выручка 2027 = 3 x выручка 2026
    "dealer_share": "2026",       # доля дилеров в выручке 2027: как в 2026 (или число 0..1)
    "dealer_check_growth": 0.10,  # средний чек дилера +10%
    "deals_per_dealer": 3.5,      # сделок на активного дилера в месяц
    "retail_check_growth": 0.10,  # средний чек розницы +10%
    "rev_per_manager": 1_400_000, # норма выручки на менеджера в месяц
    "top_manager_cap": 40,        # доля одного менеджера, не больше, %
    "new_dealers_per_month": 10,  # новых дилеров в месяц
    "cost_share_cap": 38,         # себестоимость (счёт ДГ) от выручки, не больше, %
    "season_weight_wordstat": 0.5, # вес Вордстата в сезонности плана, остальное - форма продаж 2026
    "demand_growth": "yoy",       # рост спроса 2027: как янв-окт 2026 к 2025 (или число, напр. 0.05)
}

months = [dict(o) for o in fact]
for o in months:
    o["status"] = "факт"
nov = months[10]
nov["fact_partial"] = nov["rev"]
nov["rev_full"] = round(nov["rev"] / NOV_DONE * NOV_TOTAL)
nov["status"] = "факт по 19.11 + прогноз по темпу"
dec_rev = round((months[9]["rev"] + nov["rev_full"]) / 2)
months.append(dict(mo=12, rev=None, rev_full=dec_rev, status="гипотеза: среднее октября и прогноза ноября"))

rev_by_month = [o.get("rev_full", o["rev"]) for o in months]
y26 = sum(rev_by_month)
fact_jan_nov = sum(o["rev"] for o in fact)

d_rev = sum(o["dRev"] for o in fact)
r_rev = sum(o["rRev"] for o in fact)
d_n = sum(o["dN"] for o in fact)
r_n = sum(o["rN"] for o in fact)
n_all = sum(o["n"] for o in fact)
active = sum(o["act"] for o in fact) / 11
deals_per_dealer = d_n / 11 / active
check_d = d_rev / d_n
check_r = r_rev / r_n
dealer_share = d_rev / (d_rev + r_rev)
cost_avg = sum(o["cost"] for o in fact) / 11
top_avg = sum(o["top"] for o in fact) / 11
scale = y26 / (d_rev + r_rev)  # приведение янв-ноя к оценке года

A = ASSUMPTIONS
y27 = y26 * A["multiplier"]
share27 = dealer_share if A["dealer_share"] == "2026" else A["dealer_share"]
d27 = y27 * share27
r27 = y27 - d27
check_d27 = check_d * (1 + A["dealer_check_growth"])
check_r27 = check_r * (1 + A["retail_check_growth"])
active27 = d27 / 12 / (check_d27 * A["deals_per_dealer"])
retail_n27 = r27 / 12 / check_r27
deals27 = active27 * A["deals_per_dealer"] + retail_n27
managers27 = y27 / 12 / A["rev_per_manager"]

# Вклад рычагов в рост дилерского канала (последовательная подстановка),
# приведённый к точному разрыву.
d26 = d_rev * scale
r26 = r_rev * scale
raw = {
    "active": 12 * (active27 - active) * deals_per_dealer * check_d,
    "freq": 12 * active27 * (A["deals_per_dealer"] - deals_per_dealer) * check_d,
    "check": 12 * active27 * A["deals_per_dealer"] * (check_d27 - check_d),
}
k = (d27 - d26) / sum(raw.values())
bridge = [
    {"label": "Выручка 2026", "v": y26, "kind": "base"},
    {"label": "Больше активных дилеров", "v": raw["active"] * k, "kind": "step"},
    {"label": "Чаще заказывают", "v": raw["freq"] * k, "kind": "step"},
    {"label": "Чек дилера +10%", "v": raw["check"] * k, "kind": "step"},
    {"label": "Розница", "v": r27 - r26, "kind": "step"},
    {"label": "Цель 2027", "v": y27, "kind": "base"},
]


# ---- Спрос: Вордстат по ядру GM («стеклянный памятник» + «памятник из стекла»)
ws = json.loads((ROOT / "data/wordstat-gm.json").read_text(encoding="utf-8"))
q = ws["queries"]
core = [a + b for a, b in zip(q["стеклянный памятник"], q["памятник из стекла"])]
by_mo = {}
for m, v in zip(ws["months"], core):
    by_mo.setdefault(int(m[5:]), []).append(v)
avg_core = st.mean(core)
season = {mo: st.mean(v) / avg_core for mo, v in sorted(by_mo.items())}
norm = sum(season.values())
season = [season[mo] * 12 / norm for mo in range(1, 13)]
yoy = sum(core[14:24]) / sum(core[2:12]) - 1  # янв-окт 2026 к янв-окт 2025
growth = yoy if A["demand_growth"] == "yoy" else A["demand_growth"]
demand27 = [round(st.mean(core[12:24]) * (1 + growth) * season[i]) for i in range(12)]
season_ws = season
season_rev = [v / (y26 / 12) for v in rev_by_month]  # форма продаж 2026 (ноябрь - оценка, декабрь - гипотеза)
w = A["season_weight_wordstat"]
season_plan = [w * a + (1 - w) * b for a, b in zip(season_ws, season_rev)]
k_norm = sum(season_plan) / 12
season_plan = [x / k_norm for x in season_plan]
plan27 = [y27 * season_plan[i] / 12 for i in range(12)]
rev_jan_oct = [o["rev"] for o in fact[:10]]
def corr(a, b):
    ma, mb = st.mean(a), st.mean(b)
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b)) ** 0.5
demand_corr = corr(core[14:24], rev_jan_oct)
rev_per_k26 = sum(rev_jan_oct) / sum(core[14:24]) * 1000
rev_per_k27 = y27 / sum(demand27) * 1000

tasks = json.loads((ROOT / "data/tasks-2027.json").read_text(encoding="utf-8"))

model = {
    "months2026": months,
    "rev2026": rev_by_month,
    "y26": round(y26), "factJanNov": fact_jan_nov, "decRev": dec_rev, "novFull": nov["rev_full"],
    "y27": round(y27), "mo27": round(y27 / 12),
    "assumptions": A,
    "k26": {
        "dealerRev": round(d26), "retailRev": round(r26), "dealerShare": round(dealer_share * 100),
        "active": round(active, 1), "freq": round(deals_per_dealer, 1), "checkD": round(check_d),
        "retailN": round(r_n / 11, 1), "checkR": round(check_r), "deals": round(n_all / 11),
        "managers": 2, "topShare": round(top_avg), "newDealers": round(53 / 11, 1),
        "cost": round(cost_avg), "lead": 38,
        "gross": round(y26 * (1 - cost_avg / 100)),
        "revPerMgr": round(y26 / 12 / 2),
    },
    "k27": {
        "dealerRev": round(d27), "retailRev": round(r27), "dealerShare": round(share27 * 100),
        "active": round(active27), "freq": A["deals_per_dealer"], "checkD": round(check_d27),
        "retailN": round(retail_n27), "checkR": round(check_r27), "deals": round(deals27),
        "managers": round(managers27), "topShare": A["top_manager_cap"], "newDealers": A["new_dealers_per_month"],
        "cost": A["cost_share_cap"], "lead": 38,
        "gross": round(y27 * (1 - A["cost_share_cap"] / 100)),
        "revPerMgr": A["rev_per_manager"],
    },
    "bridge": [{**b, "v": round(b["v"])} for b in bridge],
    "season": [round(x, 3) for x in season_plan],
    "tasks": tasks,
    "seasonWs": [round(x, 3) for x in season_ws],
    "seasonRev": [round(x, 3) for x in season_rev],
    "wWs": w,
    "plan27": [round(x) for x in plan27],
    "demand": {"months": ws["months"], "queries": q, "core": core, "core27": demand27,
               "yoy": round(yoy, 3), "growth": round(growth, 3), "corr": round(demand_corr, 2),
               "revPerK26": round(rev_per_k26), "revPerK27": round(rev_per_k27), "source": ws["source"], "method": ws["method"]},
    "nov2026": {"active": fact[10]["act"], "rev": nov["rev_full"], "oct": fact[9]["rev"], "activeOct": fact[9]["act"]},
}

# Инварианты модели: если сломаются, страница не собирается.
assert abs(sum(model["plan27"]) - model["y27"]) <= 12
assert abs(sum(model["season"]) - 12) < 0.02
assert abs(model["k27"]["dealerRev"] + model["k27"]["retailRev"] - model["y27"]) <= 2
assert abs(sum(b["v"] for b in model["bridge"][1:-1]) + model["y26"] - model["y27"]) <= 5
assert abs(model["y27"] - 3 * model["y26"]) <= 3

html = (ROOT / "template.html").read_text(encoding="utf-8")
assert "—" not in html, "длинное тире запрещено правилами репо"
(ROOT / "index.html").write_text(html.replace("__MODEL__", json.dumps(model, ensure_ascii=False)), encoding="utf-8")
print(f"сезонность {[round(x,2) for x in season]}, корреляция спроса и выручки {demand_corr:.2f}, рост спроса {yoy:+.1%}")
print(f"2026 ~ {y26/1e6:.2f} млн, 2027 = {y27/1e6:.2f} млн, дилеров {active27:.1f}, розница {retail_n27:.1f}/мес, сделок {deals27:.0f}/мес")
