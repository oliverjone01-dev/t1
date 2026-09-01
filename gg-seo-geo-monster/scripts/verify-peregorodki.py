# -*- coding: utf-8 -*-
"""Сплошная сверка отчёта и лендинга по перегородкам с выгрузками API.

Зачем. За шесть кругов приёмки в этих документах нашли больше тридцати фактических
ошибок, и почти каждая была одного типа: цифра посчитана руками и разошлась с
источником, либо разошлась между двумя документами. Этот скрипт пересчитывает
каждое значение заново прямо из JSON и падает, если хоть одно не сходится.

Как запускать (из корня репозитория, после каждого нового замера):
    python3 gg-seo-geo-monster/scripts/verify-peregorodki.py

Выход 0 - всё сошлось. Выход 1 - список расхождений с указанием, что в документе
и что по данным. Ничего не берётся из текста документов, кроме проверок на
согласованность формулировок между ними.

Проверяет: Директ (кампании, дни, запросы), Метрику (заявки по каналам и меткам,
визиты, фразы, страницы), keys.so (сводки восьми доменов, постраничные срезы,
дубли каталога, фильтры конкурента), цены, счёт по плану, совпадение двух
документов и отсутствие em dash.
"""
import json, re, html, sys
from collections import defaultdict

R = lambda p: json.load(open(p, encoding="utf-8"))
camp  = R("yandex-direct/data/direct_campaigns.json")
daily = R("yandex-direct/data/direct_daily.json")
quer  = R("yandex-direct/data/direct_queries.json")
dmet  = R("yandex-direct/data/direct_metrika.json")
gmet  = R("gg-seo-geo-monster/data/genglass/metrika.json")
gkey  = R("gg-seo-geo-monster/data/genglass/keysso.json")

TS = "".join(open(f"phoenix/src/{f}", encoding="utf-8").read() for f in ("data.ts","sections.tsx","charts.tsx","App.tsx","lib.tsx"))
TS_DATA = open("phoenix/src/data.ts", encoding="utf-8").read()
HT = open("gg-seo-geo-monster/public/peregorodki-audit.html", encoding="utf-8").read()
HTX = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<style.*?</style>", "", HT, flags=re.S))))

ok, bad = [], []
def check(name, expect, got, note=""):
    (ok if expect == got else bad).append((name, expect, got, note))

def inboth(name, needle_ts, needle_ht):
    """Утверждение должно присутствовать в обоих документах."""
    a, b = needle_ts in TS, needle_ht in HTX
    (ok if (a and b) else bad).append((name, "в обоих", f"data.ts={a}, отчёт={b}", ""))

# ---------- ДИРЕКТ ----------
T = camp["totals"]
check("Директ: расход",           150096, round(T["spend"]))
check("Директ: клики",             1345,  T["clicks"])
check("Директ: показы",           91361,  T["impressions"])
check("Директ: активных кампаний",    8,  len([c for c in camp["campaigns"] if c["imp"] or c["clicks"] or c["spend"]]))
check("Директ: с расходом",           7,  len([c for c in camp["campaigns"] if c["spend"] > 0]))
check("Директ: все активные перегородочные", 0,
      len([c for c in camp["campaigns"] if (c["imp"] or c["clicks"] or c["spend"]) and "ерегородк" not in c["name"]]))
check("Директ: средний CPC",        112,  round(T["spend"]/T["clicks"]))
check("Директ: итоговый CTR %",    1.47,  round(100*T["clicks"]/T["impressions"], 2))

