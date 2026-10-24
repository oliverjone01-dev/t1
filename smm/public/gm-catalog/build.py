#!/usr/bin/env python3
"""Сборка дилерского мини-каталога GLASS MEMORY.

catalog.data.json -> index.html -> GLASS-MEMORY_catalog.pdf (A4, книжная).

Запуск:
    python3 build.py            # только HTML
    python3 build.py --pdf      # HTML + PDF через Chromium

Цены живут только в catalog.data.json, блок "prices". Пока значение null,
страница печатается в режиме ЧЕРНОВИК и вместо цифры выводится слот
«цена не заполнена». Никаких выдуманных чисел в макете нет.
"""

import argparse
import html
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
DATA = ROOT / "catalog.data.json"
OUT_HTML = ROOT / "index.html"
OUT_PDF = ROOT / "GLASS-MEMORY_catalog.pdf"

CHROMIUM_CANDIDATES = [
    "/opt/pw-browsers/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
]


def e(text):
    return html.escape(str(text), quote=True)


def rub(value):
    """120000 -> '120 000'. Неразрывные пробелы, чтобы число не рвалось по строкам."""
    return f"{int(value):,}".replace(",", " ")


def price_range(lo, hi):
    if lo is None or hi is None:
        return None
    if lo == hi:
        return f"{rub(lo)} ₽"
    return f"{rub(lo)} - {rub(hi)} ₽"


def margin_line(p):
    """Маржа партнёра считается из заполненных цифр, а не задаётся руками."""
    if None in (p.get("dealer_from"), p.get("retail_from")):
        return None
    lo = p["retail_from"] - p["dealer_from"]
    hi = (p["retail_to"] or p["retail_from"]) - (p["dealer_to"] or p["dealer_from"])
    lo, hi = min(lo, hi), max(lo, hi)
    if lo <= 0:
        return None
    return price_range(lo, hi)


# ---------------------------------------------------------------- CSS

