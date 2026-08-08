#!/usr/bin/env python3
"""Прогон псевдонимизации по собранным страницам платформы.

Кабинет менеджера получает --owner: внутри его страницы голое личное имя это он
сам. Сводка штаба получает --scoped: там владельца страницы нет, имя заменяется
внутри записи конкретного менеджера.

Запуск:
  python3 pseudonymize-pages.py --src plat-src --out plat-psd --map keys/pseudonyms.json
"""
import argparse
import json
import pathlib
import subprocess
import sys

SCRIPT = pathlib.Path(__file__).with_name("pseudonymize.mjs")

TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
    "я": "ya", " ": "-", "-": "-",
}


def slug(name: str) -> str:
    """Имя файла тоже персональные данные: petrova-mariya.html называет человека
    до того, как кто-либо ввёл пароль. Файл переименовывается по псевдониму."""
    return "".join(TRANSLIT.get(c, "") for c in name.strip().lower())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--map", required=True)
    a = ap.parse_args()

    src, out = pathlib.Path(a.src), pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    table = json.loads(pathlib.Path(a.map).read_text(encoding="utf-8"))
    # Ключ по отсортированным словам: выгрузка даёт «Петрова Мария», снимок
    # сделок «Мария Петрова», это один человек.
    def key(s: str) -> str:
        return " ".join(sorted(s.lower().replace("ё", "е").split()))

    alias_of = {key(v["real"]): v["alias"] for v in table.values()}

    pages = json.loads((src / "pages.json").read_text(encoding="utf-8"))
    done, failed = [], []
    for p in pages:
        cmd = ["node", str(SCRIPT), "apply", str(src / p["file"]), "--map", a.map]
        cmd += ["--owner", p["person"]] if p.get("scope") == "manager" else ["--scoped"]
        r = subprocess.run(cmd, capture_output=True, text=True)
        print(f"--- {p['file']} rc={r.returncode}")
        for line in r.stderr.strip().splitlines():
            print("   ", line)
        if r.returncode:
            failed.append(p["file"])
            continue
        q = dict(p)
        # Заголовок, признак владельца и имя файла тоже несут настоящее имя: гейт
        # кабинета показывает нейтральное «Кабинет менеджера», а манифест сборки,
        # выдача паролей и путь к файлу идут по псевдониму.
        if p.get("scope") == "manager" and key(p["person"]) in alias_of:
            alias = alias_of[key(p["person"])]
            q["person"] = q["title"] = alias
            q["file"] = f"{slug(alias)}.html"
        (out / q["file"]).write_text(r.stdout, encoding="utf-8")
        done.append(q)

    (out / "pages.json").write_text(json.dumps(done, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nготово: {len(done)} страниц -> {out}")
    if failed:
        print(f"НЕ ПРОШЛИ КОНТРОЛЬ: {', '.join(failed)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