by = {c["name"]: c for c in camp["campaigns"]}
srch = [c for c in camp["campaigns"] if "Поиск" in c["name"] and c["spend"] > 0]
check("Поиск: расход",            112647, round(sum(c["spend"] for c in srch)))
check("Поиск: доля расхода %",        75, round(100*sum(c["spend"] for c in srch)/T["spend"]))
check("Поиск: клики",                906, sum(c["clicks"] for c in srch))
check("Поиск: доля кликов %",         67, round(100*sum(c["clicks"] for c in srch)/T["clicks"]))
tg = [c for c in camp["campaigns"] if "| ТГ" in c["name"]]
check("ТГ: расход",                23869, round(sum(c["spend"] for c in tg)))
check("ТГ: доля %",                   16, round(100*sum(c["spend"] for c in tg)/T["spend"]))
check("ТГ: клики",                   186, sum(c["clicks"] for c in tg))
check("ТГ: CPC",                     128, round(sum(c["spend"] for c in tg)/sum(c["clicks"] for c in tg)))
check("ТГ: агрегатный CTR %",       1.79, round(100*sum(c["clicks"] for c in tg)/sum(c["imp"] for c in tg), 2))
rsya = [c for c in camp["campaigns"] if "РСЯ - ПК" in c["name"]][0]
check("РСЯ: расход",               13580, round(rsya["spend"]))
check("РСЯ: клики",                  217, rsya["clicks"])
check("РСЯ: CPC",                     63, round(rsya["spend"]/rsya["clicks"]))
check("РСЯ: CTR",                   0.32, rsya["ctr"])
check("РСЯ: показы",               68647, rsya["imp"])
rt = [c for c in camp["campaigns"] if "| РТ |" in c["name"]][0]
check("Ретаргетинг: расход",           0, round(rt["spend"]))
check("Ретаргетинг: клики",           36, rt["clicks"])
check("Ретаргетинг: CTR",           0.74, rt["ctr"])
# ниже итогового CTR ровно две кампании
below = [c["name"] for c in camp["campaigns"] if (c["imp"] or c["clicks"]) and c["ctr"] < 1.47]
check("Кампаний ниже итогового CTR", 2, len(below), str(below))

# дневной расход до/после остановки ТГ
tot, srchd, tgd = defaultdict(float), defaultdict(float), defaultdict(float)
for r in daily["days"]:
    tot[r["date"]] += r["spend"]
    if "Поиск" in r["camp"]: srchd[r["date"]] += r["spend"]
    if "| ТГ" in r["camp"]:  tgd[r["date"]]  += r["spend"]
lastTG = max(d for d in tgd if tgd[d] > 0)
check("ТГ: последний день с расходом", "2026-08-16", lastTG)
A = [d for d in tot if d <= lastTG]; B = [d for d in tot if d > lastTG]
check("Дней до",  16, len(A));  check("Дней после", 14, len(B))
check("Расход до",     75292, round(sum(tot[d] for d in A)))
check("Расход после",  74803, round(sum(tot[d] for d in B)))
check("В день до",      4706, round(sum(tot[d] for d in A)/len(A)))
check("В день после",   5343, round(sum(tot[d] for d in B)/len(B)))
check("Поиск/день до",  3202, round(sum(srchd[d] for d in A)/len(A)))
check("Поиск/день после",4386, round(sum(srchd[d] for d in B)/len(B)))
check("Рост дневного %", 13.5, round(100*(sum(tot[d] for d in B)/len(B))/(sum(tot[d] for d in A)/len(A))-100, 1))
check("Рост поиска %",     37, round(100*(sum(srchd[d] for d in B)/len(B))/(sum(srchd[d] for d in A)/len(A))-100))

# запросы
qr = quer["rows"]
heads = [r for r in qr if r["query"].strip() in ("межкомнатные перегородки","перегородки межкомнатные","перегородки")]
check("Головные: показы", 183, sum(r["imp"] for r in heads))
check("Головные: клики",    6, sum(r["clicks"] for r in heads))
check("Головные: расход", 481, round(sum(r["spend"] for r in heads)))
check("Головные: CTR %", 3.28, round(100*sum(r["clicks"] for r in heads)/sum(r["imp"] for r in heads), 2))
check("Все запросы: показы", 3829, sum(r["imp"] for r in qr))
check("Все запросы: клики",   469, sum(r["clicks"] for r in qr))
check("Все запросы: CTR %", 12.25, round(100*sum(r["clicks"] for r in qr)/sum(r["imp"] for r in qr), 2))
def theme(rx):
    sel=[r for r in qr if re.search(rx, r["query"], re.I)]
    return sum(r["clicks"] for r in sel), round(sum(r["spend"] for r in sel)), round(sum(r["spend"] for r in sel)/max(1,sum(r["clicks"] for r in sel)))
check("Тема стекло",    (94,18210,194), theme(r"стекл"))
check("Тема гармошка",  (112,13503,121), theme(r"гармошк|складн"))
check("Тема зонирование",(100,6928,69),  theme(r"зониров"))
check("Тема раздвижные",(99,15044,152),  theme(r"раздвиж|купе"))
check("Тема лофт",        (9,1462,162),  theme(r"лофт|loft"))
check("Тема гардероб",    (5,504,101),   theme(r"гардероб"))
check("Отношение стекло/зонирование", 2.8, round(theme(r"стекл")[2]/theme(r"зониров")[2], 1))
check("«межкомнатные перегородки» в СЧ: 44 показа 0 кликов", True,
      any(r["imp"]==44 and r["clicks"]==0 and r["query"]=="межкомнатные перегородки" and "СЧ" in r["camp"] for r in qr))

