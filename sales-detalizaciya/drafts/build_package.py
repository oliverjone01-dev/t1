"""Архив для общего проекта Glass Memory: Контур DS 1.3 из макета «Разбор недели» один в один,
расширение DS 1.4 (kx) и раздел «Детализация» со стартовой страницей «Обстановка».

python3 drafts/build_package.py  ->  dist/glass-memory-detalizaciya/ и dist/glass-memory-detalizaciya.zip

В архиве data.js с ID диалогов и обезличенными итогами, поэтому dist/ в git не попадает.
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_proposal  # noqa: E402

NAME = "glass-memory-detalizaciya"
OUT = ROOT / "dist" / NAME
PKG = ROOT / "package"

# блоки <head> макета по порядку: токены, компоненты, настройки вида, иконки, компоненты JS, графики
BASE = [("style", "Контур DS · токены", "tokens.css"), ("style", "Контур DS · компоненты", "kit.css"),
        ("script", "Контур DS · настройки вида", "brand.js"), ("script", "Контур DS · иконки", "icons.js"),
        ("script", "Контур DS · компоненты на чистом", "kit.js"), ("script", "Контур DS · графики", "charts.js")]


def base_ds():
    html = (ROOT / "reference/razbor-nedeli-maket.html").read_text()
    head = html[: html.index("</head>")]
    blocks = [(m.group(1), m.group(2)) for m in re.finditer(r"<(style|script)>([\s\S]*?)</\1>", head)]
    out = {}
    for kind, mark, name in BASE:
        hit = [b for k, b in blocks if k == kind and mark in b[:400]]
        assert len(hit) == 1, (name, len(hit))
        out[name] = hit[0].strip("\n") + "\n"
    return out


def inline(page, files):
    """Одностраничная версия, как пример: все стили и скрипты внутри файла."""
    def css(m):
        return "<style>\n" + files[m.group(1)] + "</style>"

    def js(m):
        return "<script>\n" + files[m.group(1)].replace("</script", "<\\/script") + "</script>"
    page = re.sub(r'<link rel="stylesheet" href="((?:ds|sections)/[^"]+)">', css, page)
    return re.sub(r'<script src="((?:ds|sections)/[^"]+)"></script>', js, page)


def main():
    _, txt = build_proposal.build_data()
    files = {"ds/" + k: v for k, v in base_ds().items()}
    for p in ("ds/kx.css", "ds/kx.js", "ds/kx-showcase.js", "sections/detalizaciya/detalizaciya.js"):
        files[p] = (PKG / p).read_text()
    files["sections/detalizaciya/data.js"] = ("/* Данные «Детализации»: Авито, 2 кабинета, 8 недель. Собрано drafts/build_package.py.\n"
                                              "   ID диалогов и обезличенные итоги: не публиковать в открытом доступе. */\n"
                                              "window.DETAL_DATA = " + txt.replace("</", "<\\/") + ";\n")
    for bad in ("—", "–"):
        for p in ("ds/kx.css", "ds/kx.js", "ds/kx-showcase.js", "sections/detalizaciya/detalizaciya.js"):
            assert bad not in files[p], (p, bad)

    if OUT.exists():
        shutil.rmtree(OUT)
    for p, body in files.items():
        (OUT / p).parent.mkdir(parents=True, exist_ok=True)
        (OUT / p).write_text(body)
    for p in ("index.html", "ds-showcase.html", "README.md", "CHANGELOG-DS.md"):
        shutil.copy(PKG / p, OUT / p)
    (OUT / "detalizaciya-odnim-failom.html").write_text(inline((PKG / "index.html").read_text(), files))

    # та же DS в скилле kontur-dna: новые дашборды берут файлы оттуда
    skill_ds = ROOT.parent / ".claude/skills/kontur-dna/assets/ds"
    if skill_ds.parent.exists():
        for p in [k for k in files if k.startswith("ds/")]:
            (skill_ds / p[3:]).write_text(files[p])

    z = ROOT / "dist" / (NAME + ".zip")
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(OUT.rglob("*")):
            if f.is_file():
                zf.write(f, Path(NAME) / f.relative_to(OUT))
    print(z.relative_to(ROOT), round(z.stat().st_size / 1024), "KB")
    for f in sorted(OUT.rglob("*")):
        if f.is_file():
            print("  ", f.relative_to(OUT), round(f.stat().st_size / 1024), "KB")


if __name__ == "__main__":
    main()
