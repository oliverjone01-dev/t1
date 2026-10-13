"""HTML прототипа «два столбца Начислено» Маркета (v12) из JSON proto_two_cols.ts.
Запуск: cd analytics-mvp && npx tsx ../tools/ym-sverka/proto_two_cols.ts > /tmp/p2.json
        python3 ../tools/ym-sverka/proto_two_cols_html.py /tmp/p2.json out.html
"""
import json, sys, html

j = json.load(open(sys.argv[1]))
out = sys.argv[2]
E = html.escape


def rub(v, sign=False):
    if v is None:
        return "-"
    s = f"{abs(round(v)):,}".replace(",", " ")
    neg = round(v) < 0
    return ("−" if neg else ("+" if sign and round(v) > 0 else "")) + s


def dd(s):
    return f"{s[8:10]}.{s[5:7]}" if s else ""


R = j["res"]
TO = j["to"]

# --- главная таблица: строки × (месяц: столбец 1, столбец 2) ---
rows = [
    ("Начислено (оборот)", lambda c, k: c["acc"], "b"),
    ("в т.ч. получено от покупателей", lambda c, k: c["got"], "s"),
    ("в т.ч. возвращено покупателям", lambda c, k: c["back"], "s"),
    ("Штук (продано минус возвраты)", lambda c, k: c["units"], "n"),
    ("Сборы Маркета деньгами", lambda c, k: -c["fee"], ""),
    ("К выплате", lambda c, k: c["amount"], "b"),
    ("С\\С производства", lambda c, k: -c["cogs"], ""),
    ("Наша доставка (ведомость)", lambda c, k: None if k == 1 else -c["ship"], ""),
    ("АДМ 30% от К выплате", lambda c, k: -c["adm"], ""),
    ("Налог 15% от «Начислено»", lambda c, k: -c["tax"], ""),
    ("Чистая прибыль по заказам", lambda c, k: c["np"], "b"),
    ("Общие расходы кабинета (без заказа)", lambda c, k: c["gen"], ""),
    ("Чистая прибыль с общими", lambda c, k: c["netAll"], "b"),
]
th = "".join(f'<th colspan="2">{E(r["k"])}</th>' for r in R)
th2 = "".join('<th class="c1">1. Начислил Маркет<br><span>справочно, как сейчас</span></th><th class="c2">2. По заказам со сборами<br><span>основа расчёта</span></th>' for _ in R)
body = ""
for name, fn, cls in rows:
    tds = ""
    for r in R:
        for k, c in ((1, r["c1"]), (2, r["c2"])):
            v = fn(c, k)
            txt = ("не считалась" if v is None else (str(round(v)) if cls == "n" else rub(v)))
            tds += f'<td class="{"c1" if k == 1 else "c2"}{" na" if v is None else ""}">{txt}</td>'
    body += f'<tr class="{cls}"><td>{E(name)}</td>{tds}</tr>'
main = f'<table class="t"><thead><tr><th></th>{th}</tr><tr><th></th>{th2}</tr></thead><tbody>{body}</tbody></table>'

# --- мост 1 -> 2 ---
bridge = ""
for r in R:
    c1, c2, B = r["c1"], r["c2"], r["bridge"]
    lines = [
        ("Столбец 1: Начислено (как сейчас)", c1["acc"], "b"),
        (f"− оплачены в периоде, сборы за продажу ещё не пришли ({B['nInFly']} заказов: в пути или отменены)", -B["inPeriodNoFeeYet"], ""),
        (f"− оплачены в периоде, сборы пришли в следующем месяце ({B['nLater']} заказов)", -B["inPeriodFeeLater"], ""),
        ("+ оплачены в прошлых месяцах, сборы за продажу пришли в этом", c2["gotPrev"], ""),
        (f"+ возвраты денег по заказам без сборов за продажу (оплатили и отменили до доставки, {c2['backNoFeeN']} строк)", -c2["backNoFee"], ""),
    ]
    chk = sum(v for _, v, _ in lines)
    lines.append(("= Столбец 2: Начислено по заказам со сборами", c2["acc"], "b"))
    ok = abs(chk - c2["acc"]) < 1
    bridge += f'<h3>{E(r["k"])}</h3><table class="t br">' + "".join(
        f'<tr class="{cl}"><td>{E(t)}</td><td>{rub(v, sign=not cl)}</td></tr>' for t, v, cl in lines
    ) + f'</table><p class="note">Проверка: сумма строк {rub(chk)} ₽, столбец 2 {rub(c2["acc"])} ₽ - {"сходится до рубля" if ok else "НЕ СХОДИТСЯ"}.</p>'

