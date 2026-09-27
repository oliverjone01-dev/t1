"""Сборка index.html: каркас и Контур DS из макета «Разбор недели» + раздел «Детализация».

Берём из reference/razbor-nedeli-maket.html всё до блока с демо-данными, меняем заголовок
и верхнюю панель, дописываем свои стили, данные (data/page.json) и src/app.js.
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent
MAKET = ROOT / "reference/razbor-nedeli-maket.html"
CUT = "<script>\n/* ---------------- данные ----------------"

CSS = """<style>
/* Детализация: дополнения к ленте переписки макета, только токены */
.op-cabs{ align-items:start; }
.op-cab-head{ align-items:baseline; gap:var(--sp-2); }
.op-cm-lead{ font-size:var(--fs-body); color:var(--text-strong); margin:0; }
.op-list{ margin:0; padding-left:var(--sp-4); display:flex; flex-direction:column; gap:var(--sp-1-5); font-size:var(--fs-body); }
.op-ex + .op-ex{ margin-top:var(--sp-4); }
.op-link{ color:var(--primary-ink, var(--primary)); text-underline-offset:2px; white-space:nowrap; }
.op-val.op-good{ color:var(--ok); font-weight:var(--fw-semi); }
.op-val.op-bad{ color:var(--crit); font-weight:var(--fw-semi); }
.op-mods{ display:flex; flex-direction:column; gap:var(--sp-4); }
.op-mod{ display:flex; flex-direction:column; gap:var(--sp-1-5); }
.op-mod .op-bub.is-m{ align-self:flex-start; }
.op-mod .op-bub.is-c{ align-self:flex-end; }
</style>
"""

TOPBAR_OLD = '<div class="ks-seg" role="group" aria-label="Неделя" id="seg"></div>'
TOPBAR_NEW = TOPBAR_OLD + '\n        <div class="ks-seg" role="group" aria-label="Кабинет" id="cab"></div>'


def main():
    html = MAKET.read_text()
    head = html[: html.index(CUT)]
    head = head.replace("<title>Разбор недели · ОП ГМ</title>", "<title>Детализация ОП ГМ</title>")
    assert TOPBAR_OLD in head
    head = head.replace(TOPBAR_OLD, TOPBAR_NEW)
    head = head.replace("</head>", CSS + "</head>", 1)
    # Правка DS: разность дробей (100 - 86,7) давала хвост 13,2999999. Число округляется до десятых
    NF_OLD = ": String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g"
    NF_NEW = ": String(typeof n === 'number' ? Math.round(n * 10) / 10 : n).replace(/\\B(?=(\\d{3})+(?!\\d))/g"
    assert NF_OLD in head, "не нашёл nf в Контур DS"
    head = head.replace(NF_OLD, NF_NEW, 1)
    data = json.loads((ROOT / "data/page.json").read_text())
    tech = ROOT / "data/techniques.json"
    if tech.exists():
        data["techniques"] = json.loads(tech.read_text())
    data_js = "window.DATA = " + json.dumps(data, ensure_ascii=False).replace("</", "<\\/") + ";"
    app = (ROOT / "src/app.js").read_text()
    page = head + "<script>\n" + data_js + "\n</script>\n<script>\n" + app + "\n</script>\n</body>\n</html>\n"
    for bad in ("—", "–"):
        assert bad not in data_js + app, "длинное или среднее тире в данных или коде"
    (ROOT / "index.html").write_text(page)
    print("index.html", round(len(page.encode()) / 1024), "KB")


if __name__ == "__main__":
    main()