CSS = """
@page { size: A4 portrait; margin: 0; }

:root{
  --brand:#2E665B; --brand-2:#24544B; --brand-3:#1F4B43;
  --leaf:#3DA35D; --soft:#EAF1EF;
  --ink:#17211E; --ink2:#43514D; --ink3:#77857F;
  --line:#DDE4E1; --line2:#C6D2CE;
  --paper:#FFFFFF; --paper2:#F5F7F6;
  --flag:#8A6A12; --flag-bg:#FFF6E0; --flag-line:#E8D49A;
}

*{box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact;}
html,body{margin:0;padding:0;background:#8E9995;}
body{
  font-family:"PT Sans","Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:var(--ink); line-height:1.5; font-size:10.5pt;
}
h1,h2,h3,.serif{font-family:"PT Serif",Georgia,"Times New Roman",serif;}

.page{
  position:relative; width:210mm; height:297mm; overflow:hidden;
  background:var(--paper); margin:0 auto 8mm; padding:16mm 15mm 14mm;
  page-break-after:always; break-after:page;
}
.page:last-child{page-break-after:auto; break-after:auto; margin-bottom:0;}
@media print{ body{background:#fff;} .page{margin:0; box-shadow:none;} }
@media screen{ .page{box-shadow:0 6px 30px rgba(0,0,0,.28);} }

/* --- шапка и подвал страницы --- */
.runhead{
  position:absolute; top:8mm; left:15mm; right:15mm;
  display:flex; justify-content:space-between; align-items:baseline;
  font-size:7.6pt; letter-spacing:.16em; text-transform:uppercase;
  color:var(--ink3); border-bottom:1px solid var(--line); padding-bottom:2.5mm;
}
.runhead b{color:var(--brand); font-weight:700;}
.runfoot{
  position:absolute; bottom:8mm; left:15mm; right:15mm;
  display:flex; justify-content:space-between;
  font-size:7.6pt; color:var(--ink3);
  border-top:1px solid var(--line); padding-top:2.5mm;
}

/* --- логотип --- */
.logo{display:flex; align-items:center; gap:3mm;}
.logo img{width:9mm; height:auto; display:block;}
.logo .nm{font-size:12pt; font-weight:800; letter-spacing:.02em; color:#20302C; line-height:1.05;}
.logo .nm i{font-style:normal; color:var(--leaf);}
.logo .tg{display:block; font-size:6.6pt; letter-spacing:.18em; text-transform:uppercase; color:var(--ink3); font-weight:700; margin-top:.6mm;}

/* --- обложка --- */
.cover{background:linear-gradient(160deg,var(--brand) 0%,var(--brand-3) 100%); color:#EAF3F0; padding:0;}
.cover .inner{position:absolute; inset:0; padding:20mm 18mm; display:flex; flex-direction:column;}
.cover .logo .nm{color:#fff;} .cover .logo .tg{color:#A8CFC4;} .cover .logo i{color:#8FD3A8;}
.cover h1{font-size:30pt; line-height:1.14; margin:0 0 5mm; color:#fff; letter-spacing:-.01em;}
.cover .sub{font-size:12.5pt; color:#C8E2DA; max-width:120mm; margin:0 0 10mm;}
.cover .rule{width:28mm; height:2px; background:var(--leaf); margin:0 0 8mm;}
.cover .shot{flex:1; min-height:0; border-radius:3mm; overflow:hidden; background:#1B423B;}
.cover .shot img{width:100%; height:100%; object-fit:cover; display:block;}
.cover .meta{margin-top:8mm; display:flex; justify-content:space-between; align-items:flex-end;
  font-size:8.6pt; color:#B9D8CF; border-top:1px solid rgba(255,255,255,.22); padding-top:4mm;}
.cover .meta b{color:#fff;}

/* --- типовые блоки --- */
.kicker{font-size:8pt; letter-spacing:.18em; text-transform:uppercase; color:var(--brand); font-weight:800; margin:0 0 3mm;}
h2.sec{font-size:19pt; line-height:1.2; margin:0 0 4mm; letter-spacing:-.01em;}
p{margin:0 0 3.5mm;} p.lead{font-size:11.5pt; color:var(--ink2);}
.muted{color:var(--ink3);} .small{font-size:8.6pt;}

.facts{display:grid; grid-template-columns:repeat(3,1fr); gap:4mm; margin:6mm 0;}
.fact{background:var(--paper2); border:1px solid var(--line); border-radius:2.5mm; padding:4mm;}
.fact .v{font-family:"PT Serif",Georgia,serif; font-size:16pt; color:var(--brand); line-height:1.1;}
.fact .l{font-size:8.2pt; color:var(--ink2); margin-top:1.5mm;}

.split{display:grid; grid-template-columns:1fr 1fr; gap:7mm;}
ul.ticks{list-style:none; margin:0; padding:0;}
ul.ticks li{position:relative; padding:2.4mm 0 2.4mm 6mm; border-top:1px solid var(--line); font-size:9.6pt; color:var(--ink2);}
ul.ticks li:first-child{border-top:0;}
ul.ticks li:before{content:""; position:absolute; left:0; top:4.4mm; width:2.4mm; height:2.4mm; border-radius:.6mm; background:var(--leaf);}

table.kv{width:100%; border-collapse:collapse; font-size:9.4pt;}
table.kv td{padding:2.4mm 0; border-top:1px solid var(--line); vertical-align:top;}
table.kv tr:first-child td{border-top:0;}
table.kv td:first-child{color:var(--ink3); width:44%; padding-right:4mm;}
table.kv td:last-child{color:var(--ink); font-weight:600;}

/* --- карточка комплекта --- */
.sethead{display:flex; align-items:flex-start; justify-content:space-between; gap:6mm; margin-bottom:4mm;}
.sku{display:inline-block; font-size:8pt; letter-spacing:.14em; font-weight:800; color:#fff;
  background:var(--brand); border-radius:1.4mm; padding:1.4mm 2.6mm;}
.sku.metal{background:#4A5D57;}
.setname{font-family:"PT Serif",Georgia,serif; font-size:23pt; line-height:1.1; margin:3mm 0 2mm;}
.setgroup{font-size:8pt; letter-spacing:.16em; text-transform:uppercase; color:var(--ink3); font-weight:700;}

.shotbox{height:106mm; border-radius:2.5mm; overflow:hidden; background:var(--paper2);
  border:1px solid var(--line); margin:0 0 5mm;}
.shotbox img{width:100%; height:100%; object-fit:cover; object-position:center 32%; display:block;}
.shotbox.todo{display:flex; align-items:center; justify-content:center; text-align:center;
  border:1px dashed var(--flag-line); background:var(--flag-bg); color:var(--flag); padding:8mm;}
.shotbox.todo .t{font-size:9.4pt; font-weight:700; line-height:1.45;}
.shotbox.todo .t span{display:block; font-weight:400; font-size:8.4pt; margin-top:2mm; opacity:.85;}

.setbody{display:grid; grid-template-columns:1fr 1fr; gap:7mm; margin-bottom:5mm;}
.blk h3{font-size:8pt; letter-spacing:.16em; text-transform:uppercase; color:var(--brand);
  margin:0 0 2.5mm; font-weight:800;}

.pricebox{border:1px solid var(--line2); border-radius:2.5mm; overflow:hidden;}
.pricebox .row{display:flex; justify-content:space-between; align-items:baseline;
  padding:3mm 4mm; border-top:1px solid var(--line);}
.pricebox .row:first-child{border-top:0;}
.pricebox .row.main{background:var(--brand); color:#fff; border-top:0;}
.pricebox .row.main .k{color:#BFE0D7;} .pricebox .row.main .v{color:#fff; font-size:13pt;}
.pricebox .k{font-size:8.6pt; color:var(--ink3);}
.pricebox .v{font-family:"PT Serif",Georgia,serif; font-size:11.5pt; font-weight:700; white-space:nowrap;}
.pricebox.empty{border-style:dashed; border-color:var(--flag-line); background:var(--flag-bg);}
.pricebox.empty .row{border-top-color:var(--flag-line);}
.pricebox.empty .k, .pricebox.empty .v{color:var(--flag);}
.pricebox.empty .v{font-size:9.6pt; font-weight:600;}

.why{background:var(--soft); border-left:2.4mm solid var(--leaf); border-radius:0 2mm 2mm 0;
  padding:3.5mm 4mm; font-size:9.4pt; color:#28453E;}
.why b{color:var(--brand-3);}

/* --- плашка черновика --- */
.draftbar{
  background:var(--flag-bg); border:1px solid var(--flag-line); color:var(--flag);
  border-radius:2mm; padding:3mm 4mm; font-size:8.6pt; line-height:1.45; margin:0 0 5mm;
}
.draftbar b{display:block; letter-spacing:.12em; text-transform:uppercase; font-size:7.6pt; margin-bottom:1.2mm;}

/* --- сетка опций --- */
.opts{display:grid; grid-template-columns:1fr 1fr; gap:4mm;}
.opt{border:1px solid var(--line); border-radius:2.5mm; padding:4mm; background:var(--paper2);}
.opt .n{font-weight:700; font-size:9.8pt; margin-bottom:1.5mm;}
.opt .d{font-size:8.8pt; color:var(--ink2);}

/* --- контакты --- */
.contact{background:linear-gradient(160deg,var(--brand) 0%,var(--brand-3) 100%); color:#EAF3F0;}
.contact .inner{position:absolute; inset:0; padding:22mm 18mm; display:flex; flex-direction:column;}
.contact h2{color:#fff; font-size:24pt; margin:0 0 5mm;}
.contact p{color:#C8E2DA;}
.contact .logo .nm{color:#fff;} .contact .logo .tg{color:#A8CFC4;} .contact .logo i{color:#8FD3A8;}
.contact .cta{margin-top:auto; border-top:1px solid rgba(255,255,255,.22); padding-top:6mm;
  display:grid; grid-template-columns:1fr 1fr; gap:6mm; font-size:10pt;}
.contact .cta .k{font-size:7.6pt; letter-spacing:.16em; text-transform:uppercase; color:#8FB8AC; margin-bottom:2mm;}
.contact .cta a{color:#fff; text-decoration:none;}
.contact .cta div b{color:#fff; display:block; margin-bottom:1mm;}
"""


