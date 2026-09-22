# Макет вкладки «Тесты» (OZON). Запускать из analytics-mvp:
#   python3 tools/tests/gen_tests_mock.py
# Читает: tools/tests/tests.json (определения тестов), tools/tests/tests_campaigns.psv (лог кампаний
# кабинета: ставки, показы, пара тест-контроль), data/reakciya.json (измеренные тесты),
# data/sku_views.ndjson + data/sku_offer.json (посуточные показы и заказы по артикулам).
# Пишет: tools/tests/katya-tests-mock.html
#
# Состав вкладки согласован 22.09: три теста из tests.json + блок «измеренные» из Реакции.
# Три не запущенные заготовки из ветки tests в reakciya.json на вкладку не идут.
#
# Цвета серий графика взяты из валидированной палитры dataviz и проверены скриптом
# validate_palette.js на тёмной подложке #12161f: синий #3987e5 (тест) и оранжевый #d95926
# (контроль) проходят все шесть проверок, включая разделимость при цветослепоте.
# ВАЖНО при переносе в build-katya.ts: страничный JS там живёт внутри backtick-шаблона,
# где \d и \s в регулярках схлопываются. Здесь регулярок нет, но код ниже это учитывает.
import json, csv, datetime, html, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "tools", "tests")
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(SRC, "katya-tests-mock.html")

C_TEST, C_CTRL = "#3987e5", "#d95926"

T = json.load(open(os.path.join(SRC, "tests.json"), encoding="utf-8"))
log = {}
for r in csv.DictReader(open(os.path.join(SRC, "tests_campaigns.psv"), encoding="utf-8"), delimiter="|"):
    log[r["товар"]] = r
rea = json.load(open(os.path.join(DATA, "reakciya.json"), encoding="utf-8"))
measured = [t for t in rea.get("tests", []) if t.get("status") == "измерен"]

# Посуточный ряд по артикулам: показы в поиске и заказы. Ключ снимка - sku OZON,
# поэтому переводим его в артикул через sku_offer.json.
sku2art = json.load(open(os.path.join(DATA, "sku_offer.json"), encoding="utf-8"))
series = collections.defaultdict(dict)
for line in open(os.path.join(DATA, "sku_views.ndjson"), encoding="utf-8"):
    r = json.loads(line)
    art = sku2art.get(str(r["sku"]))
    if not art:
        continue
    cell = series[art].setdefault(r["date"], [0, 0])
    cell[0] += r.get("vsearch") or 0
    cell[1] += r.get("units") or 0
LAST = max((d for a in series for d in series[a]), default="")

TODAY = datetime.date.today()

def esc(s):
    return html.escape(str(s))

def num(s):
    try:
        return float(str(s).replace(" ", "").replace(",", "."))
    except Exception:
        return None

def days_to(d):
    try:
        return (datetime.date.fromisoformat(d) - TODAY).days
    except Exception:
        return None

def statuschip(t):
    st = t.get("статус")
    if st and "не запущен" in st:
        return '<span class="chip chip-off">не запущен</span>'
    dm = days_to(t.get("замер") or "")
    if dm is None:
        return '<span class="chip chip-off">не запущен</span>'
    if dm > 0:
        return f'<span class="chip chip-run">идёт · замер через {dm} дн</span>'
    return '<span class="chip chip-done">пора мерить</span>'