# ---------- МЕТРИКА ----------
bs = {r["source"]: r for r in dmet["by_source"]}
check("Реклама: визиты",  4047, bs["Ad traffic"]["visits"])
check("Реклама: заявки",    95, bs["Ad traffic"]["leads"])
check("Поиск: визиты",    2704, bs["Search engine traffic"]["visits"])
check("Поиск: заявки",     133, bs["Search engine traffic"]["leads"])
check("Прямые",       (978,32), (bs["Direct traffic"]["visits"], bs["Direct traffic"]["leads"]))
check("Ссылки",        (560,5), (bs["Link traffic"]["visits"], bs["Link traffic"]["leads"]))
check("Внутренние",    (275,8), (bs["Internal traffic"]["visits"], bs["Internal traffic"]["leads"]))
rest = [r for r in dmet["by_source"] if r["source"] not in
        ("Ad traffic","Search engine traffic","Direct traffic","Link traffic","Internal traffic")]
check("Прочее",         (47,1), (sum(r["visits"] for r in rest), sum(r["leads"] for r in rest)))
check("Весь сайт", (8611,274), (sum(r["visits"] for r in dmet["by_source"]), sum(r["leads"] for r in dmet["by_source"])))
check("CR реклама %",  2.35, round(100*95/4047, 2))
check("CR поиск %",    4.92, round(100*133/2704, 2))
check("CR сайт %",     3.18, round(100*274/8611, 2))
check("CPL",           1580, round(T["spend"]/95))
check("Поиск/реклама заявки", 1.4, round(133/95, 1))
check("Расхождение клики/визиты", 3.0, round(4047/1345, 1))
aug = {str(r["cid"]) for r in daily["days"]}
u = dmet["by_utm"]
c1 = sum(r["leads"] for r in u if r["utm"].startswith("peregorodki_") and r["utm"].split("_")[1] in aug)
c2 = sum(r["leads"] for r in u if r["utm"] == "peregorodki")
check("Заявок с номером кампании", 43, c1)
check("Заявок под общей меткой",   49, c2)
check("Заявок под прочими",         5, sum(r["leads"] for r in u)-c1-c2)
check("Сумма by_utm заявок",       97, sum(r["leads"] for r in u))
check("Сумма by_utm визитов",    4042, sum(r["visits"] for r in u))
# geo-monster metrika
v = gmet["visits_30d"]
check("Метрика: визитов 30д", 8611, sum(x["visits"] for x in v))
check("Метрика: поисковых",   2127, sum(x["search_visits"] for x in v))
check("Метрика: цели пусты",  [],   gmet["goals"])
ph = gmet["top_phrases"]
brand = [x for x in ph if any(b in x["phrase"].lower() for b in ("genglass","генгласс","генглас","ген гласс","gen glass","дженгласс"))]
check("Срез фраз: визитов",  211, sum(x["visits"] for x in ph))
check("Брендовых визитов",   152, sum(x["visits"] for x in brand))
check("Брендовых фраз",       27, len(brand))
check("Доля бренда %",        72, round(100*152/211))
check("Доля среза фраз %",    10, round(100*211/sum(x["search_visits"] for x in v)))
tp = {p["url"]: p["visits"] for p in gmet["top_pages"]}
check("Срез страниц: визитов", 1293, sum(tp.values()))
check("Доля среза страниц %",    15, round(100*sum(tp.values())/8611))
per6 = {u_: w for u_, w in tp.items() if "mezhkomnatnye-peregorodki" in u_}
check("Перегородочных страниц", 6, len(per6))
check("Перегородочных визитов",120, sum(per6.values()))
zer = {u_: w for u_, w in tp.items() if ("mirror" in u_ or "zerkal" in u_) and "mezhkomnatnye-peregorodki" not in u_}
check("Зеркальных адресов",     11, len(zer))
check("Зеркальных визитов",    322, sum(zer.values()))
check("Зеркальные/перегородки", 2.7, round(sum(zer.values())/sum(per6.values()), 1))
check("Столы",                 105, tp.get("/stoly-na-zakaz/"))
check("Блог о зеркалах в зеркальных", 39, tp.get("/blog/populyarnye-modeli-zerkal-2026-goda-i-aktualnye-interernye-resheniya/"))
perph = [x for x in ph if "перегород" in x["phrase"].lower() or "зониров" in x["phrase"].lower()]
check("Перегородочных фраз", (5,11), (len(perph), sum(x["visits"] for x in perph)))