# ---------------------------------------------------------------- части макета

def logo_html(cls=""):
    return f"""<div class="logo {cls}">
      <img src="img/logo.png" alt="">
      <div><span class="nm">GLASS <i>MEMORY</i></span>
      <span class="tg">производственная компания</span></div>
    </div>"""


def page(inner, cls="", head=None, foot=None, num=None, total=None):
    parts = [f'<section class="page {cls}">']
    if head is not None:
        parts.append(f'<div class="runhead"><span><b>GLASS MEMORY</b> · готовые решения для дилеров</span>'
                     f'<span>{e(head)}</span></div>')
    parts.append(inner)
    if foot is not None:
        pg = f"{num} / {total}" if num else ""
        parts.append(f'<div class="runfoot"><span>{e(foot)}</span><span>{e(pg)}</span></div>')
    parts.append("</section>")
    return "\n".join(parts)


def cover_page(d):
    m, c = d["meta"], d["company"]
    draft = ('<div style="margin-bottom:6mm;background:rgba(255,255,255,.13);'
             'border:1px solid rgba(255,255,255,.3);border-radius:2mm;padding:3mm 4mm;'
             'font-size:8.4pt;color:#FFE9B8;">ЧЕРНОВИК. Цены и типовые размеры не заполнены.</div>'
             if m.get("draft") else "")
    return page(f"""<div class="inner">
      {logo_html()}
      <div style="height:14mm"></div>
      <div class="rule"></div>
      <h1>Готовые решения<br>с ценами для дилеров</h1>
      <p class="sub">{e(m['subtitle'])}. Собственное производство полного цикла:
      стекольный и металлический цех на одной площадке в Домодедово.</p>
      {draft}
      <div class="shot"><img src="img/hero.jpg" alt=""></div>
      <div class="meta">
        <span>{e(c['site'])} · {e(c['phones'][0])}</span>
        <span><b>{e(m['version'])}</b> · {e(m['date'])}</span>
      </div>
    </div>""", cls="cover")


