"""Сборка index.html: каркас и Контур DS из макета «Разбор недели» + раздел «Детализация».

Берём из reference/razbor-nedeli-maket.html всё до блока с демо-данными, меняем заголовок
и верхнюю панель, дописываем свои стили, данные (data/page.json) и src/app.js.
"""
import json
import os
import secrets
import subprocess
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
.op-id{ font-size:var(--fs-small); color:var(--text-muted); word-break:break-all; }
.op-dlg-tools{ display:flex; flex-wrap:wrap; gap:var(--sp-2); align-items:center; }
.op-dlg-tools .ks-input{ flex:1 1 240px; font-size:16px; }
/* вход по паролю */
.ks-app[hidden]{ display:none !important; }
.op-lock{ min-height:100dvh; display:grid; place-items:center; padding:var(--sp-4); background:var(--bg); }
.op-lock form{ width:min(100%, 380px); display:flex; flex-direction:column; gap:var(--sp-3); }
.op-lock h1{ margin:0; font-size:var(--fs-h2); color:var(--text-strong); font-weight:var(--fw-semi); letter-spacing:-.015em; }
.op-lock p{ margin:0; color:var(--text-muted); font-size:var(--fs-body); }
.op-lock .ks-input{ font-size:16px; min-height:44px; }
.op-lock .ks-btn{ min-height:44px; }
.op-lock-err{ color:var(--crit); font-size:var(--fs-body); min-height:1.4em; }
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
    plain = json.dumps(data, ensure_ascii=False)
    app = (ROOT / "src/app.js").read_text()
    for bad in ("\u2014", "\u2013"):
        assert bad not in plain + app, "длинное или среднее тире в данных или коде"

    # Данные шифруются паролем: в публичном репозитории лежит только шифр.
    # Пароль берётся из GM_PAGE_PASSWORD или из .page-password (файл в git не попадает).
    pw_file = ROOT / ".page-password"
    password = os.environ.get("GM_PAGE_PASSWORD") or (pw_file.read_text().strip() if pw_file.exists() else "")
    if not password:
        password = "-".join(secrets.token_urlsafe(6) for _ in range(3))
        pw_file.write_text(password + "\n")
        print("новый пароль записан в", pw_file.name)
    enc = subprocess.run(["node", str(ROOT / "src/encrypt.mjs")], input=plain.encode(), capture_output=True,
                         env={**os.environ, "GM_PAGE_PASSWORD": password}, check=True).stdout.decode()

    lock = (
        '<div class="op-lock" id="lock"><form id="lock-form" autocomplete="off">'
        "<h1>Детализация ОП ГМ</h1>"
        "<p>Данные зашифрованы. Введите пароль, чтобы открыть страницу.</p>"
        '<label class="ks-field"><span class="ks-field-label">Пароль</span>'
        '<input class="ks-input" id="lock-pass" type="password" autocomplete="current-password" required></label>'
        '<button class="ks-btn ks-btn--primary" id="lock-btn" type="submit">Открыть</button>'
        '<div class="op-lock-err" id="lock-err" role="alert"></div></form></div>\n'
    )
    assert '<div class="ks-app">' in head
    head = head.replace("<body>", "<body>\n" + lock, 1).replace('<div class="ks-app">', '<div class="ks-app" hidden>', 1)
    page = (head + "<script>\nwindow.ENC = " + enc + ";\n</script>\n"
            + "<script>\nwindow.startApp = function(){\n" + app + "\n};\n</script>\n"
            + "<script>\n" + (ROOT / "src/lock.js").read_text() + "\n</script>\n</body>\n</html>\n")
    (ROOT / "index.html").write_text(page)
    print("index.html", round(len(page.encode()) / 1024), "KB")


if __name__ == "__main__":
    main()
