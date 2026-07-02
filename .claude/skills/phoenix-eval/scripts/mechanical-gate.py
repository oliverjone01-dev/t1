#!/usr/bin/env python3
"""Stage 0 mechanical gate для phoenix-eval.

Ловит greppable-ошибки ДО LLM-аудита: em dash, mixed-script, anti-slop
blocklist, непомеченные цифры. Урок сессии 2026-07-02: hook поймал 3 реальных
em dash, которые LLM-скан пропустил. Машина проверяет форму, LLM проверяет смысл.

Запуск: python3 mechanical-gate.py <file1> [file2 ...]
Exit 0 = чисто (LLM-аудит может стартовать), exit 1 = есть находки (сначала фикс).
"""
import re
import sys
import unicodedata

DASHES = {"–": "en dash", "—": "em dash", "―": "horizontal bar", "−": "minus sign"}

BLOCKLIST = [  # CLAUDE.md §7 Anti-Slop v2
    "в мире современного дизайна", "не секрет, что", "на протяжении веков",
    "является неотъемлемой частью", "позволяет создать", "позволяет реализовать",
    "высокое качество", "опытные специалисты", "индивидуальный подход",
    "доступные цены", "гармонично вписывается", "идеальное решение",
    "гармоничное сочетание", "квинтэссенция", "широкий ассортимент",
    "непревзойдённый", "один из лучших", "топовое предложение",
    "удвоит бизнес", "взорвёт рынок", "никто в РФ не делает",
    "уникальный актив", "просто надо подключить", "база уже есть",
]

# Цифры, которые обязаны иметь метку [ДАННЫЕ]/[ГИПОТЕЗА] в той же строке либо строкой выше:
# деньги (₽, руб, млн, K), проценты, ROMI-множители. Голые счётчики/даты не трогаем.
MONEY_PCT = re.compile(r"\d[\d\s.,]*\s*(?:₽|руб\.?|млн|млрд|тыс\.?|[KkКк]\s*₽|%|pp|x\b)", re.IGNORECASE)
TAG = re.compile(r"\[(?:ДАННЫЕ|ГИПОТЕЗА|ШИРОКИЙ ДИАПАЗОН|ЦИТАТА)")

SKIP_LINE = re.compile(r"^\s*(?:[#>]|```|\d+\.\s|[-*]\s+`)")  # код, заголовки не спамим
TABLE_ROW = re.compile(r"^\s*\|")
TABLE_SEP = re.compile(r"^\s*\|[\s:|-]+\|?\s*$")  # |---|---| разделитель
# Урок self-audit iter-3: SKIP_LINE глотал `|`-строки целиком, и КП с ценами
# 45000₽/12% в таблице проходил gate без флагов. Таблицы - главный носитель
# цен в КП, поэтому теперь: деньги в ячейках проверяются; тег засчитывается,
# если стоит в самой ячейке, в строке таблицы, либо в блоке-преамбуле
# непосредственно над таблицей (до 3 строк вверх, включая заголовок таблицы).


def mixed_script_words(line: str):
    for word in re.findall(r"[A-Za-zА-Яа-яёЁ]{2,}", line):
        has_cyr = any("CYRILLIC" in unicodedata.name(c, "") for c in word)
        has_lat = any("LATIN" in unicodedata.name(c, "") for c in word)
        if has_cyr and has_lat:
            yield word


def scan(path: str):
    findings = []
    try:
        lines = open(path, encoding="utf-8").read().splitlines()
    except OSError as e:
        return [(0, "IO", str(e))]
    in_code = False
    for i, line in enumerate(lines, 1):
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        for ch, name in DASHES.items():
            if ch in line:
                findings.append((i, "DASH", f"{name} (U+{ord(ch):04X})"))
        for w in mixed_script_words(line):
            findings.append((i, "MIXED", f"латиница+кириллица в «{w}»"))
        if in_code:
            continue
        low = line.lower()
        for phrase in BLOCKLIST:
            if phrase in low:
                findings.append((i, "SLOP", f"«{phrase}»"))
        if MONEY_PCT.search(line) and not TAG.search(line):
            is_table = bool(TABLE_ROW.match(line))
            if is_table and TABLE_SEP.match(line):
                continue  # разделитель |---|
            # тег засчитывается в контексте: до 3 строк вверх (преамбула таблицы / прошлая строка)
            ctx = "\n".join(lines[max(0, i - 4):i - 1])
            if TAG.search(ctx):
                continue
            if is_table or not SKIP_LINE.match(line):
                kind_note = "цена в таблице" if is_table else "цифра"
                findings.append((i, "UNTAGGED", f"{kind_note} без [ДАННЫЕ]/[ГИПОТЕЗА]: {line.strip()[:80]}"))
    return findings


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    total = 0
    for path in sys.argv[1:]:
        findings = scan(path)
        hard = [f for f in findings if f[1] in ("DASH", "MIXED", "SLOP")]
        soft = [f for f in findings if f[1] == "UNTAGGED"]
        for i, kind, msg in hard:
            print(f"{path}:{i} [{kind}] {msg}")
        for i, kind, msg in soft:
            print(f"{path}:{i} [{kind}·warn] {msg}")
        total += len(hard)
        print(f"-- {path}: {len(hard)} hard, {len(soft)} untagged-warnings")
    print(f"GATE: {'FAIL - fix hard findings before LLM audit' if total else 'PASS - LLM audit may start'}")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