# Одна строка = одна пара «тест против контроля». Контроль берём из лога кампаний
# (колонка `контроль`), а не из порядка в tests.json: в логе зафиксировано, с кем
# именно сравнивали, и там же лежат показы контроля на ту же неделю.
def pairrow(sku):
    r = log.get(sku)
    if not r:
        return (f'<tr><td>{esc(sku)}</td><td colspan="4" class="muted">нет в логе кампаний</td>'
                f'<td class="sep muted" colspan="3">пара не зафиксирована</td><td class="r muted">-</td></tr>'), None
    ct = r.get("контроль", "").strip()
    vt, vc = num(r.get("показы_за_неделю_до")), num(r.get("контроль_показы"))
    delta = (vt - vc) / vc * 100 if (vt and vc and vc > 0) else None
    dcls = "warn" if (delta is not None and abs(delta) > 20) else ""
    dtxt = "-" if delta is None else f"{delta:+.0f} %"
    rec = esc(r.get("ставка_рекоменд", "") or "-")
    fin = esc(r.get("ставка_финальная", "") or "-")
    start = esc(r.get("старт", "")[:16].replace("T", " "))
    return (f'<tr><td>{esc(sku)}</td><td class="r">{esc(r.get("показы_за_неделю_до", ""))}</td>'
            f'<td class="r">{esc(r.get("соинвест_%", ""))}</td>'
            f'<td class="r">{rec} → <b>{fin}</b></td><td class="nw">{start}</td>'
            f'<td class="sep">{esc(ct) if ct else "-"}</td>'
            f'<td class="r">{esc(r.get("контроль_показы", "") or "-")}</td>'
            f'<td class="r muted" title="Соинвест контроля считается из cur_prices.psv по product_id; '
            f'маппинг product_id → артикул лежит в выгрузке кабинета, её в репозитории нет">нет данных</td>'
            f'<td class="r {dcls}">{dtxt}</td></tr>'), (vt, vc)

def group_daily(grp, days, i=0):
    return [sum(series.get(a, {}).get(d, [0, 0])[i] for a in grp) for d in days]