def intro_page(d, num, total):
    facts = "".join(
        f'<div class="fact"><div class="v">{e(f["value"])}</div><div class="l">{e(f["label"])}</div></div>'
        for f in d["facts"])
    start = "".join(f"<li>{e(x)}</li>" for x in d["dealer"]["start"])
    fr = "".join(f"<tr><td>{e(k)}</td><td>{e(v)}</td></tr>" for k, v in d["dealer"]["franchise"])
    draft = (f'<div class="draftbar"><b>Статус документа</b>{e(d["meta"]["draft_note"])}</div>'
             if d["meta"].get("draft") else "")
    return page(f"""
      <p class="kicker">Партнёрам</p>
      <h2 class="sec">Девять позиций, которые закрывают <br>основной спрос ритуальной точки</h2>
      <p class="lead">Пять комплектов на камне и четыре на металле. По каждому: состав,
      технические параметры, дилерская вилка и рекомендованная розница. Вы продаёте под своим
      брендом, мы производим и отгружаем транспортной компанией.</p>
      {draft}
      {f'<div class="facts">{facts}</div>'}
      <div class="split">
        <div class="blk">
          <h3>Поддержка старта</h3>
          <ul class="ticks">{start}</ul>
        </div>
        <div class="blk">
          <h3>Условия франшизы</h3>
          <table class="kv">{fr}</table>
          <p class="small muted" style="margin-top:3mm">{e(d["dealer"]["franchise_note"])}</p>
        </div>
      </div>
    """, head="Партнёрам", foot=d["company"]["site"], num=num, total=total)


def tech_page(d, num, total):
    g = "".join(f"<li>{e(x)}</li>" for x in d["tech"]["glass"])
    mt = "".join(f"<li>{e(x)}</li>" for x in d["tech"]["metal"])
    return page(f"""
      <p class="kicker">Технология</p>
      <h2 class="sec">Почему изображение не выцветает</h2>
      <p class="lead">Керамическая печать наносится красками, которые впекаются в стекло при закалке.
      Изображение оказывается внутри материала, а не на его поверхности: выгорать, отслаиваться
      и темнеть от ультрафиолета там нечему. Это главный аргумент дилера в разговоре о сроке службы.</p>
      <div class="split" style="margin-top:7mm">
        <div class="blk"><h3>Стекольный цех</h3><ul class="ticks">{g}</ul></div>
        <div class="blk"><h3>Металлический цех</h3><ul class="ticks">{mt}</ul></div>
      </div>
      <div class="why" style="margin-top:6mm">
        <b>Что это даёт партнёру.</b> Оба цеха стоят на одной площадке. Комплект «металл плюс стекло»
        собирается и проходит контроль качества в одном месте, а не ездит между подрядчиками.
        Отсюда один договор, один дедлайн и одна точка ответственности по рекламации.
      </div>
      <div class="split" style="margin-top:6mm">
        <div class="shotbox" style="height:62mm;margin:0"><img src="img/pamyatnik2.jpg" alt=""></div>
        <div class="shotbox" style="height:62mm;margin:0"><img src="img/ograda.jpg" alt=""></div>
      </div>
      <p class="small muted" style="margin-top:2.5mm">Слева: орнамент по листу, стеклянный портрет
      в накладной рамке. Справа: ограждение из профильной трубы, рисунок вырезан насквозь.</p>
    """, head="Технология", foot=d["company"]["site"], num=num, total=total)