# --- примеры ---
KIND = {"pay": "платёж покупателя", "back": "возврат покупателю", "fee": "сбор", "other": "прочее"}
ex = ""
for e in j["ex"]:
    trs = ""
    for x in e["rows"]:
        if x["kind"] == "fee" and x["f"] == "cofin":
            what = f"сбор баллами (справочно): {x['svc']}"
        elif x["kind"] == "fee":
            what = f"сбор деньгами: {x['svc']}"
        else:
            what = f"{KIND.get(x['kind'], x['kind'])}: {x['svc']}"
        trs += f'<tr><td>{dd(x["d"])}</td><td>{E(what)}</td><td>{rub(x["a"])}</td></tr>'
    m1 = e["firstFee"][:7]
    ship = "в ведомости нет" if e["ship"] is None else f"{rub(e['ship'])} ₽"
    ex += f'''<details><summary><b>{E(e["order"])}</b> · {E(e["sku"] or "")} · оформлен {dd(e["created"] or "")} · сбор за продажу {dd(e["firstFee"])} → столбец 2 в <b>{"августе" if m1 == "2026-08" else "сентябре" if m1 == "2026-09" else m1}</b> · наша доставка {ship}</summary>
<table class="t ex"><tbody>{trs}</tbody></table></details>'''

ex_note = {
    0: "оплачен в августе, доставлен в сентябре: в столбце 1 доход в августе, а сборы в сентябре; в столбце 2 доход и сборы оба в сентябре.",
}

# --- кто вёз ---
unseen = ""
for r in R:
    c2 = r["c2"]
    cov = f'{c2["orders"]} заказов в столбце 2: нашу перевозку видно у {c2["shipOrders"]}, доставку Маркета (его услуга в реестре) у {c2["mpDelivOrders"]}, не видно ни того ни другого у {len(c2["unseen"])}.'
    li = "".join(
        f'<tr><td>{E(u["order"])}</td><td>{dd(u["d"])}</td><td>{E(u["sku"])}</td><td>{E(u["name"])}</td><td>{"в ведомости с суммой 0 или пусто" if u["inLedger"] else "в ведомости нет"}</td></tr>'
        for u in c2["unseen"]
    )
    unseen += f'<h3>{E(r["k"])}</h3><p>{E(cov)}</p><table class="t sm"><thead><tr><th>Заказ</th><th>Сбор за продажу</th><th>Артикул</th><th>Товар</th><th>Ведомость</th></tr></thead><tbody>{li}</tbody></table>'

