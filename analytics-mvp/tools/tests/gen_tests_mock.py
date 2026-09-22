# Макет вкладки «Тесты» (OZON). Запускать из analytics-mvp:
#   python3 tools/tests/gen_tests_mock.py
# Читает: tools/tests/tests.json (определения тестов), tools/tests/tests_campaigns.psv (лог кампаний
# кабинета: ставки, показы, пара тест-контроль), data/reakciya.json (измеренные тесты).
# Пишет: tools/tests/katya-tests-mock.html
#
# Состав вкладки согласован 22.09: три теста из tests.json + блок «измеренные» из Реакции.
# Три не запущенные заготовки из ветки tests в reakciya.json на вкладку не идут.
import json, csv, datetime, html, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "tools", "tests")
OUT = os.path.join(SRC, "katya-tests-mock.html")

T = json.load(open(os.path.join(SRC, "tests.json"), encoding="utf-8"))
log = {}
for r in csv.DictReader(open(os.path.join(SRC, "tests_campaigns.psv"), encoding="utf-8"), delimiter="|"):
    log[r["товар"]] = r
rea = json.load(open(os.path.join(ROOT, "data", "reakciya.json"), encoding="utf-8"))
measured = [t for t in rea.get("tests", []) if t.get("status") == "измерен"]
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
    delta = None
    if vt and vc and vc > 0:
        delta = (vt - vc) / vc * 100
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
        # Контроль, который не попал ни в одну пару: в tests.json он есть, в логе кампаний его нет.
        used = {log[s]["контроль"] for s in tst if s in log}
        orphan = [c for c in ctl if c not in used]
        cov = (f'Пар: <b>{paired}</b> из {len(tst)}. Показы обеих сторон есть у <b>{cov_v}</b>. '
               f'Соинвест контроля: <b>нет ни у одной пары</b> (нужен маппинг product_id из выгрузки кабинета). ')
        if orphan:
            cov += f'Контроль без пары: {esc(", ".join(orphan))}.'
        else:
            cov += "Весь контроль разобран по парам."
        grp = ('<div class="tbl-wrap"><table class="gtbl"><thead>'
               '<tr class="grp"><th colspan="5">Тест</th><th class="sep" colspan="3">Контроль</th><th></th></tr>'
               '<tr><th>Артикул</th><th class="r">Показы/нед</th><th class="r">Соинвест %</th>'
               '<th class="r">Ставка рек.→фин.</th><th>Старт</th>'
               '<th class="sep">Артикул</th><th class="r">Показы/нед</th><th class="r">Соинвест %</th>'
               '<th class="r" title="Насколько показы теста расходятся с показами контроля. '
               'Больше 20 % - пара плохо сопоставима">Δ показов</th></tr>'
               f'</thead><tbody>{rows}</tbody></table></div><div class="cov">{cov}</div>')
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

# Порядок вкладок повторяет KPAGES из src/scripts/katya-nav.ts, «Тесты» встаёт последней.
NAV = ["Командный центр", "Обзор", "Товары и заказы", "Воронка", "Маркетинг", "Деньги", "Конкуренты", "Реакция"]
nav = "".join(f"<a>{n}</a>" for n in NAV) + '<a class="on">Тесты</a>'

CSS = """:root{--bg:#0b0f17;--card:#12161f;--soft:#232B36;--ink:#e8eef2;--ink2:#9fb2c0;--ink3:#5d7484;--cy:#22D3EE;--up:#34D399;--dn:#FF5A5F;--warn:#E5B567}
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
.muted{color:var(--ink3)}.mrow{background:var(--card);border:1px solid var(--soft);border-radius:12px;padding:12px 16px;margin-bottom:10px}
.res{font-weight:700;color:var(--up);margin:6px 0}.notes{background:var(--card);border:1px solid var(--soft);border-radius:12px;padding:10px 16px}
.notes li{color:var(--ink2);margin:4px 0}.legend{font-size:12px;color:var(--ink3);margin:2px 2px 14px}.legend b{color:var(--ink2)}"""

HTML = ('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>GENGLASS · Тесты (макет)</title><style>{CSS}</style></head><body>'
        f'<div class="nav">{nav}</div>'
        '<div class="wrap"><h1>Тесты · A/B по рекламе</h1>'
        f'<p class="sub">Проверяем гипотезы по соинвесту и ставке. Метрики замера: {metrics}. '
        f'Обновлено {esc(T.get("обновлено", ""))}. <b style="color:var(--warn)">МАКЕТ</b>, согласовать до постройки.</p>'
        '<p class="legend">Одна строка - одна пара: слева артикул из теста, справа его контроль. '
        '<b>Δ показов</b> - насколько пара сопоставима по трафику до старта. Цифры из лога кампаний кабинета.</p>'
        f'{cards}{mblock}<h2 class="sec">Заметки и предупреждения</h2><div class="notes"><ul>{notes}</ul></div></div></body></html>')

open(OUT, "w", encoding="utf-8").write(HTML)
print("макет записан:", OUT, "|", len(HTML), "байт | тестов:", len(T["тесты"]),
      "| измеренных:", len(measured), "| строк лога:", len(log))
