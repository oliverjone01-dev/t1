"""Развернуть новый дашборд в ДНК Контур DS 1.4.

python3 .claude/skills/kontur-dna/scripts/scaffold.py <папка> [--title "Название"] [--single]

Копирует ds/ (база 1.3 + kx 1.4) и index.html из стартового шаблона.
--single собирает один файл index.html со встроенными стилями и скриптами, как макет «Разбор недели».
"""
import argparse
import re
import shutil
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
ASSETS = SKILL / "assets"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--title", default="Название дашборда")
    ap.add_argument("--single", action="store_true")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    page = (ASSETS / "starter.html").read_text().replace("<title>Название дашборда</title>", "<title>" + a.title + "</title>")
    if a.single:
        ds = ASSETS / "ds"
        page = re.sub(r'<link rel="stylesheet" href="ds/([^"]+)">', lambda m: "<style>\n" + (ds / m.group(1)).read_text() + "</style>", page)
        page = re.sub(r'<script src="ds/([^"]+)"></script>', lambda m: "<script>\n" + (ds / m.group(1)).read_text().replace("</script", "<\\/script") + "</script>", page)
    else:
        if (out / "ds").exists():
            shutil.rmtree(out / "ds")
        shutil.copytree(ASSETS / "ds", out / "ds")
    (out / "index.html").write_text(page)
    print("готово:", out / "index.html", "(один файл)" if a.single else "+ ds/")


if __name__ == "__main__":
    main()