a, s = R[0], R[1]
page = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Маркет: два столбца</title>
<style>
:root{{--bg:#f7f7f5;--card:#fff;--ink:#1b1d21;--mute:#6b7280;--bd:#e3e3df;--c1:#f1f1ee;--c2:#e9f4ff;--acc:#1d6fd8;--bad:#b42318;--ok:#067647}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#111316;--card:#181b20;--ink:#e8e8e6;--mute:#9aa1ab;--bd:#2a2f36;--c1:#1d2026;--c2:#14263b;--acc:#6aa8ff;--bad:#f97066;--ok:#47cd89}}}}
:root[data-theme="dark"]{{--bg:#111316;--card:#181b20;--ink:#e8e8e6;--mute:#9aa1ab;--bd:#2a2f36;--c1:#1d2026;--c2:#14263b;--acc:#6aa8ff;--bad:#f97066;--ok:#47cd89}}
body{{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}}
main{{max-width:1100px;margin:0 auto;padding:20px 16px 60px}}
h1{{font-size:22px;margin:0 0 4px}} h2{{font-size:17px;margin:28px 0 8px}} h3{{font-size:14px;margin:16px 0 6px}}
.card{{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px 16px;margin:12px 0;overflow-x:auto}}
.note,.mute{{color:var(--mute);font-size:13px}}
.t{{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}}
.t td,.t th{{padding:6px 8px;border-bottom:1px solid var(--bd);text-align:right;white-space:nowrap}}
.t td:first-child,.t th:first-child{{text-align:left;white-space:normal}}
.t th{{font-weight:600;font-size:12px}} .t th span{{font-weight:400;color:var(--mute)}}
.t .c1{{background:var(--c1);color:var(--mute)}} .t .c2{{background:var(--c2)}}
.t tr.b td{{font-weight:700}} .t tr.s td:first-child{{padding-left:22px;color:var(--mute)}}
.t td.na{{font-size:12px}}
.br td:last-child{{width:140px}} .ex td:nth-child(2){{text-align:left;white-space:normal}} .ex td:first-child{{width:50px}}
.sm td{{font-size:12px}} .sm td:nth-child(4),.sm td:nth-child(5){{text-align:left;white-space:normal}}
details{{border-top:1px solid var(--bd);padding:8px 0}} summary{{cursor:pointer}}
.q li{{margin:6px 0}} b.r{{color:var(--acc)}}
.warn{{border-left:3px solid var(--bad)}}
</style></head><body><main>
<h1>Яндекс Маркет: два столбца «Начислено»</h1>
<p class="mute">Прототип для проверки, в дашборд ещё не встроен. Источник - реестр взаиморасчётов (API) и ведомость доставки, снимок на 01.10. Август полный, сентябрь по {dd(TO)} (последний день, за который пришли сборы).</p>

<div class="card">
<b>Зачем второй столбец.</b> Маркет проводит деньги покупателя в день оплаты, а свои сборы за продажу - в день доставки (в среднем через 8-10 дней). На стыке месяцев доход стоял в одном месяце, а расходы по тем же заказам в другом. Второй столбец берёт доход только тех заказов, по которым в периоде пришли сборы Маркета за продажу, поэтому доход и расходы относятся к одним и тем же заказам. От него считаются К выплате, наша доставка, С\\С, АДМ, налог и чистая. Первый столбец остаётся справочно.
</div>

<h2>Итог</h2>
<div class="card">{main}
<p class="note">Сборы Маркета в обоих столбцах одни и те же: все денежные сборы, проведённые в периоде. Списания баллами в «Начислено» и сборы не входят, как и сейчас (справка по баллам на вкладке не меняется). Первый столбец совпадает с вкладкой «Отчет» до округления строк: сентябрь 4 502 661 ₽ в обоих, сборы 761 484 против 761 441 на вкладке (вкладка округляет каждую строку день×артикул).</p></div>

<div class="card warn"><b>Что важно увидеть.</b>
<ul>
<li>Чистая прибыль во втором столбце отрицательная: август {rub(a["c2"]["np"])} ₽, сентябрь {rub(s["c2"]["np"])} ₽. Причины две: доход ниже (из него ушли оплаты заказов, которые не доехали или отменены) и впервые вычтена наша доставка ({rub(a["c2"]["ship"])} и {rub(s["c2"]["ship"])} ₽). В первом столбце нашей доставки не было вовсе.</li>
<li>Отменённые заказы второй столбец отсекает сам: у заказа, который оплатили и отменили, сборов за продажу нет. В первом столбце они пока сидят, потому что статус платежа ещё не перезабран (август в нём завышен примерно на 0,5 млн ₽, это видно по эталону после перезабора: 4 261 757 ₽).</li>
<li>Сентябрь во втором столбце меньше заказов, чем оплачено в сентябре: {s["bridge"]["nInFly"]} заказа на {rub(s["bridge"]["inPeriodNoFeeYet"])} ₽ оплачены, но сборов за продажу по ним ещё нет. Те, что доедут, уйдут в октябрь.</li>
</ul></div>

<h2>Как первый столбец превращается во второй</h2>
<div class="card">{bridge}</div>

<h2>Примеры заказов на стыке месяцев</h2>
<div class="card"><p class="note">Нажмите на заказ, чтобы увидеть все его проводки в реестре.</p>{ex}
<ul class="note">
<li>59831744643 и 59859204673: оплачены в августе, доставлены в сентябре. Столбец 1: доход в августе, сборы в сентябре. Столбец 2: доход и сборы в сентябре.</li>
<li>58779988547: оплачен в июле, доставлен 01.08. В столбце 2 весь заказ в августе. Нашей перевозки в ведомости нет, услуги доставки Маркета тоже - он в списке «не видно, кто доставлял».</li>
<li>60558005824: доставлен в августе (в столбце 2 августа с доходом 8 606 ₽), возвращён 05.09: возврат −8 606 ₽ и сбор за обратную доставку стоят в сентябре, по дате возврата.</li>
</ul></div>

<h2>Кто вёз заказы второго столбца</h2>
<div class="card">{unseen}<p class="note">Ведомость без строк «ОТМЕНЕН», возвраты и рекламации учтены (решение 02.10). Перевозка заказа целиком ложится в месяц, где заказ попал во второй столбец.</p></div>

<h2>Нужно ваше «да» по правилам (до кода)</h2>
<div class="card"><ol class="q">
<li><b>Какие сборы значат «заказ продан».</b> Сбор за размещение товарного предложения или перевод платежа (деньгами или баллами). Приём платежа приходит в день оплаты, штрафы бывают и у отменённых, поэтому они не признак. <b class="r">(рекомендую)</b></li>
<li><b>Доход заказа берётся целиком</b>, даже если оплата была в прошлом месяце. <b class="r">(рекомендую)</b></li>
<li><b>Возвраты</b> - в месяце возврата, только по заказам, которые уже прошли во втором столбце. Возврат денег по заказу без сборов (оплатили и отменили до доставки) во второй столбец не идёт, его оплаты там тоже нет. <b class="r">(рекомендую)</b></li>
<li><b>Сборы</b> - все денежные сборы периода, как в первом столбце (в том числе обратная доставка по возвратам и штрафы). <b class="r">(рекомендую)</b></li>
<li><b>Ставки</b>: АДМ 30% от «К выплате» второго столбца, налог 15% от «Начислено» второго столбца. В первом столбце АДМ и налог тоже показываем справочно, как сейчас. <b class="r">(рекомендую)</b></li>
</ol>
<p>Ответ «да» - встраиваю в вкладку «Отчет» и блок «Аналитика по артикулам», с тестами на эти примеры заказов.</p></div>
<p class="mute">Прототип: tools/ym-sverka/proto_two_cols.ts (классификация проводок та же, что в дашборде), страница: tools/ym-sverka/proto_two_cols_html.py.</p>
</main></body></html>'''
open(out, "w").write(page)
print("ok", out)