# График динамики. Две группы живут на разных уровнях трафика (у bid_min_8 контроль
# втрое тяжелее теста), поэтому обе линии приведены к своему же уровню до старта:
# 100 = средний день недели перед стартом. Две шкалы на одной картинке - запрещённый
# приём, индекс решает ту же задачу честно.
def chart(t, cid):
    st = datetime.date.fromisoformat(t["старт"])
    days = [(st - datetime.timedelta(days=14 - k)).isoformat() for k in range(15)]
    days = [d for d in days if d <= LAST] + [d for d in
            [(st + datetime.timedelta(days=k)).isoformat() for k in range(0, 40)] if d <= LAST]
    days = sorted(set(days))
    pre = [(st - datetime.timedelta(days=k)).isoformat() for k in range(1, 8)]
    post = [d for d in days if d >= t["старт"]]
    if not post:
        return ""

    def block(grp):
        raw = group_daily(grp, days)
        base = sum(group_daily(grp, pre)) / len(pre)
        idx = [(v / base * 100 if base else 0) for v in raw]
        a = sum(group_daily(grp, pre)) / len(pre)
        b = sum(group_daily(grp, post)) / len(post)
        return raw, idx, a, b

    rawT, idxT, preT, postT = block(t["тест"])
    rawC, idxC, preC, postC = block(t["контроль"])
    W, H, L, R, TP, B = 620, 170, 40, 62, 14, 24
    lo = min(min(idxT), min(idxC), 100) * 0.92
    hi = max(max(idxT), max(idxC), 100) * 1.06
    x = lambda i: L + i * (W - L - R) / max(len(days) - 1, 1)
    y = lambda v: TP + (hi - v) / (hi - lo) * (H - TP - B)
    path = lambda idx: "M" + " L".join(f"{x(i):.1f} {y(v):.1f}" for i, v in enumerate(idx))
    # Круглые деления: шаг из ряда 25/50/100/200/500/1000, чтобы подписи не налезали
    # друг на друга (первая версия давала «100» и «50» вплотную у нижнего края).
    span = hi - lo
    step = next((s_ for s_ in (25, 50, 100, 200, 500, 1000, 2000) if span / s_ <= 4), 5000)
    ticks = [v for v in range(0, int(hi) + step, step) if lo <= v <= hi]
    if 100 not in ticks and lo <= 100 <= hi:
        ticks = sorted(set(ticks + [100]))
    ticks = [v for v in ticks if v > 0]
    def gline(v):
        dash = ' stroke-dasharray="3 3"' if v == 100 else ""
        return (f'<line class="gl" x1="{L}" x2="{W - R}" y1="{y(v):.1f}" y2="{y(v):.1f}"{dash}/>'
                f'<text class="ax" x="{L - 6}" y="{y(v) + 3.5:.1f}" text-anchor="end">{v:.0f}</text>')
    grid = "".join(gline(v) for v in ticks)
    si = days.index(t["старт"])
    xticks = "".join(f'<text class="ax" x="{x(i):.1f}" y="{H - 7}" text-anchor="middle">{days[i][8:10]}.{days[i][5:7]}</text>'
                     for i in range(0, len(days), max(1, len(days) // 6)))
    dd = (postT / preT - postC / preC) * 100 if preT and preC else 0
    # Вторая база: две недели перед стартом. Неделя перед стартом может оказаться
    # аномальной, и тогда прирост считается от ямы. Показываем обе, чтобы вывод не
    # зависел от молчаливого выбора окна.
    pre2 = [(st - datetime.timedelta(days=k)).isoformat() for k in range(1, 15)]
    preT2 = sum(group_daily(t["тест"], pre2)) / len(pre2)
    preC2 = sum(group_daily(t["контроль"], pre2)) / len(pre2)
    dd2 = (postT / preT2 - postC / preC2) * 100 if preT2 and preC2 else 0
    alarm = ""
    if abs(dd - dd2) > max(abs(dd), abs(dd2)) * 0.5:
        alarm = (f'<div class="dyn-alarm">Вывод зависит от выбора базы: по неделе перед стартом разница '
                 f'<b>{dd:+.0f}</b> пунктов, по двум неделям <b>{dd2:+.0f}</b>. '
                 f'Неделя перед стартом была для тестовой группы нетипичной, прирост считается от ямы. '
                 f'До замера 2 октября решить, какая база берётся за правило.</div>')
    return (
        f'<div class="dyn"><div class="dyn-h">Динамика: показы в поиске, посуточно. '
        f'<span class="dyn-sub">100 = средний день недели перед стартом</span></div>'
        f'<div class="lg"><span class="lgi"><i style="background:{C_TEST}"></i>тест, {len(t["тест"])} арт.</span>'
        f'<span class="lgi"><i style="background:{C_CTRL}"></i>контроль, {len(t["контроль"])} арт.</span></div>'
        f'<svg class="cv" id="{cid}" viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" '
        f'aria-label="Показы в поиске по дням, тест против контроля, индекс к неделе до старта">'
        f'{grid}{xticks}'
        f'<line class="st" x1="{x(si):.1f}" x2="{x(si):.1f}" y1="{TP}" y2="{H - B}"/>'
        f'<text class="ax st-t" x="{x(si) + 4:.1f}" y="{TP + 9}">старт</text>'
        f'<path d="{path(idxC)}" fill="none" stroke="{C_CTRL}" stroke-width="2" stroke-linejoin="round"/>'
        f'<path d="{path(idxT)}" fill="none" stroke="{C_TEST}" stroke-width="2" stroke-linejoin="round"/>'
        f'<text class="dl" x="{W - R + 6}" y="{y(idxT[-1]) + 3.5:.1f}">тест</text>'
        f'<text class="dl" x="{W - R + 6}" y="{y(idxC[-1]) + 3.5:.1f}">контроль</text>'
        f'<line class="ch" x1="0" x2="0" y1="{TP}" y2="{H - B}" style="display:none"/>'
        f'<rect class="hit" x="{L}" y="{TP}" width="{W - L - R}" height="{H - TP - B}" fill="transparent"/>'
        f'</svg><div class="tip" id="{cid}-tip"></div>'
        f'<div class="dyn-read">Средний день: тест <b>{preT:.0f} → {postT:.0f}</b> ({(postT / preT - 1) * 100:+.0f} %), '
        f'контроль <b>{preC:.0f} → {postC:.0f}</b> ({(postC / preC - 1) * 100:+.0f} %), '
        f'разница <b>{dd:+.0f} пунктов</b>. После старта прошло {len(post)} дн, данные по {LAST}.<br>'
        f'<span class="k2">По базе в две недели: тест {preT2:.0f} → {postT:.0f} ({(postT / preT2 - 1) * 100:+.0f} %), '
        f'контроль {preC2:.0f} → {postC:.0f} ({(postC / preC2 - 1) * 100:+.0f} %), разница {dd2:+.0f} пунктов.</span></div>'
        f'{alarm}'
        f'<div class="dyn-note">Это показы, а не соинвест. Соинвест и позиция в поиске посуточно по артикулам '
        f'не снимаются, поэтому главную метрику теста график не показывает. Заказы по этим артикулам идут '
        f'по 0-2 в день на всю группу, для линии слишком редки.</div></div>'
        f'<script>window.DYN=window.DYN||{{}};window.DYN["{cid}"]='
        f'{json.dumps({"d": days, "t": [round(v, 1) for v in idxT], "c": [round(v, 1) for v in idxC], "rt": rawT, "rc": rawC}, ensure_ascii=False)};</script>')

cards = ""
for t in T["тесты"]:
    tst, ctl = t.get("тест", []), t.get("контроль", [])
    if tst or ctl:
        rows, paired, cov_v = "", 0, 0
        for s in tst:
            html_row, vals = pairrow(s)
            rows += html_row
            if vals:
                paired += 1
                if vals[0] and vals[1]:
                    cov_v += 1
        used = {log[s]["контроль"] for s in tst if s in log}
        orphan = [c for c in ctl if c not in used]
        cov = (f'Пар: <b>{paired}</b> из {len(tst)}. Показы обеих сторон есть у <b>{cov_v}</b>. '
               f'Соинвест контроля: <b>нет ни у одной пары</b> (нужен маппинг product_id из выгрузки кабинета). ')
        cov += (f'Контроль без пары: {esc(", ".join(orphan))}.' if orphan else "Весь контроль разобран по парам.")
        grp = ('<div class="tbl-wrap"><table class="gtbl"><thead>'
               '<tr class="grp"><th colspan="5">Тест</th><th class="sep" colspan="3">Контроль</th><th></th></tr>'
               '<tr><th>Артикул</th><th class="r">Показы/нед</th><th class="r">Соинвест %</th>'
               '<th class="r">Ставка рек.→фин.</th><th>Старт</th>'
               '<th class="sep">Артикул</th><th class="r">Показы/нед</th><th class="r">Соинвест %</th>'
               '<th class="r" title="Насколько показы теста расходятся с показами контроля. '
               'Больше 20 % - пара плохо сопоставима">Δ показов</th></tr>'
               f'</thead><tbody>{rows}</tbody></table></div><div class="cov">{cov}</div>'
               '<div class="cov">Числа в таблице сняты в кабинете на момент запуска и с тех пор не двигаются. '
               'Что происходит с тестом дальше - на графике ниже.</div>'
               + chart(t, "dyn-" + t["id"]))
    else:
        grp = '<div class="muted" style="padding:8px 2px">Группы не заданы, тест не запущен.</div>'
    cards += (f'<section class="card"><div class="chead"><div class="ctitle">{esc(t["название"])} {statuschip(t)}</div></div>'
              f'<div class="hyp">{esc(t["гипотеза"])}</div>'
              f'<div class="meta"><span>Старт: <b>{esc(t.get("старт") or "-")}</b></span>'
              f'<span>Замер: <b>{esc(t.get("замер") or "-")}</b></span>'
              f'<span>Горизонт: <b>{esc(t.get("горизонт_дней", ""))} дн</b></span>'
              f'<span>Тест <b>{len(tst)}</b> · Контроль <b>{len(ctl)}</b></span></div>'
              f'<div class="rule"><b>Правило:</b> {esc(t.get("правило", ""))}</div>{grp}</section>')

mblock = ""
if measured:
    mrows = ""
    for t in measured:
        res = " · ".join(f"{esc(a)}: {esc(b)}" for a, b in t.get("res", []))
        mrows += (f'<div class="mrow"><div class="ctitle">{esc(t["name"])} <span class="chip chip-done">измерен</span></div>'
                  f'<div class="meta"><span>Старт <b>{esc(t.get("started", ""))}</b></span>'
                  f'<span>Замер <b>{esc(t.get("read", ""))}</b></span>'
                  f'<span>Тест <b>{esc(t.get("t", ""))}</b> · Контроль <b>{esc(t.get("c", ""))}</b></span></div>'
                  f'<div class="res">{res}</div><div class="muted">{esc(t.get("note", ""))}</div></div>')
    mblock = '<h2 class="sec">Измеренные тесты</h2>' + mrows

notes = "".join(f"<li>{esc(n)}</li>" for n in T.get("заметки", []))
metrics = " · ".join(esc(m) for m in T.get("метрики", []))
NAV = ["Командный центр", "Обзор", "Товары и заказы", "Воронка", "Маркетинг", "Деньги", "Конкуренты", "Реакция"]
nav = "".join(f"<a>{n}</a>" for n in NAV) + '<a class="on">Тесты</a>'

CSS = """:root{--bg:#0b0f17;--card:#12161f;--soft:#232B36;--ink:#e8eef2;--ink2:#9fb2c0;--ink3:#5d7484;--cy:#22D3EE;--up:#34D399;--dn:#FF5A5F;--warn:#E5B567;--s1:#3987e5;--s2:#d95926}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 system-ui,Segoe UI,Roboto,sans-serif}
.nav{background:#1a2330;border-bottom:1px solid var(--cy);padding:9px 18px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;font-size:13px}
.nav a{color:#cfe8ef;text-decoration:none;padding:4px 10px;border-radius:7px}.nav a.on{background:var(--cy);color:#04222a;font-weight:700}
.wrap{max-width:1080px;margin:0 auto;padding:18px 16px 60px}
h1{font-size:20px;margin:8px 2px 4px}.sub{color:var(--ink3);margin:0 2px 16px}
.sec{font-size:15px;color:var(--cy);margin:22px 2px 10px;border-bottom:1px solid var(--soft);padding-bottom:6px}
.card{background:var(--card);border:1px solid var(--soft);border-radius:12px;padding:14px 16px;margin-bottom:14px}
.chead{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.ctitle{font-weight:700;font-size:15px}
.chip{font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:20px;white-space:nowrap}
.chip-run{background:rgba(34,211,238,.15);color:var(--cy)}.chip-off{background:rgba(93,116,132,.2);color:var(--ink3)}.chip-done{background:rgba(52,211,153,.16);color:var(--up)}
.hyp{color:var(--ink2);margin:8px 0}.meta{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--ink3);margin:6px 0}.meta b{color:var(--ink)}
.rule{font-size:12.5px;color:var(--ink2);background:rgba(229,181,103,.08);border-left:3px solid var(--warn);padding:7px 10px;border-radius:6px;margin:8px 0}
.tbl-wrap{overflow-x:auto;margin-top:8px;max-height:340px;overflow-y:auto}
.gtbl{width:100%;border-collapse:collapse;font-size:12px}
.gtbl th{color:var(--ink3);text-align:left;font-weight:600;padding:5px 7px;border-bottom:1px solid var(--soft);position:sticky;background:var(--card);z-index:1}
.gtbl thead tr.grp th{top:0;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink2);border-bottom:none;padding-bottom:1px}
.gtbl thead tr:not(.grp) th{top:19px}
.gtbl td{padding:5px 7px;border-bottom:1px solid rgba(255,255,255,.04)}.gtbl .r{text-align:right}.gtbl .nw{white-space:nowrap}
.gtbl .sep{border-left:1px solid var(--soft)}
.gtbl tbody td.sep,.gtbl tbody td.sep~td{background:rgba(93,116,132,.06)}
.gtbl tbody tr:hover td{background:rgba(34,211,238,.06)}
.warn{color:var(--warn);font-weight:700}
.cov{font-size:12px;color:var(--ink3);margin:8px 2px 0;border-top:1px dashed var(--soft);padding-top:7px}.cov b{color:var(--ink2)}
.dyn{margin-top:14px;position:relative}
.dyn-h{font-size:12.5px;color:var(--ink2);font-weight:600;margin:0 2px 2px}.dyn-sub{color:var(--ink3);font-weight:400}
.lg{display:flex;gap:14px;font-size:11.5px;color:var(--ink2);margin:4px 2px 4px}
.lgi{display:flex;align-items:center;gap:5px}.lgi i{width:9px;height:9px;border-radius:50%;display:inline-block}
.cv{width:100%;height:170px;display:block;overflow:visible}
.cv .gl{stroke:var(--soft);stroke-width:1}
.cv .ax{fill:var(--ink3);font:10px system-ui}
.cv .dl{fill:var(--ink2);font:10.5px system-ui}
.cv .st{stroke:var(--ink3);stroke-width:1;stroke-dasharray:2 3}.cv .st-t{fill:var(--ink3)}
.cv .ch{stroke:var(--ink2);stroke-width:1}
.tip{position:absolute;pointer-events:none;display:none;background:#0b0f17;border:1px solid var(--soft);border-radius:7px;padding:6px 9px;font-size:11.5px;color:var(--ink);white-space:nowrap;z-index:5;box-shadow:0 4px 14px rgba(0,0,0,.5)}
.tip b{color:var(--ink)}.tip .k{color:var(--ink3)}.tip i{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px}
.dyn-read{font-size:12px;color:var(--ink2);margin:6px 2px 0}.dyn-read b{color:var(--ink)}.dyn-read .k2{color:var(--ink3)}
.dyn-alarm{font-size:12px;color:var(--ink2);background:rgba(229,181,103,.08);border-left:3px solid var(--warn);padding:7px 10px;border-radius:6px;margin:8px 2px 0}.dyn-alarm b{color:var(--warn)}
.dyn-note{font-size:11.5px;color:var(--ink3);margin:4px 2px 0}
.muted{color:var(--ink3)}.mrow{background:var(--card);border:1px solid var(--soft);border-radius:12px;padding:12px 16px;margin-bottom:10px}
.res{font-weight:700;color:var(--up);margin:6px 0}.notes{background:var(--card);border:1px solid var(--soft);border-radius:12px;padding:10px 16px}
.notes li{color:var(--ink2);margin:4px 0}.legend{font-size:12px;color:var(--ink3);margin:2px 2px 14px}.legend b{color:var(--ink2)}"""

JS = """
(function(){
  var C1='""" + C_TEST + """', C2='""" + C_CTRL + """';
  Object.keys(window.DYN||{}).forEach(function(id){
    var svg=document.getElementById(id); if(!svg) return;
    var D=window.DYN[id], tip=document.getElementById(id+'-tip');
    var ch=svg.querySelector('.ch'), hit=svg.querySelector('.hit');
    var L=parseFloat(hit.getAttribute('x')), Wi=parseFloat(hit.getAttribute('width'));
    function hide(){ ch.style.display='none'; tip.style.display='none'; }
    hit.addEventListener('mouseleave', hide);
    hit.addEventListener('mousemove', function(e){
      var box=svg.getBoundingClientRect();
      var vx=(e.clientX-box.left)/box.width*620;
      var i=Math.round((vx-L)/Wi*(D.d.length-1));
      if(i<0) i=0; if(i>D.d.length-1) i=D.d.length-1;
      var gx=L+i*Wi/(D.d.length-1);
      ch.setAttribute('x1',gx); ch.setAttribute('x2',gx); ch.style.display='';
      var d=D.d[i];
      tip.innerHTML='<b>'+d.slice(8,10)+'.'+d.slice(5,7)+'</b><br>'+
        '<i style="background:'+C1+'"></i>тест <b>'+D.t[i]+'</b> <span class="k">('+D.rt[i]+' показов)</span><br>'+
        '<i style="background:'+C2+'"></i>контроль <b>'+D.c[i]+'</b> <span class="k">('+D.rc[i]+' показов)</span>';
      tip.style.display='block';
      var px=gx/620*box.width;
      tip.style.left=Math.min(Math.max(px-tip.offsetWidth/2,0),box.width-tip.offsetWidth)+'px';
      tip.style.top=(svg.offsetTop+6)+'px';
    });
  });
})();
"""

HTML = ('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>GENGLASS · Тесты (макет)</title><style>{CSS}</style></head><body>'
        f'<div class="nav">{nav}</div>'
        '<div class="wrap"><h1>Тесты · A/B по рекламе</h1>'
        f'<p class="sub">Проверяем гипотезы по соинвесту и ставке. Метрики замера: {metrics}. '
        f'Обновлено {esc(T.get("обновлено", ""))}, посуточные данные по {esc(LAST)}. '
        f'<b style="color:var(--warn)">МАКЕТ</b>, согласовать до постройки.</p>'
        '<p class="legend">Одна строка таблицы - одна пара: слева артикул из теста, справа его контроль. '
        '<b>Δ показов</b> - насколько пара сопоставима по трафику до старта. Под таблицей - как тест идёт по дням.</p>'
        f'{cards}{mblock}<h2 class="sec">Заметки и предупреждения</h2><div class="notes"><ul>{notes}</ul></div></div>'
        f'<script>{JS}</script></body></html>')

open(OUT, "w", encoding="utf-8").write(HTML)
print("макет записан:", OUT, "|", len(HTML), "байт | тестов:", len(T["тесты"]),
      "| измеренных:", len(measured), "| строк лога:", len(log), "| посуточные данные по:", LAST)