def set_page(s, prices, d, num, total):
    p = prices.get(s["sku"], {})
    is_metal = s["group"] == "metal"
    group_label = "Металл + стекло" if is_metal else "Камень + стекло"

    if s["img"].startswith("img/TODO"):
        shot = (f'<div class="shotbox todo"><div class="t">Фото не подставлено'
                f'<span>{e(s.get("img_todo", ""))}</span>'
                f'<span>Положить файл в img/ и прописать путь в catalog.data.json</span></div></div>')
    else:
        shot = f'<div class="shotbox"><img src="{e(s["img"])}" alt=""></div>'

    comp = "".join(f"<li>{e(x)}</li>" for x in s["composition"])
    specs = "".join(f"<tr><td>{e(k)}</td><td>{e(v)}</td></tr>" for k, v in s["specs"])
    if p.get("size"):
        specs = f'<tr><td>Типовой размер</td><td>{e(p["size"])}</td></tr>' + specs

    dealer = price_range(p.get("dealer_from"), p.get("dealer_to"))
    retail = price_range(p.get("retail_from"), p.get("retail_to"))
    marg = margin_line(p)

    if dealer:
        rows = [f'<div class="row main"><span class="k">Дилерская цена</span>'
                f'<span class="v">{dealer}</span></div>']
        if retail:
            rows.append(f'<div class="row"><span class="k">Рекомендованная розница</span>'
                        f'<span class="v">{retail}</span></div>')
        if marg:
            rows.append(f'<div class="row"><span class="k">Маржа партнёра</span>'
                        f'<span class="v">{marg}</span></div>')
        pricebox = f'<div class="pricebox">{"".join(rows)}</div>'
    else:
        pricebox = ('<div class="pricebox empty">'
                    '<div class="row"><span class="k">Дилерская цена</span>'
                    '<span class="v">не заполнена</span></div>'
                    '<div class="row"><span class="k">Рекомендованная розница</span>'
                    '<span class="v">не заполнена</span></div>'
                    '<div class="row"><span class="k">Маржа партнёра</span>'
                    '<span class="v">считается из вилок</span></div></div>')

    return page(f"""
      <div class="sethead">
        <div>
          <span class="setgroup">{e(group_label)}</span>
          <h2 class="setname">{e(s["name"])}</h2>
        </div>
        <span class="sku {'metal' if is_metal else ''}">{e(s["sku"])}</span>
      </div>
      <p style="margin:-2mm 0 5mm;color:var(--ink2);font-size:10.4pt">{e(s["lead"])}</p>
      {shot}
      <div class="setbody">
        <div class="blk">
          <h3>Состав комплекта</h3>
          <ul class="ticks">{comp}</ul>
        </div>
        <div class="blk">
          <h3>Параметры</h3>
          <table class="kv">{specs}</table>
          <div style="height:4mm"></div>
          {pricebox}
        </div>
      </div>
      <div class="why"><b>Как продавать.</b> {e(s["why"])}</div>
    """, head=group_label, foot=f'{s["sku"]} · {s["name"]}', num=num, total=total)


