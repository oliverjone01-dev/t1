"""Собрать questions.js для страницы аттестации из knowledge/semantic/genglass-attestation-v1.json.

python3 attestaciya/build.py

Верный вариант в страницу не пишется открытым текстом: у каждого варианта хранится
FNV-1a хеш, верный узнаётся сравнением. Это защита от «посмотреть код страницы»,
а не от подбора: проводящий аттестацию держит время и порядок сам.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "knowledge/semantic/genglass-attestation-v1.json"
OUT = Path(__file__).resolve().parent / "questions.js"
SALT = "gg-att-v1"

THEMES = {
    "base": {"Скорость и формулировки": [1, 2, 3, 4, 5, 6, 12], "Квалификация": [7, 8, 10, 11], "Материалы и термины": [13, 14],
             "КП и сроки": [15, 16, 17, 18], "Возражения": [19, 20, 21], "Дожим": [22, 23, 24], "Оплата и запуск": [25, 26, 27],
             "CRM и каналы": [9, 28, 29], "Претензии": [30]},
    "star": {"Скорость и формулировки": [1], "Квалификация": [2, 3], "Возражения": [4, 5], "Дожим": [6, 15], "Оплата и запуск": [7, 12],
             "Претензии, сроки, изменения": [8, 9, 10, 11, 13, 14]},
}


def fnv(s):
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def main():
    d = json.loads(SRC.read_text(encoding="utf-8"))
    tests = {}
    for lv in ("base", "star"):
        meta = d["forms"][lv]
        theme_of = {n: t for t, ns in THEMES[lv].items() for n in ns}
        qs = []
        for q in d[lv]:
            key = lv + ":" + str(q["n"])
            qs.append({
                "n": q["n"], "crit": q["critical"], "sec": q["section"], "case": q["case"], "q": q["question"],
                "o": q["options"], "k": fnv(SALT + "|" + key + "|" + q["answer_text"]), "th": theme_of[q["n"]],
            })
        tests[lv] = {"name": meta["name"], "pts": meta["points_each"], "pass": meta["pass_score"], "max": meta["max_score"],
                     "min": meta["time_minutes"], "critFail": meta["critical_fail"], "qs": qs}
    js = "/* сгенерировано attestaciya/build.py из " + SRC.relative_to(ROOT).as_posix() + ", версия " + d["version"] + " от " + d["date"] + " */\n"
    js += "window.ATT = " + json.dumps({"salt": SALT, "version": d["version"], "date": d["date"], "tests": tests}, ensure_ascii=False) + ";\n"
    OUT.write_text(js, encoding="utf-8")
    print("готово:", OUT, sum(len(t["qs"]) for t in tests.values()), "вопросов")


if __name__ == "__main__":
    main()