# ---------- KEYS.SO ----------
KP = "gg-seo-geo-monster/data/keyso-peregorodki"
D = {d: R(f"{KP}/{d}/dashboard.json")["data"] for d in
     ("genglass.ru","fdmebel.ru","oki-doki.ru","nayada.ru","loftcase.ru","kristal360.ru","peregorodki-prostor.ru")}
for d, exp in {
  "fdmebel.ru":(306,750,2389,196,0,119,197,19), "oki-doki.ru":(196,586,2007,54,215,107,177,27),
  "nayada.ru":(124,286,1631,44,272,131,222,29), "genglass.ru":(75,434,2108,37,342,53,269,25),
  "loftcase.ru":(63,315,1235,26,151,25,138,18), "kristal360.ru":(0,0,0,0,701,0,0,7),
  "peregorodki-prostor.ru":(0,0,2,0,491,0,1,8)}.items():
    x = D[d]
    check(f"keys.so {d}", exp, (x["it3"],x["it10"],x["it50"],x["vis"],x["adkeyscnt"],x["aiAnswersCnt"],x["pagesinindex"],x["dr"]))
for d, exp in {"nayada.ru":0.59,"fdmebel.ru":0.60,"oki-doki.ru":0.60,"genglass.ru":0.20,"loftcase.ru":0.18}.items():
    check(f"ИИ на страницу {d}", exp, round(D[d]["aiAnswersCnt"]/D[d]["pagesinindex"], 2))
sp = lambda group, dom: [r for r in R(f"{KP}/{group}/deep/sitepages.json")["data"]["data"] if r["domain"] == dom]
gg, lc = sp("kristal360.ru","genglass.ru"), sp("loftcase.ru","loftcase.ru")
ggp = [r for r in gg if "peregorod" in r["url"]]
lcp = [r for r in lc if "peregorod" in r["url"] or "partition" in r["url"]]
check("Наших страниц в срезе", 50, len(gg))
check("Наших перегородочных", 33, len(ggp))
check("Наша заметность всего", 540, sum(r["vis"] for r in gg))
check("Наша заметность перегородок", 183, sum(r["vis"] for r in ggp))
check("Доля перегородок %", 34, round(100*sum(r["vis"] for r in ggp)/sum(r["vis"] for r in gg)))
check("loftcase перегородочных", 30, len(lcp))
check("loftcase заметность всего", 1126, sum(r["vis"] for r in lc))
check("loftcase заметность перегородок", 1042, sum(r["vis"] for r in lcp))
check("loftcase доля %", 93, round(100*sum(r["vis"] for r in lcp)/sum(r["vis"] for r in lc)))
check("Разрыв раз", 5.7, round(sum(r["vis"] for r in lcp)/sum(r["vis"] for r in ggp), 1))
m = {r["url"]: r for r in lc}
check("loftcase /partition", (503,11,21,32), tuple(m["/partition"][k] for k in ("vis","it3","it10","it50")))
check("loftcase /peregorodki", (441,6,62,455), tuple(m["/peregorodki"][k] for k in ("vis","it3","it10","it50")))
check("Две страницы дают", 944, m["/partition"]["vis"]+m["/peregorodki"]["vis"])
check("loftcase гардеробные", 55, m["/mebel/f/kategoriya_mebeli-garderobnye"]["vis"])
f = [r for r in lc if r["url"].startswith("/peregorodki/f/")]
check("Фильтров у loftcase", 9, len(f))
check("Фильтры дают", 4, sum(r["vis"] for r in f))
check("Фильтров с нулём", 7, len([r for r in f if r["vis"] == 0]))
g = {r["url"]: r for r in gg}
for u_, exp in {
  "/mezhkomnatnye-peregorodki-na-zakaz/teleskopicheskie-i-kaskadnye-peregorodki":(69,5,5,10),
  "/mezhkomnatnye-peregorodki-na-zakaz":(43,4,11,45),
  "/mezhkomnatnye-peregorodki-na-zakaz/arochnye-peregorodki":(15,2,5,6),
  "/mezhkomnatnye-peregorodki-na-zakaz/loft-peregorodki":(12,2,13,31),
  "/mezhkomnatnye-peregorodki-na-zakaz/razdvizhnye-steklyannye-peregorodki":(5,0,2,21),
  "/mezhkomnatnye-peregorodki-na-zakaz/peregorodki-garmoshka":(1,0,6,18),
  "/mezhkomnatnye-peregorodki-na-zakaz/peregorodki-stellazhi":(0,0,1,29)}.items():
    check(f"наша {u_.rsplit('/',1)[-1]}", exp, tuple(g[u_][k] for k in ("vis","it3","it10","it50")))