def options_page(d, num, total):
    opts = "".join(f'<div class="opt"><div class="n">{e(o["name"])}</div>'
                   f'<div class="d">{e(o["note"])}</div></div>' for o in d["options"])
    return page(f"""
      <p class="kicker">Допродажа</p>
      <h2 class="sec">Что добавляется к любому комплекту</h2>
      <p class="lead">Позиции ниже поднимают чек сделки, не удлиняя цикл производства:
      они изготавливаются на том же оборудовании и в те же сроки, что и основное изделие.</p>
      <div class="opts" style="margin-top:6mm">{opts}</div>
      <div class="split" style="margin-top:7mm">
        <div class="shotbox" style="height:88mm;margin:0"><img src="img/ograda2.jpg" alt=""></div>
        <div class="shotbox" style="height:88mm;margin:0"><img src="img/stolik.jpg" alt=""></div>
      </div>
      <p class="small muted" style="margin-top:3mm">Ограждение и столик с лазерной резкой:
      орнамент повторяет рисунок основного изделия, вся зона читается как один проект.</p>
    """, head="Допродажа", foot=d["company"]["site"], num=num, total=total)


def contact_page(d):
    c = d["company"]
    phones = "<br>".join(f'<a href="tel:{p}">{e(p)}</a>' for p in c["phones"])
    return page(f"""<div class="inner">
      {logo_html()}
      <div style="height:16mm"></div>
      <h2>Обсудим ваш ассортимент</h2>
      <p style="font-size:11.5pt;max-width:120mm">Пришлём актуальный прайс для партнёров,
      образец изделия на точку и 3D-визуализацию под конкретного клиента.
      Работаем со штучными и серийными заказами по всей России.</p>
      <div style="flex:1;min-height:0;margin:6mm 0 0;border-radius:3mm;overflow:hidden;background:#1B423B">
        <img src="img/kompleks.jpg" alt="" style="width:100%;height:100%;object-fit:cover;display:block">
      </div>
      <div class="cta">
        <div><div class="k">Телефоны</div>{phones}</div>
        <div>
          <div class="k">Почта и сайт</div>
          <a href="mailto:{e(c['email'])}">{e(c['email'])}</a><br>
          <a href="https://{e(c['site'])}">{e(c['site'])}</a>
        </div>
        <div><div class="k">Производство</div><b>{e(c['address'])}</b></div>
        <div><div class="k">Документ</div><b>{e(d['meta']['version'])} · {e(d['meta']['date'])}</b></div>
      </div>
    </div>""", cls="contact")


# ---------------------------------------------------------------- сборка

def build_html(d):
    prices = {k: v for k, v in d["prices"].items() if not k.startswith("_")}
    sets = d["sets"]
    total = 1 + 2 + len(sets) + 1 + 1  # обложка, интро, технология, комплекты, допродажа, контакты

    pages = [cover_page(d)]
    n = 2
    pages.append(intro_page(d, n, total)); n += 1
    pages.append(tech_page(d, n, total)); n += 1
    for s in sets:
        pages.append(set_page(s, prices, d, n, total)); n += 1
    pages.append(options_page(d, n, total)); n += 1
    pages.append(contact_page(d))

    return f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(d['meta']['title'])}</title>
<meta name="description" content="{e(d['meta']['subtitle'])}. Дилерский мини-каталог GLASS MEMORY.">
<style>{CSS}</style>
</head>
<body>
{"".join(pages)}
</body>
</html>
"""


def find_chromium():
    for path in CHROMIUM_CANDIDATES:
        if pathlib.Path(path).exists():
            return path
    return None


def build_pdf():
    chrome = find_chromium()
    if not chrome:
        raise SystemExit("Chromium не найден. Проверить пути в CHROMIUM_CANDIDATES.")
    subprocess.run([
        chrome, "--headless", "--no-sandbox", "--disable-gpu",
        "--no-pdf-header-footer", f"--print-to-pdf={OUT_PDF}",
        OUT_HTML.as_uri(),
    ], check=True, capture_output=True)
    print(f"PDF:  {OUT_PDF}  ({OUT_PDF.stat().st_size // 1024} КБ)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", action="store_true", help="дополнительно собрать PDF через Chromium")
    args = ap.parse_args()

    d = json.loads(DATA.read_text(encoding="utf-8"))
    OUT_HTML.write_text(build_html(d), encoding="utf-8")
    print(f"HTML: {OUT_HTML}")

    filled = sum(1 for k, v in d["prices"].items()
                 if not k.startswith("_") and v.get("dealer_from") is not None)
    todo = sum(1 for s in d["sets"] if s["img"].startswith("img/TODO"))
    print(f"Цены заполнены: {filled} из {len(d['sets'])}. Фото не подставлено: {todo}.")

    if args.pdf:
        build_pdf()


if __name__ == "__main__":
    main()