pc = "/product-category/mezhkomnatnye-peregorodki/"
main_ = {u_.rsplit("/",1)[-1] for u_ in g if u_.startswith("/mezhkomnatnye-peregorodki-na-zakaz/")}
old   = {u_.rsplit("/",1)[-1] for u_ in g if u_.startswith(pc)}
check("Задвоенных категорий", 4, len(main_ & old))
orph = sorted(old - main_)
check("Сирот в старом дереве", 5, len(orph))
check("Заметность сирот", 6, sum(g[pc+o]["vis"] for o in orph))
check("Гардеробных у нас", 0, len([u_ for u_ in g if "garderob" in u_]))
check("Фильтров у нас",   0, len([u_ for u_ in g if "/f/" in u_]))
check("8-я по силе страница сайта", ("steklyannye-doski", 64),
      (gkey["top_pages"][7]["url"].rsplit("/",1)[-1], gkey["top_pages"][7]["keywords_top50"]))
check("Перегородок в топ-10 сильнейших", 0, len([p for p in gkey["top_pages"] if "peregorod" in p["url"]]))
adc = gkey["ad_competitors"]
check("Рекламных конкурентов", 10, len(adc))
check("С нулевой заметностью", 4, len([c for c in adc if c["visibility"] == 0]))
check("С заметностью 1-11",   4, len([c for c in adc if 0 < c["visibility"] <= 11]))
check("Наше место по рекламным ключам", 3,
      1+len([d for d in D if D[d]["adkeyscnt"] > D["genglass.ru"]["adkeyscnt"]]))
check("Наше место по топ-3", 4, 1+len([d for d in D if D[d]["it3"] > D["genglass.ru"]["it3"]]))

# ---------- ЦЕНЫ ----------
PB = open("gg-seo-geo-monster/knowledge/price-benchmark-peregorodki-july.md", encoding="utf-8").read()
for label, us, mk, dl in (("Стационарная",93896,165454,"-43,25%"),("Распашная",251976,327460,"-23,05%"),("Раздвижная",271736,342256,"-20,60%")):
    check(f"Цена {label} наша",  True, str(us)[:3]+" "+str(us)[3:] in PB or f"{us//1000} {us%1000:03d}" in PB)
    check(f"Цена {label} рынок", True, f"{mk//1000} {mk%1000:03d}" in PB)
    check(f"Отклонение {label}", True, dl in PB)

# ---------- СОГЛАСОВАННОСТЬ ДВУХ ДОКУМЕНТОВ ----------
inboth("Оба: CTR-формулировка", "средней по строкам не является", "средней по строкам не является")
inboth("Оба: E0 условие",       "не задачей, а условием",         "не задачей, а условием")
inboth("Оба: знаменатель 2 127","211 визитов из 2 127",           "211 визитов из 2 127")
check("Отчёт: 16 строк плана", 16, len(re.findall(r'<tr><td>[A-Z]\d+\.', HT)))
check("Лендинг: 16 строк плана", 16, len(re.findall(r'\{ id: "', TS_DATA)))
check("Отчёт: не сделано 9", True, "не сделано - 9" in HTX)
check("Лендинг: ctr ТГ 1.79",  True, "ctr: 1.79" in TS_DATA)
check("Отчёт: самоприсвоенного вердикта нет", 0, HTX.count("вердикт go"))
for f_, txt in (("data.ts",TS),("sections.tsx",open("phoenix/src/sections.tsx",encoding="utf-8").read()),
                ("charts.tsx",open("phoenix/src/charts.tsx",encoding="utf-8").read()),
                ("styles.css",open("phoenix/src/styles.css",encoding="utf-8").read()),("отчёт",HT)):
    check(f"Тире в {f_}", 0, txt.count("—")+txt.count("–"))

print(f"СОШЛОСЬ: {len(ok)}   РАСХОЖДЕНИЙ: {len(bad)}\n")
for n,e,gv,note in bad: print(f"  РАСХОЖДЕНИЕ  {n}\n      в документе: {e}\n      по данным:   {gv}  {note}")
sys.exit(1 if bad else 0)
